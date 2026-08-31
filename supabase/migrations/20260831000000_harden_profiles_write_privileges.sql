-- supabase/migrations/20260831000000_harden_profiles_write_privileges.sql
--
-- Phase 0B — Secure authoritative profile writes.
-- NOT applied to any environment yet. Review before running (see CLAUDE.md
-- and the Phase 0B reports this migration was written alongside).
--
-- Verified problem (live inspection, 2026-08-31):
--   authenticated_can_update_role = true
--   authenticated_can_update_team = true
--   authenticated_can_update_name = true
--   anon_can_update_role          = true
--   authenticated can DELETE public.profiles = true
--   anon can DELETE public.profiles          = true
--
--   Existing RLS policies:
--     profiles_update_all_admin  USING/CHECK: is_admin(auth.uid()) OR id = auth.uid()
--     update_own_profile         USING:       auth.uid() = id   (no WITH CHECK)
--
--   Row-level security controls WHICH ROWS a statement may touch, not WHICH
--   COLUMNS. Nothing above stops a normal authenticated user's own-row
--   UPDATE from also changing `role` or `team_id` in the same request — that
--   is a real, exercisable path via a plain PostgREST call, not theoretical:
--   update_own_profile's USING clause permits the row, and neither that
--   policy nor the table-wide UPDATE grant restricts which columns the
--   statement may touch.
--
--   DELETE is a different case and is stated more conservatively: anon and
--   authenticated hold table-level DELETE privilege on profiles, but no
--   DELETE policy was found among the existing policies (all four listed —
--   profiles_select_all_admin, profiles_update_all_admin, read_own_profile,
--   update_own_profile — are SELECT/UPDATE only). With RLS enabled, the
--   absence of any permissive policy for an operation defaults to deny for
--   that operation, so a DELETE is likely already blocked today regardless
--   of the grant. We did not attempt a DELETE to confirm this either way.
--   The grant is still unnecessarily broad for least-privilege purposes and
--   is revoked below as defense-in-depth, not because a working deletion
--   path was verified.
--
--   This migration closes the confirmed UPDATE column gap and removes the
--   unnecessarily broad DELETE grant, both at the grant level — the only
--   layer that can express a column-level (for UPDATE) restriction, and the
--   most direct way to remove a table-level privilege that isn't needed
--   (for DELETE).
--
--   Profile *creation* already goes through auth.users -> on_auth_user_created
--   -> public.handle_new_user(), verified as SECURITY DEFINER owned by
--   `postgres`. That means it runs with the owner's privileges, not the
--   privileges of `supabase_auth_admin`, `anon`, or `authenticated` — so it
--   is unaffected by every REVOKE below, including the separately-verified
--   fact that `supabase_auth_admin` itself has no INSERT grant on profiles.
--   This migration does not touch that trigger, the profiles table's role
--   enum, or teams/team_members.
--
-- Scope: only public.profiles privileges and its two UPDATE policies.
--
-- Before applying, confirm current grants with:
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'profiles'
--     and grantee in ('anon','authenticated');
-- REVOKE is a no-op for any privilege not actually held, so running this is
-- safe regardless of exactly which of the above are currently granted.
--
-- Rollback (run in this order if this migration needs to be reverted):
--   drop policy if exists update_own_profile on public.profiles;
--   create policy update_own_profile
--     on public.profiles
--     for update
--     using (auth.uid() = id);
--
--   drop policy if exists profiles_update_all_admin on public.profiles;
--   create policy profiles_update_all_admin
--     on public.profiles
--     for update
--     using (is_admin(auth.uid()) or id = auth.uid())
--     with check (is_admin(auth.uid()) or id = auth.uid());
--
--   revoke update (full_name) on public.profiles from authenticated;
--   grant insert, update, delete on public.profiles to authenticated;
--   grant insert, update, delete on public.profiles to anon;

-- ---------------------------------------------------------------------------
-- 1. Table-level and column-level privileges — the actual security boundary.
-- ---------------------------------------------------------------------------

-- anon should never write profiles at all: no creation, no edits, no
-- deletion. Only the SECURITY DEFINER trigger (running as its owner
-- `postgres`, not as `anon`) creates rows.
revoke insert, update, delete on public.profiles from anon;

-- authenticated loses blanket table-wide INSERT/UPDATE/DELETE...
revoke insert, update, delete on public.profiles from authenticated;

-- ...and regains only what self-service profile editing actually uses today:
-- updating your own display name. role, team_id, id, and every future
-- authoritative column (account_status, manager_id, access_expires_at,
-- approved_by, approved_at) stay unreachable from a normal authenticated
-- session, and no authenticated session can delete a profiles row at all —
-- those must go through server-side code using adminSupabase() after its
-- own explicit authorization checks, never through a browser-issued
-- UPDATE/DELETE relying on RLS alone.
grant update (full_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. RLS policy cleanup — clarity only. The column/operation grants above
--    are what actually stop a self-update from touching role/team_id or a
--    self-delete from succeeding; this split just makes each policy state
--    one responsibility instead of two. SELECT policies are untouched.
-- ---------------------------------------------------------------------------

-- Previously: is_admin(auth.uid()) OR id = auth.uid() — duplicated the
-- self-update policy below inside the "admin" policy. Narrow this to admin
-- rows only; self-updates are entirely covered by update_own_profile.
drop policy if exists profiles_update_all_admin on public.profiles;
create policy profiles_update_all_admin
  on public.profiles
  for update
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- Previously had no WITH CHECK. Add one matching the USING clause so a
-- self-update can't be crafted to reassign the row to a different id
-- (belt-and-suspenders alongside the column grant, not a substitute for it).
-- This policy determines WHICH ROW an authenticated user may touch; the
-- UPDATE(full_name)-only grant above determines WHICH COLUMN — together
-- they're what makes a self-update safe, not the UI hiding a field.
drop policy if exists update_own_profile on public.profiles;
create policy update_own_profile
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
