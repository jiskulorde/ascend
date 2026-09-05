// src/lib/shortlists/membership.ts
//
// Client-side helpers for reading persisted shortlist membership from
// GET /api/shortlists/membership — which of the seller's shortlists a given
// physical unit already belongs to, and the shortlist_units row id for each
// membership (needed to DELETE one). This is the single source of truth for
// "is this unit saved, and where" — never inferred from session-only state,
// so it stays correct across page refreshes, logout/login, and later visits.

export type UnitMembershipRow = {
  id: string;
  shortlist_id: string;
  property_code: string;
  tower_code: string;
  building_unit: string;
};

// Physical identity, not unit_id — a saved row's unit_id may be an older
// canonical/legacy format than what /api/availability returns today for the
// same physical unit.
export type UnitIdentity = {
  property_code: string;
  tower_code: string;
  building_unit: string;
};

// key -> shortlist_id -> shortlist_units.id (the row DELETE needs).
export type MembershipIndex = Map<string, Map<string, string>>;

export function membershipKey(u: UnitIdentity): string {
  return `${u.property_code}|${u.tower_code}|${u.building_unit}`;
}

export function buildMembershipIndex(rows: UnitMembershipRow[]): MembershipIndex {
  const index: MembershipIndex = new Map();
  rows.forEach((row) => {
    const key = membershipKey(row);
    let inner = index.get(key);
    if (!inner) {
      inner = new Map();
      index.set(key, inner);
    }
    inner.set(row.shortlist_id, row.id);
  });
  return index;
}

// Returns null on any failure (401/403/network) — callers should treat null as
// "unknown" (fall back to a neutral display) rather than "zero memberships".
export async function fetchMembershipIndex(): Promise<MembershipIndex | null> {
  try {
    const res = await fetch("/api/shortlists/membership", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const rows: UnitMembershipRow[] = Array.isArray(json.memberships) ? json.memberships : [];
    return buildMembershipIndex(rows);
  } catch {
    return null;
  }
}

export function shortlistIdsFor(index: MembershipIndex | null, u: UnitIdentity): Set<string> {
  if (!index) return new Set();
  const inner = index.get(membershipKey(u));
  return inner ? new Set(inner.keys()) : new Set();
}

// The shortlist_units row id for one (unit, shortlist) membership, if it exists.
export function shortlistUnitIdFor(
  index: MembershipIndex | null,
  u: UnitIdentity,
  shortlistId: string
): string | undefined {
  if (!index) return undefined;
  return index.get(membershipKey(u))?.get(shortlistId);
}

function cloneIndex(index: MembershipIndex | null): MembershipIndex {
  const next: MembershipIndex = new Map();
  (index ?? new Map()).forEach((inner, key) => next.set(key, new Map(inner)));
  return next;
}

// Merges newly-confirmed (unit, shortlist) memberships into an existing index
// without a refetch — used right after a successful save so badges/checkboxes
// update immediately.
export function mergeMembership(
  index: MembershipIndex | null,
  entries: Array<UnitIdentity & { shortlist_id: string; shortlist_unit_id: string }>
): MembershipIndex {
  const next = cloneIndex(index);
  entries.forEach((entry) => {
    const key = membershipKey(entry);
    let inner = next.get(key);
    if (!inner) {
      inner = new Map();
      next.set(key, inner);
    }
    inner.set(entry.shortlist_id, entry.shortlist_unit_id);
  });
  return next;
}

// Removes specific (unit, shortlist) memberships from an existing index without
// a refetch — used right after a successful removal so the count/checkboxes
// update immediately.
export function removeMembership(
  index: MembershipIndex | null,
  entries: Array<UnitIdentity & { shortlist_id: string }>
): MembershipIndex {
  const next = cloneIndex(index);
  entries.forEach((entry) => {
    const inner = next.get(membershipKey(entry));
    inner?.delete(entry.shortlist_id);
  });
  return next;
}
