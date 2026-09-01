-- supabase/migrations/20260901000000_account_lifecycle_schema.sql
--
-- Phase 3A — Account lifecycle schema foundation ONLY.
-- NOT applied to any environment yet. Review before running.
--
-- Adds the columns needed for future account approval/suspension/expiration
-- (account_status, requested_role, access_expires_at, approved_by,
-- approved_at). Nothing in this migration changes how any existing account
-- behaves: no enforcement, no signup change, no trigger change, no RLS
-- change, no new browser grant. Every existing profile becomes
-- account_status = ACTIVE as part of this same migration (see the backfill
-- note below) — existing accounts keep working exactly as they do today.
--
-- ---------------------------------------------------------------------------
-- Design decision: EXPIRED is DERIVED, never persisted
-- ---------------------------------------------------------------------------
-- account_status has exactly four values: PENDING, ACTIVE, SUSPENDED,
-- DEACTIVATED. There is no EXPIRED value. Effective expiration is a
-- request-time computation once enforcement ships in a later phase:
--
--   effective_state = EXPIRED  when  account_status = 'ACTIVE'
--                                AND access_expires_at IS NOT NULL
--                                AND access_expires_at <= now()
--
-- Persisting EXPIRED as a stored status would create a second, cacheable
-- copy of a fact access_expires_at already tells you, and would need a
-- scheduled job (explicitly out of scope) or careful multi-write
-- synchronization to un-expire a row the moment access is extended —
-- otherwise a row could sit as account_status = 'EXPIRED' with
-- access_expires_at already back in the future, a contradiction with no
-- single owner. Comparing against now() at request time is always correct
-- the instant the timestamp passes, with nothing that can go stale.
--
-- ---------------------------------------------------------------------------
-- role vs. account_status — two different questions
-- ---------------------------------------------------------------------------
-- role answers: "What is this account allowed to do, when it may act at
--   all?" (CLIENT/AGENT/MANAGER/ADMIN — unchanged by this migration.)
-- account_status answers: "May this account use protected application
--   features at all, right now?" Independent of role. Examples:
--     role=MANAGER,  status=ACTIVE     -> normal Manager access
--     role=MANAGER,  status=SUSPENDED  -> no protected access
--     role=CLIENT,   status=PENDING    -> no protected access, despite
--                                         role already reading CLIENT
--     role=AGENT,    status=ACTIVE,
--                    access_expires_at in the past -> effective EXPIRED,
--                                         no protected access once
--                                         enforcement ships
-- No enforcement of any of this exists yet — Phase 3A only adds the columns
-- that will let a later phase implement it.
--
-- ---------------------------------------------------------------------------
-- Backfill guarantee for existing accounts
-- ---------------------------------------------------------------------------
-- account_status is added as `not null default 'ACTIVE'` in a single ALTER
-- TABLE ADD COLUMN statement. Postgres applies that default to every
-- existing row as part of adding the column — every profile that exists
-- before this migration runs becomes account_status = ACTIVE, with no
-- separate UPDATE statement and no window where a row is briefly
-- inconsistent. requested_role, access_expires_at, approved_by, and
-- approved_at are added with no default (NULL for every existing row) —
-- exactly the "not yet requested / not yet expiring / not yet approved by
-- anyone" state that matches reality for accounts that already existed
-- before an approval workflow did. role, manager_id, team_id, full_name are
-- not touched by this migration at all.
--
-- The column default staying ACTIVE (not PENDING) is deliberate for this
-- phase specifically because public.handle_new_user() is NOT modified here
-- — it still creates new profiles with no explicit account_status, so new
-- signups would get the column default too, and that default must keep
-- today's actual behavior (immediately usable) until Phase 3B changes the
-- trigger AND ships the approval UI together. Do not change this default to
-- PENDING before that trigger change lands — doing so earlier would silently
-- lock out every new signup with no Admin approval screen to unblock them.
--
-- ---------------------------------------------------------------------------
-- requested_role
-- ---------------------------------------------------------------------------
-- Reuses the existing public.role enum (no new enum) with a same-row CHECK
-- forbidding 'ADMIN' — ADMIN is never self-requested. This CHECK is a
-- database-level backstop, not the only enforcement layer: the future
-- signup UI should also simply never offer ADMIN as an option, and any
-- server-side write path should validate independently, matching this
-- project's established defense-in-depth pattern (never rely on one layer
-- alone). profiles.role itself stays NOT NULL / default CLIENT, unchanged —
-- no risky nullability migration. A future PENDING account keeps role =
-- CLIENT (the harmless, no-access-implying default) while
-- account_status = PENDING is what actually blocks access once enforcement
-- ships; requested_role separately records what the person actually asked
-- for, for the future Admin approval screen to read and act on.
--
-- ---------------------------------------------------------------------------
-- approved_by / approved_at
-- ---------------------------------------------------------------------------
-- approved_by references profiles(id) ON DELETE SET NULL — same reasoning
-- as manager_id's FK (Phase 2C): if the approving Admin's profile is later
-- deleted (a rare, Admin-only, strongly-confirmed action), historical
-- approval rows must not error, cascade-delete, or vanish. They simply lose
-- the specific reference to WHO approved; approved_at (untouched) still
-- records THAT and WHEN an approval happened.
--
-- Deliberately NO self-reference CHECK (approved_by <> id) at the schema
-- level. approved_by is historical metadata, not an authorization boundary
-- — it is never browser-writable (see Section 6) regardless of any
-- constraint here, so the actual rule "normal users must never self-approve"
-- is, and must remain, enforced by the future trusted Admin-only approval
-- mutation path (Phase 3B+), not by the database forbidding the value
-- outright. Leaving this unconstrained keeps room for a legitimate future
-- self-referential case a hard CHECK would otherwise permanently foreclose
-- — e.g. a break-glass/self-recovery bootstrap flow recording
-- approved_by = id to mean "self-recovered via an automated recovery
-- procedure," which reads more informatively than leaving the column NULL
-- (indistinguishable from "never explicitly approved by anyone"). No CHECK
-- ties approved_by and approved_at together either (e.g. requiring
-- both-or-neither) — both are policy decisions for the future approval
-- mutation logic, not something to lock in at the schema layer before that
-- logic exists.
--
-- ---------------------------------------------------------------------------
-- Manager relationship interaction — NOT implemented, flagged for later
-- ---------------------------------------------------------------------------
-- manager_id is not modified by this migration. Future lifecycle behavior
-- (design only, no code here):
--   - AGENT -> SUSPENDED: manager_id should remain assigned (temporary,
--     reversible; the relationship isn't wrong, just paused).
--   - AGENT -> DEACTIVATED: recommend manager_id ALSO remains assigned
--     unless an Admin explicitly unassigns — a status change should not
--     silently destroy an organizational relationship.
--   - MANAGER -> SUSPENDED or DEACTIVATED while they still have Agents:
--     flagged as an open business-rule decision. Initial recommendation:
--     (C) require explicit reassignment/unassignment before DEACTIVATION
--     (mirrors the existing MANAGER_HAS_AGENTS block already enforced for
--     role changes away from MANAGER in apply_profile_role_change(), Phase
--     2D — the same rule should likely extend to deactivation, not just
--     role changes), and (B) preserve Agents temporarily for SUSPENSION
--     (reversible, short-lived by nature). Not implemented here — this is
--     schema-only.
--
-- ---------------------------------------------------------------------------
-- Legacy structures — still untouched
-- ---------------------------------------------------------------------------
-- profiles.team_id, public.teams, public.team_members, role_change_requests,
-- public.role (the enum), every existing RLS policy, every existing browser
-- grant, and public.handle_new_user() are all unmodified by this migration.
--
-- Rollback (run in this order — a column must stop using an enum type
-- before that type can be dropped):
--   alter table public.profiles drop column if exists approved_at;
--   alter table public.profiles drop column if exists approved_by;
--   alter table public.profiles drop column if exists access_expires_at;
--   alter table public.profiles drop column if exists requested_role;
--   alter table public.profiles drop column if exists account_status;
--   drop type if exists public.account_status;
-- Dropping each column also drops any CHECK constraint or index defined on
-- it — no separate DROP CONSTRAINT/DROP INDEX statements are needed first.

-- ---------------------------------------------------------------------------
-- 1. account_status enum + column
-- ---------------------------------------------------------------------------
-- Note: CREATE TYPE has no IF NOT EXISTS in Postgres — unlike the
-- IF NOT EXISTS-guarded statements below, this one is not safe to run twice.

create type public.account_status as enum ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

alter table public.profiles
  add column if not exists account_status public.account_status not null default 'ACTIVE'::public.account_status;

-- ---------------------------------------------------------------------------
-- 2. requested_role
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists requested_role public.role null;

alter table public.profiles
  add constraint profiles_requested_role_not_admin
  check (requested_role is null or requested_role <> 'ADMIN'::public.role);

-- ---------------------------------------------------------------------------
-- 3. access_expires_at
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists access_expires_at timestamptz null;

-- ---------------------------------------------------------------------------
-- 4. approved_by / approved_at
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists approved_by uuid null;

alter table public.profiles
  add constraint profiles_approved_by_fkey
  foreign key (approved_by)
  references public.profiles (id)
  on delete set null;

-- No self-reference CHECK here by design — see the "approved_by /
-- approved_at" note near the top of this file for why.

alter table public.profiles
  add column if not exists approved_at timestamptz null;

-- ---------------------------------------------------------------------------
-- 5. Indexes — evaluated, not assumed
-- ---------------------------------------------------------------------------
-- account_status: plain (not partial) btree. Low cardinality (4 values) on
-- a currently tiny table means negligible benefit today, but the Admin
-- Accounts UI's planned status tabs/filters (Pending/Active/Suspended/
-- Deactivated) are a concrete, already-described future query shape this
-- directly serves once real signups grow the table — added on that basis,
-- not spontaneously.
create index if not exists profiles_account_status_idx
  on public.profiles (account_status);

