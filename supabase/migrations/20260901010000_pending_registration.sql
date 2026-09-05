-- supabase/migrations/20260901010000_pending_registration.sql
--
-- Phase 3B — New registrations become PENDING, with a sanitized
-- requested_role. NOT applied to any environment yet. Review before running.
--
-- ---------------------------------------------------------------------------
-- Exact current live/repo behavior (audited before writing this)
-- ---------------------------------------------------------------------------
-- The repo has never carried a tracked migration for public.handle_new_user()
-- — it was verified live during Phase 2A as: SECURITY DEFINER, owned by
-- `postgres`, bound to a trigger on auth.users (on_auth_user_created), with
-- this exact body:
--
--   begin
--     insert into public.profiles (id, full_name)
--     values (
--       new.id,
--       coalesce(new.raw_user_meta_data->>'full_name','')
--     );
--     return new;
--   end;
--
-- Only the body was captured live, not the full CREATE FUNCTION header — the
-- exact prior `search_path` setting (if any was explicitly set at all) was
-- not part of that audit. This migration sets an explicit, safe
-- `search_path = public, pg_temp` regardless, which is standard SECURITY
-- DEFINER hardening and changes nothing functionally here since every table
-- reference in this function is already fully schema-qualified
-- (public.profiles) — it would behave identically under an unqualified
-- search_path too.
--
-- Every current profile was created by that trigger with only
-- id/full_name/role(=CLIENT default) populated — Phase 3A's own migration
-- backfilled account_status=ACTIVE for all of them separately, and this
-- migration does not touch existing rows at all (see "Existing accounts"
-- below).
--
-- ---------------------------------------------------------------------------
-- New behavior
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION — the trigger (on_auth_user_created) is NOT
-- dropped or recreated; Postgres re-resolves a trigger's function by name at
-- each firing, so replacing the function body is sufficient and the
-- trigger-to-function binding is undisturbed. Still SECURITY DEFINER, still
-- owned by whoever runs this migration (matching current ownership),
-- explicit `search_path = public, pg_temp`.
--
-- Every NEW auth.users row now produces a profiles row with:
--   id                 = new.id                                  (unchanged)
--   full_name           = coalesce(new.raw_user_meta_data->>'full_name','')
--                                                                  (unchanged)
--   role                = 'CLIENT'          -- authoritative role stays
--                                              CLIENT until Admin approval,
--                                              even when AGENT/MANAGER was
--                                              requested (Part B)
--   account_status      = 'PENDING'         -- blocks protected access via
--                                              requireApiRole/middleware
--                                              (Phase 3B application code)
--   requested_role      = sanitized value from raw_user_meta_data
--                          (see sanitization below) — historical/informational
--                          only, never trusted as the authoritative role
--   access_expires_at   = NULL                          (column default)
--   approved_by         = NULL                           (column default)
--   approved_at         = NULL                           (column default)
--   manager_id          = NULL          -- omitted from the INSERT entirely,
--                                          so it gets its own column default
--                                          (NULL) naturally, same as before
--   team_id             = NULL          -- likewise omitted; untouched,
--                                          still unused legacy scaffolding
--
-- ---------------------------------------------------------------------------
-- requested_role sanitization — never a blind cast
-- ---------------------------------------------------------------------------
-- (new.raw_user_meta_data->>'requested_role')::public.role would raise an
-- exception and ABORT the entire signup if the metadata contained anything
-- other than a valid enum member — including simply being absent (NULL::text
-- cast to an enum is fine, but 'ADMIN', empty string, or garbage text is
-- not). That is not acceptable: a malformed or missing metadata value must
-- never be able to fail signup. Sanitization here is an explicit allow-list
-- check performed as plain text comparison BEFORE any enum cast is
-- attempted — only 'CLIENT', 'AGENT', 'MANAGER' (exact, case-sensitive
-- match) are accepted; 'ADMIN', unrecognized text, empty string, and a
-- missing key all fall through to NULL. NULL is the deliberate, safe
-- fallback (matches the explicit preference stated for this phase) — an
-- Admin can still review and approve a PENDING account with no recorded
-- request, never inventing a role that wasn't actually asked for.
--
-- The existing profiles_requested_role_not_admin CHECK constraint (Phase 3A)
-- also rejects 'ADMIN' at the table level — this trigger does not rely on
-- that alone (defense in depth, matching this project's established
-- pattern): the allow-list check here means an 'ADMIN' value never reaches
-- the CHECK in the first place, and neither layer is the sole protection.
--
-- ---------------------------------------------------------------------------
-- Existing accounts — NOT touched
-- ---------------------------------------------------------------------------
-- This migration only changes what happens for FUTURE auth.users inserts.
-- It contains no UPDATE statement and does not re-run any backfill — every
-- profile that exists before this migration keeps its current role,
-- account_status (ACTIVE, from Phase 3A), manager_id, and every other field
-- exactly as-is.
--
-- ---------------------------------------------------------------------------
-- OAuth / other signup paths
-- ---------------------------------------------------------------------------
-- This app's only other signup path is Google OAuth (audited: no other
-- provider exists). It does not present a role-selection step, so
-- raw_user_meta_data for an OAuth signup will not contain a 'requested_role'
-- key at all — the sanitization above treats a missing key exactly like an
-- invalid one: requested_role = NULL. The new profile still becomes
-- account_status = PENDING like any other signup — there is no path by
-- which OAuth bypasses pending approval, because this trigger is the single
-- place ANY new profile is created, regardless of how auth.users was
-- populated.
--
-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
-- No GRANT statements here. The trigger runs as its SECURITY DEFINER owner
-- (effectively `postgres`), which already has full INSERT privilege on
-- public.profiles regardless of Phase 0B's REVOKE of table-wide INSERT from
-- anon/authenticated — that REVOKE only ever affected anon/authenticated,
-- never the function owner. Nothing here grants anon/authenticated any new
-- privilege; account_status, requested_role, approved_by, approved_at, and
-- access_expires_at all remain unwritable from a normal authenticated
-- session, exactly as Phase 3A established.
--
-- Rollback (restores the exact previously-verified handle_new_user body,
-- with the same explicit search_path hardening — see the note above on why
-- that doesn't change behavior versus whatever the prior header actually
-- was):
--
--   create or replace function public.handle_new_user()
--   returns trigger
--   language plpgsql
--   security definer
--   set search_path = public, pg_temp
--   as $$
--   begin
--     insert into public.profiles (id, full_name)
--     values (
--       new.id,
--       coalesce(new.raw_user_meta_data->>'full_name', '')
--     );
--     return new;
--   end;
--   $$;
--
-- This rollback restores prior signup behavior (new profiles land ACTIVE,
-- CLIENT, via the account_status column's own default from Phase 3A) —
-- it does not touch or need to touch the trigger itself, same as the
-- forward migration.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_raw_requested_role text;
  v_requested_role public.role;
begin
  v_raw_requested_role := new.raw_user_meta_data->>'requested_role';

  if v_raw_requested_role in ('CLIENT', 'AGENT', 'MANAGER') then
    v_requested_role := v_raw_requested_role::public.role;
  else
    v_requested_role := null;
  end if;

  insert into public.profiles (
    id,
    full_name,
    role,
    account_status,
    requested_role,
    access_expires_at,
    approved_by,
    approved_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'CLIENT'::public.role,
    'PENDING'::public.account_status,
    v_requested_role,
    null,
    null,
    null
  );

  return new;
end;
$$;
