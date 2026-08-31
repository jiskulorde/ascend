-- supabase/migrations/20260831020000_add_profiles_manager_id.sql
--
-- Phase 2C — Manager/Agent relationship schema only.
-- NOT applied to any environment yet. Review before running.
--
-- Adds public.profiles.manager_id — the SOLE authoritative representation
-- of "who is this Agent's current Manager?" (Phase 2B design, approved with
-- one adjustment: no Manager SELECT RLS in this phase — see the RLS note
-- near the bottom of this file).
--
-- ---------------------------------------------------------------------------
-- Legacy team scaffolding — explicitly NOT touched, NOT the source of truth
-- ---------------------------------------------------------------------------
-- public.teams (id, name) and public.team_members (team_id, user_id, role,
-- PK (team_id, user_id), team_id -> teams.id ON DELETE CASCADE, RLS disabled
-- on both) were verified live to be empty (0 rows each), have no FK on
-- team_members.user_id, and have zero application code usage anywhere in
-- this repo. profiles.team_id (uuid, no FK, 0/8 profiles populated) is
-- likewise unused. None of the three are modified, referenced, or read by
-- this migration or by manager_id — manager_id supersedes them for the
-- Agent -> Manager relationship. They are left in place, untouched, in case
-- a future unrelated feature (e.g. ad-duty scheduling, per the placeholder
-- copy in src/app/dashboard/team/page.tsx) has a legitimate use for them —
-- this migration makes no judgment on that.
--
-- ---------------------------------------------------------------------------
-- What this migration does NOT do (by design, this phase)
-- ---------------------------------------------------------------------------
--   * No CHECK constraint verifying manager_id actually points at a MANAGER-
--     role profile. That is a cross-row invariant ("does the referenced row
--     have role = 'MANAGER'?") — a plain CHECK constraint only ever sees the
--     row being written and cannot safely/atomically inspect another row, so
--     attempting this here would either be unenforceable or race-prone.
--     Phase 2D enforces it instead via trusted, atomic conditional UPDATEs
--     (`... WHERE role = 'AGENT' AND EXISTS (SELECT 1 FROM profiles m WHERE
--     m.id = $manager_id AND m.role = 'MANAGER')`), issued only from
--     server-side code using the service-role client — never a browser
--     write. This migration only adds the two invariants that a CHECK CAN
--     safely express: manager_id != id, and manager_id implies role='AGENT'
--     (both same-row checks — see below).
--   * No new RLS policy. A "Manager can SELECT their own Agents" policy was
--     recommended in the Phase 2B design but is deliberately deferred:
--     profiles will grow more governance fields (account_status,
--     expiration, approval metadata, etc.) that a Manager's browser should
--     never receive wholesale just because an Agent's manager_id points at
--     them. Manager roster reads will go through a trusted server endpoint
--     (verifies MANAGER, filters to manager_id = caller, returns only
--     specifically allowed fields) rather than raw table RLS, at least
--     initially. profiles_select_all_admin, read_own_profile, and every
--     other existing SELECT policy are untouched by this migration.
--   * No GRANT for manager_id, to anon or authenticated. See the write
--     security note below.
--
-- Before applying: current live counts (verified) are 8 profiles, 2 ADMIN,
-- 0 with team_id set. This migration adds one nullable column with no
-- default — every existing row gets manager_id = NULL, which already
-- matches its real-world state. No role, full_name, team_id, teams,
-- team_members, existing SELECT policy, existing UPDATE grant, or the
-- auth.users trigger is touched.
--
-- Rollback (safe — no assignments exist yet, since manager_id doesn't exist
-- until this migration runs, so there is nothing to reassign or lose):
--   alter table public.profiles drop column if exists manager_id;
--   -- Dropping the column also drops, automatically, everything defined on
--   -- it: the FK (profiles_manager_id_fkey), both CHECK constraints
--   -- (profiles_manager_not_self, profiles_manager_requires_agent_role),
--   -- and the index (profiles_manager_id_idx). No separate DROP INDEX /
--   -- DROP CONSTRAINT statements are needed first.

-- ---------------------------------------------------------------------------
-- 1. Column + FK
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists manager_id uuid null;

alter table public.profiles
  add constraint profiles_manager_id_fkey
  foreign key (manager_id)
  references public.profiles (id)
  on delete set null;

-- ON DELETE SET NULL, not CASCADE: if a Manager's profile row is ever
-- deleted (a rare, Admin-only, strongly-confirmed action per the account
-- governance design — never a routine one), their Agents must simply become
-- unassigned (matching the existing "Agent may temporarily have no Manager"
-- rule), not be deleted themselves. CASCADE here would delete Agent profile
-- rows whenever their Manager's row is deleted, which must never happen.

-- ---------------------------------------------------------------------------
-- 2. Same-row CHECK constraints (see the "does NOT do" note above for why
--    the manager-must-actually-be-a-MANAGER check is intentionally absent)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add constraint profiles_manager_not_self
  check (manager_id is null or manager_id != id);

-- A profile can never be its own manager.

alter table public.profiles
  add constraint profiles_manager_requires_agent_role
  check (manager_id is null or role = 'AGENT'::public.role);

-- manager_id is only meaningful for AGENT profiles. A useful side effect:
-- promoting an AGENT (with a manager) to MANAGER/ADMIN/CLIENT will be
-- REJECTED by this constraint unless the same UPDATE also clears
-- manager_id to NULL — the database itself forces the Phase 2D promotion
-- logic to do this correctly, rather than relying on mutation code to
-- remember to.

-- ---------------------------------------------------------------------------
-- 3. Index
-- ---------------------------------------------------------------------------

create index if not exists profiles_manager_id_idx
  on public.profiles (manager_id)
  where manager_id is not null;

-- Partial, not full: every future read of this column is an equality lookup
-- for a specific manager's roster ("WHERE manager_id = <manager uuid>"),
-- never "WHERE manager_id IS NULL". Postgres B-tree equality lookups never
-- match NULL entries anyway, so a full index would carry rows (every
-- CLIENT/ADMIN profile, and every currently-unassigned AGENT — the large
-- majority of the table) that this query pattern can never use. The partial
-- index only indexes rows that could ever satisfy a "= <uuid>" lookup,
-- making it both smaller and strictly sufficient for the described access
-- pattern; simpler and cheaper, with no query this design anticipates that
-- it fails to serve.

-- ---------------------------------------------------------------------------
-- 4. Write security — confirm nothing here widens browser access
-- ---------------------------------------------------------------------------

-- Deliberately no GRANT statement in this migration. Phase 0B's hardening
-- migration replaced blanket UPDATE on public.profiles for `authenticated`
-- with a column-level allow-list containing only `full_name`
-- (GRANT UPDATE (full_name) ON public.profiles TO authenticated). Postgres
-- column-level grants are allow-lists, not deny-lists: adding a new column
-- does not implicitly grant UPDATE on it to anyone, so manager_id is
-- unwritable by `authenticated` and `anon` from the moment it's created,
-- with zero action required here to keep it that way. It becomes writable
-- only through the service-role client (adminSupabase()) called from
-- trusted server code, per the Phase 2D design. Do not add
-- `GRANT UPDATE (manager_id) ...` to authenticated or anon in any future
-- migration — manager_id must remain authoritative/server-controlled.
