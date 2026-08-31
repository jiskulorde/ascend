-- supabase/migrations/20260831030000_manager_relationship_functions.sql
--
-- Phase 2D — Trusted Manager assignment + role-transition foundation.
-- NOT applied to any environment yet. Review before running.
--
-- Adds two narrow, single-purpose Postgres functions. Neither is reachable
-- from the browser (see the REVOKE/GRANT section at the bottom) — both are
-- meant to be called exclusively via the service-role client
-- (adminSupabase()) from trusted server-side Route Handlers that have
-- already authenticated the caller and checked their profiles.role
-- themselves. These functions are mechanism, not policy: they do not decide
-- whether the caller is allowed to invoke them — the calling route does.
-- Their only job is to keep the manager_id/role invariants correct and
-- race-free at the database layer, where PostgREST's plain filter-based
-- .update() cannot express what's needed (see the audit note below).
--
-- ---------------------------------------------------------------------------
-- Part A audit finding: why a DB function is required, not two REST calls
-- ---------------------------------------------------------------------------
-- The desired Admin/Manager assignment operation needs a single atomic
-- statement that: (1) locks and validates the target Agent row, (2) when a
-- new manager is given, locks and validates that IT references a row whose
-- role is MANAGER, and (3) for a Manager's own "claim" action, re-checks
-- that the Agent is still unassigned at the moment of the write, not at the
-- moment of an earlier read.
--
-- Supabase's PostgREST-backed .update()/.eq()/.is() filter chain can only
-- express same-row, column-level predicates on the table being updated
-- (e.g. ".eq('role','AGENT').is('manager_id', null)" compiles to a single
-- "UPDATE profiles SET ... WHERE role='AGENT' AND manager_id IS NULL" — that
-- part IS atomic and requires no function). It CANNOT express a condition
-- that depends on a DIFFERENT row (here: "does profiles.id = $manager_id
-- have role = 'MANAGER'?") inside that same conditional update — there is no
-- EXISTS()/subquery hook in the query-builder filter API. Splitting that
-- into "SELECT the manager's role, then UPDATE the agent" is exactly the
-- unsafe two-call pattern the brief warned against: the manager's role (or
-- the agent's assignment state) can change in the gap between the two
-- requests, and nothing about issuing them from Next.js makes them atomic
-- with each other. A narrow SQL function that does both checks and the
-- write inside one Postgres transaction is the only way to close that gap.
--
-- ---------------------------------------------------------------------------
-- Part H concurrency analysis: the race this design closes
-- ---------------------------------------------------------------------------
-- Race scenario: a Manager M currently has zero Agents. At the same moment,
-- (a) an Admin demotes M away from MANAGER, and (b) another operation
-- assigns some Agent A to M. Depending on ordering, this could leave
-- Agent A with manager_id pointing at a profile that is no longer a
-- MANAGER — an invalid state the FK alone cannot prevent (FK only checks
-- that the row exists, never its role).
--
-- Both functions below close this by taking a `SELECT ... FOR UPDATE` row
-- lock on M's own profiles row before doing anything else that depends on
-- M's current role or dependent-Agent count:
--   * apply_profile_role_change() locks the profile being role-changed
--     (M, in this scenario) as its very first step, before checking
--     whether M currently has assigned Agents.
--   * set_agent_manager() locks the target manager row (M) before checking
--     that its role is still MANAGER, whenever a non-null manager_id is
--     being assigned.
-- Because both functions lock the SAME row (M's own profiles row) before
-- reading or depending on its role, Postgres's standard row-level locking
-- serializes them against each other automatically: whichever transaction
-- starts first holds the lock until it commits or rolls back; the other
-- blocks and, once unblocked, re-reads the now-committed, up-to-date state.
-- There is no window where both can proceed against a stale view of M's
-- role. No deadlock is possible between the two functions either —
-- apply_profile_role_change() only ever acquires one row lock (the profile
-- being changed), so it can never be "holding X while waiting for Y" in a
-- way that could cycle with set_agent_manager()'s (agent row, then manager
-- row) locking order.
--
-- ---------------------------------------------------------------------------
-- Legacy team scaffolding — still untouched
-- ---------------------------------------------------------------------------
-- profiles.team_id, public.teams, public.team_members are not referenced by
-- either function. manager_id remains the sole authoritative Agent->Manager
-- relationship, per Phase 2C.
--
-- Rollback (safe — purely additive; drops both functions and nothing else):
--   drop function if exists public.set_agent_manager(uuid, uuid, boolean);
--   drop function if exists public.apply_profile_role_change(uuid, public.role);

-- ---------------------------------------------------------------------------
-- 1. set_agent_manager — the sole write path for profiles.manager_id
-- ---------------------------------------------------------------------------
--
-- Inputs:
--   p_agent_id           the Agent whose manager_id is being set
--   p_manager_id          the new manager (NULL to unassign)
--   p_require_unassigned  true for a Manager "claim" (fails if the Agent is
--                         already assigned to anyone); false for an Admin
--                         assign/reassign/unassign (may overwrite an
--                         existing assignment)
--
-- Returns exactly one row. `status` distinguishes every outcome the caller
-- needs to translate into a clean HTTP response:
--   OK                  — manager_id updated as requested
--   AGENT_NOT_FOUND      — p_agent_id does not reference an existing profile
--   AGENT_INVALID_ROLE   — that profile's role is not AGENT
--   SELF_ASSIGN          — p_manager_id = p_agent_id
--   ALREADY_ASSIGNED      — p_require_unassigned was true and the Agent
--                          already has a manager_id (race loss, or stale
--                          UI state)
--   MANAGER_NOT_FOUND     — p_manager_id does not reference an existing
--                          profile
--   MANAGER_INVALID_ROLE  — that profile's role is not MANAGER
--
-- No exceptions are raised for any of these — they are expected, named
-- outcomes returned as data, so the calling route can map them to specific
-- HTTP statuses without ever forwarding a raw Postgres error message to the
-- browser.

create or replace function public.set_agent_manager(
  p_agent_id uuid,
  p_manager_id uuid,
  p_require_unassigned boolean default false
)
returns table (
  status text,
  agent_id uuid,
  assigned_manager_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agent_role public.role;
  v_agent_current_manager_id uuid;
  v_manager_role public.role;
begin
  if p_agent_id is null then
    return query select 'AGENT_NOT_FOUND'::text, p_agent_id, p_manager_id;
    return;
  end if;

  if p_manager_id is not null and p_manager_id = p_agent_id then
    return query select 'SELF_ASSIGN'::text, p_agent_id, p_manager_id;
    return;
  end if;

  -- Lock the Agent row first. This is what makes two concurrent claims for
  -- the same Agent race-safe (Part K): the second caller's lock acquisition
  -- blocks until the first transaction commits, then re-reads the
  -- now-current manager_id rather than acting on stale data.
  select role, manager_id
    into v_agent_role, v_agent_current_manager_id
  from public.profiles
  where id = p_agent_id
  for update;

  if not found then
    return query select 'AGENT_NOT_FOUND'::text, p_agent_id, p_manager_id;
    return;
  end if;

  if v_agent_role <> 'AGENT'::public.role then
    return query select 'AGENT_INVALID_ROLE'::text, p_agent_id, p_manager_id;
    return;
  end if;

  if p_require_unassigned and v_agent_current_manager_id is not null then
    return query select 'ALREADY_ASSIGNED'::text, p_agent_id, v_agent_current_manager_id;
    return;
  end if;

  if p_manager_id is not null then
    -- Lock the manager row too — the shared serialization point against a
    -- concurrent apply_profile_role_change() demoting this same manager
    -- (see the Part H analysis above).
    select role
      into v_manager_role
    from public.profiles
    where id = p_manager_id
    for update;

    if not found then
      return query select 'MANAGER_NOT_FOUND'::text, p_agent_id, p_manager_id;
      return;
    end if;

    if v_manager_role <> 'MANAGER'::public.role then
      return query select 'MANAGER_INVALID_ROLE'::text, p_agent_id, p_manager_id;
      return;
    end if;
  end if;

  update public.profiles
  set manager_id = p_manager_id
  where id = p_agent_id;

  return query select 'OK'::text, p_agent_id, p_manager_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. apply_profile_role_change — centralized role-transition logic
-- ---------------------------------------------------------------------------
--
-- Enforces, in one atomic statement per outcome:
--   * Leaving AGENT clears manager_id in the SAME update (never a separate
--     one afterward — profiles_manager_requires_agent_role would reject a
--     two-step version anyway, this just does it correctly and explicitly).
--   * Leaving MANAGER while Agents are still assigned is BLOCKED, not
--     auto-unassigned — the caller gets back the current Agent count so it
--     can show e.g. "This Manager still has N assigned Agents. Reassign or
--     unassign them before changing the role."
--   * AGENT -> AGENT and CLIENT/ADMIN -> AGENT leave manager_id exactly as
--     it was (NULL in the CLIENT/ADMIN case, since only AGENT rows can hold
--     a non-null manager_id per the existing CHECK constraint).
--
-- Returns exactly one row:
--   status                 OK | PROFILE_NOT_FOUND | MANAGER_HAS_AGENTS
--   profile_id
--   new_role                the role actually applied (OK) or the
--                           unchanged current role (MANAGER_HAS_AGENTS)
--   assigned_manager_id     the resulting manager_id (OK only)
--   blocked_agent_count     > 0 only when status = MANAGER_HAS_AGENTS

create or replace function public.apply_profile_role_change(
  p_profile_id uuid,
  p_new_role public.role
)
returns table (
  status text,
  profile_id uuid,
  new_role public.role,
  assigned_manager_id uuid,
  blocked_agent_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_role public.role;
  v_current_manager_id uuid;
  v_agent_count integer;
  v_next_manager_id uuid;
begin
  if p_profile_id is null then
    return query select 'PROFILE_NOT_FOUND'::text, p_profile_id, null::public.role, null::uuid, 0;
    return;
  end if;

  -- Lock this profile row before reading its role or dependent-Agent count
  -- — see the Part H analysis above for why this specific lock is what
  -- prevents a concurrent set_agent_manager() call from racing a demotion.
  select role, manager_id
    into v_current_role, v_current_manager_id
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    return query select 'PROFILE_NOT_FOUND'::text, p_profile_id, null::public.role, null::uuid, 0;
    return;
  end if;

  if v_current_role = 'MANAGER'::public.role and p_new_role <> 'MANAGER'::public.role then
    select count(*)
      into v_agent_count
    from public.profiles
    where manager_id = p_profile_id;

    if v_agent_count > 0 then
      return query select 'MANAGER_HAS_AGENTS'::text, p_profile_id, v_current_role, null::uuid, v_agent_count;
      return;
    end if;
  end if;

  v_next_manager_id := case
    when p_new_role <> 'AGENT'::public.role then null
    else v_current_manager_id
  end;

  update public.profiles
  set role = p_new_role,
      manager_id = v_next_manager_id
  where id = p_profile_id;

  return query select 'OK'::text, p_profile_id, p_new_role, v_next_manager_id, 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Permissions — critical: functions are PUBLIC-executable by default
-- ---------------------------------------------------------------------------
--
-- Postgres grants EXECUTE on a newly created function to PUBLIC unless
-- explicitly revoked, and Supabase's `anon`/`authenticated` roles inherit
-- from PUBLIC — meaning without the revokes below, both functions would be
-- callable directly by any browser session via PostgREST's
-- `/rest/v1/rpc/<function_name>` endpoint, completely bypassing the
-- ADMIN/MANAGER authorization that's supposed to live in the calling Route
-- Handler. SECURITY DEFINER makes this worse, not better, if left
-- unrevoked: it would let an unprivileged caller reassign ANY Agent's
-- manager or change ANY profile's role. Only service_role may execute
-- either function — every real caller goes through a trusted server route
-- that has already authenticated the user and checked their profiles.role.

revoke all on function public.set_agent_manager(uuid, uuid, boolean) from public;
revoke all on function public.set_agent_manager(uuid, uuid, boolean) from anon;
revoke all on function public.set_agent_manager(uuid, uuid, boolean) from authenticated;
grant execute on function public.set_agent_manager(uuid, uuid, boolean) to service_role;

revoke all on function public.apply_profile_role_change(uuid, public.role) from public;
revoke all on function public.apply_profile_role_change(uuid, public.role) from anon;
revoke all on function public.apply_profile_role_change(uuid, public.role) from authenticated;
grant execute on function public.apply_profile_role_change(uuid, public.role) to service_role;