-- access_expires_at: partial, matching the same reasoning already used for
-- profiles_manager_id_idx (Phase 2C) — every anticipated query either
-- checks one specific account's expiration (id lookup, index doesn't
-- matter) or lists accounts that actually have an expiration set
-- ("Expiring Soon" in the future Admin UI: access_expires_at IS NOT NULL
-- AND <= now() + interval). Most rows will have NULL (no expiration set),
-- so indexing only the non-null rows is both smaller and sufficient.
create index if not exists profiles_access_expires_at_idx
  on public.profiles (access_expires_at)
  where access_expires_at is not null;

-- requested_role and approved_by/approved_at get no index: each is read
-- per-row (a single profile at a time during Admin review), not bulk-
-- filtered by any query this phase or the next one anticipates. Adding one
-- now would be indexing against a query that doesn't exist yet, on a table
-- currently small enough that a sequential scan costs nothing regardless.

-- ---------------------------------------------------------------------------
-- 6. Write security — confirm nothing here widens browser access
-- ---------------------------------------------------------------------------
-- No GRANT statement in this migration, deliberately. Phase 0B's hardening
-- migration replaced blanket UPDATE on public.profiles for `authenticated`
-- with a column-level allow-list containing only `full_name`. Postgres
-- column-level grants are allow-lists, not deny-lists: none of
-- account_status, requested_role, access_expires_at, approved_by, or
-- approved_at become writable by `anon` or `authenticated` merely by
-- existing — each would need its own explicit
-- `GRANT UPDATE (<column>) ON public.profiles TO authenticated` to become
-- browser-writable, and this migration issues none. All five stay
-- authoritative/server-controlled from the moment they're created, to be
-- mutated only through trusted server/admin routes in a later phase (the
-- same pattern already established for manager_id in Phase 2C/2D). No RLS
-- policy is added, changed, or removed — existing SELECT/UPDATE policies on
-- profiles are untouched, and SELECT access is not broadened.
