-- supabase/migrations/20260829000000_client_shortlists.sql
--
-- Client Shortlists feature — schema + RLS only.
-- Not yet applied to any environment. Review before running.
--
-- Scope (per product plan, approved 2026-08-29; RLS/uniqueness revised same day):
--   * Shortlists are private to the seller (owner) who created them.
--   * Sellers = AGENT, MANAGER, ADMIN roles (profiles.role). CLIENT is excluded —
--     both at the app/middleware layer AND here in RLS, on every operation
--     (SELECT/INSERT/UPDATE/DELETE), so a role downgrade to CLIENT immediately
--     revokes direct Supabase access to previously-owned rows, not just new writes.
--   * No MANAGER/ADMIN override to view another seller's shortlist in v1 — the
--     policies below check owner_id = auth.uid() with no role-based bypass.
--   * Current inventory stays authoritative via /api/availability — these tables
--     only store ownership, saved unit identifiers/notes, and a point-in-time
--     snapshot (price/status/RTO) captured when a unit was saved. No units/
--     inventory mirror table is created.
--
-- Rollback (run in this order if this migration needs to be reverted):
--   drop policy if exists shortlist_units_owner_all on public.shortlist_units;
--   drop index if exists public.shortlist_units_shortlist_unit_identity_idx;
--   drop table if exists public.shortlist_units;
--   drop policy if exists client_shortlists_owner_all on public.client_shortlists;
--   drop trigger if exists set_client_shortlists_updated_at on public.client_shortlists;
--   drop function if exists public.touch_client_shortlists_updated_at();
--   drop table if exists public.client_shortlists;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- client_shortlists
-- ---------------------------------------------------------------------------

create table if not exists public.client_shortlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_shortlists_owner_id_idx
  on public.client_shortlists (owner_id);

create or replace function public.touch_client_shortlists_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_client_shortlists_updated_at on public.client_shortlists;
create trigger set_client_shortlists_updated_at
  before update on public.client_shortlists
  for each row
  execute function public.touch_client_shortlists_updated_at();

alter table public.client_shortlists enable row level security;

-- Owner-only, seller-role-only, on every operation. The role check is repeated in
-- both USING (gates SELECT/UPDATE/DELETE) and WITH CHECK (gates INSERT/UPDATE) so
-- that a profile whose role is later changed to CLIENT immediately loses read,
-- update, and delete access to shortlists it created while it was a seller —
-- not just the ability to create new ones.
drop policy if exists client_shortlists_owner_all on public.client_shortlists;
create policy client_shortlists_owner_all
  on public.client_shortlists
  for all
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('AGENT', 'MANAGER', 'ADMIN')
    )
  )
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('AGENT', 'MANAGER', 'ADMIN')
    )
  );

-- ---------------------------------------------------------------------------
-- shortlist_units
-- ---------------------------------------------------------------------------

create table if not exists public.shortlist_units (
  id uuid primary key default gen_random_uuid(),
  shortlist_id uuid not null references public.client_shortlists(id) on delete cascade,

  -- Opaque canonical/legacy unit id from src/lib/unit-id.ts (property_code__tower_code__building_unit).
  -- Kept for routing/matching (e.g. linking straight into /computation/[unitID]) via
  -- matchesLegacyOrCanonical() at read time. Not a foreign key — no `units` table exists;
  -- current inventory lives in Google Sheets and is fetched fresh via /api/availability.
  -- Not used for uniqueness below, since the same physical unit can resolve to different
  -- unit_id strings across canonical vs. legacy formats.
  unit_id text not null,

  -- Required identity parts for every newly saved unit. Together with shortlist_id these
  -- are the uniqueness key (see index below), so the same physical unit can't be saved
  -- twice into one shortlist under different unit_id formats.
  property_code text not null,
  tower_code text not null,
  building_unit text not null,

  -- Point-in-time snapshot captured when the unit was saved, used to compare saved-vs-current.
  -- Never refreshed in place — current values are re-fetched from /api/availability at read time.
  saved_price numeric,
  saved_status text,
  saved_rto_eligible boolean,
  saved_rto_rate numeric,

  notes text,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists shortlist_units_shortlist_id_idx
  on public.shortlist_units (shortlist_id);

-- Physical-unit identity uniqueness per shortlist — deliberately NOT on unit_id, since
-- the app resolves both canonical and legacy unit_id formats to the same physical unit.
create unique index if not exists shortlist_units_shortlist_unit_identity_idx
  on public.shortlist_units (shortlist_id, property_code, tower_code, building_unit);

alter table public.shortlist_units enable row level security;

-- Access follows the parent shortlist's ownership plus the same seller-role check as
-- client_shortlists, applied in both USING and WITH CHECK for the same reason: a role
-- downgrade to CLIENT must immediately revoke SELECT/UPDATE/DELETE on existing rows,
-- not just block new INSERTs. No separate owner_id column is needed on this table.
drop policy if exists shortlist_units_owner_all on public.shortlist_units;
create policy shortlist_units_owner_all
  on public.shortlist_units
  for all
  using (
    exists (
      select 1 from public.client_shortlists cs
      where cs.id = shortlist_units.shortlist_id
        and cs.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('AGENT', 'MANAGER', 'ADMIN')
    )
  )
  with check (
    exists (
      select 1 from public.client_shortlists cs
      where cs.id = shortlist_units.shortlist_id
        and cs.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('AGENT', 'MANAGER', 'ADMIN')
    )
  );
