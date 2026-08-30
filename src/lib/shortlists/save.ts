// src/lib/shortlists/save.ts
//
// Shared "save unit(s) to one or more shortlists" logic used by the
// Save-to-Shortlist dialog for Availability's card view, table view, and bulk
// "Save selected". Centralized here so the RTO-lookup dedup and the
// snapshot/POST/duplicate-handling logic exists once, not once per call site.
//
// A unit is NOT exclusive to one shortlist — the same physical unit can be
// saved into any number of different shortlists (the DB's uniqueness is scoped
// to (shortlist_id, property_code, tower_code, building_unit), not global), so
// a save operation here is always N units × M selected shortlists.

import { rtoTypeCandidates } from "@/lib/financing";
import type { ShortlistUnit } from "@/lib/shortlists/types";

// Minimal shape any "current inventory row" needs to provide to be saved — a
// subset of /api/availability's enriched row, so callers don't need to import
// Availability's private UnitRow type.
export type SavableUnit = {
  unit_id: string;
  property_code: string;
  tower_code: string;
  building_unit: string;
  ListPrice: number;
  Status: string;
  Type: string;
  GrossAreaSQM: number;
};

type RtoLookup = { eligible: boolean; monthly?: number };

function rtoKeyFor(u: SavableUnit): string {
  return `${u.property_code}::${u.GrossAreaSQM}::${rtoTypeCandidates(u.Type).join("|")}`;
}

// Same candidate-trying loop used by Compare/Computation/the shortlist detail
// page — tries each candidate unit_type in order, first eligible result wins.
async function fetchRtoForUnit(u: SavableUnit): Promise<RtoLookup> {
  const candidates = rtoTypeCandidates(u.Type);
  for (const unit_type of candidates) {
    const qs = new URLSearchParams({
      project_code: u.property_code,
      unit_type,
      area: String(u.GrossAreaSQM || 0),
    });
    try {
      const res = await fetch(`/api/rto-rate?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.eligible) {
        return { eligible: true, monthly: Number(json.monthly_rate) || 0 };
      }
    } catch {
      // try next candidate
    }
  }
  return { eligible: false };
}

export type UnitSnapshotPayload = {
  unit_id: string;
  property_code: string;
  tower_code: string;
  building_unit: string;
  saved_price: number | null;
  saved_status: string | null;
  saved_rto_eligible: boolean;
  saved_rto_rate: number | null;
};

// Resolves the RTO snapshot for every unit being saved, deduplicating identical
// (project, area, type-candidates) lookups so e.g. saving ten 2BR units in the
// same project/tower only triggers one /api/rto-rate round trip, not ten.
export async function buildUnitSnapshots(units: SavableUnit[]): Promise<UnitSnapshotPayload[]> {
  const uniqueByKey = new Map<string, SavableUnit>();
  units.forEach((u) => {
    const key = rtoKeyFor(u);
    if (!uniqueByKey.has(key)) uniqueByKey.set(key, u);
  });

  const rtoByKey = new Map<string, RtoLookup>();
  await Promise.all(
    Array.from(uniqueByKey.entries()).map(async ([key, u]) => {
      rtoByKey.set(key, await fetchRtoForUnit(u));
    })
  );

  return units.map((u) => {
    const rto = rtoByKey.get(rtoKeyFor(u)) ?? { eligible: false };
    return {
      unit_id: u.unit_id,
      property_code: u.property_code,
      tower_code: u.tower_code,
      building_unit: u.building_unit,
      saved_price: Number.isFinite(u.ListPrice) ? u.ListPrice : null,
      saved_status: u.Status ? u.Status : null,
      saved_rto_eligible: rto.eligible,
      saved_rto_rate: rto.eligible ? rto.monthly ?? null : null,
    };
  });
}

export type SaveOutcome = {
  savedUnitIds: string[];
  // Full created rows for each 201 response — gives callers the shortlist_units
  // row id (needed to merge into a MembershipIndex, or to render the row
  // immediately without a refetch) without a second request.
  savedUnits: ShortlistUnit[];
  alreadySavedUnitIds: string[];
  failedUnitIds: string[];
  // Set when a request returns 401/403/404 — processing stops there rather than
  // continuing to hammer an endpoint that just told us to stop.
  fatal?: "unauthorized" | "forbidden" | "not_found";
};

// POSTs each snapshot to the existing /api/shortlists/[id]/units, one at a time
// (not Promise.all) so a bulk save doesn't burst the API and so a fatal
// auth/not-found response can stop the remaining requests cleanly.
export async function saveUnitsToShortlist(
  shortlistId: string,
  snapshots: UnitSnapshotPayload[]
): Promise<SaveOutcome> {
  const outcome: SaveOutcome = { savedUnitIds: [], savedUnits: [], alreadySavedUnitIds: [], failedUnitIds: [] };

  for (const snapshot of snapshots) {
    try {
      const res = await fetch(`/api/shortlists/${shortlistId}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });

      if (res.status === 201) {
        outcome.savedUnitIds.push(snapshot.unit_id);
        const json = await res.json().catch(() => null);
        if (json?.unit) outcome.savedUnits.push(json.unit as ShortlistUnit);
        continue;
      }
      if (res.status === 409) {
        // Same physical unit already saved to this shortlist — not a failure.
        outcome.alreadySavedUnitIds.push(snapshot.unit_id);
        continue;
      }
      if (res.status === 401) {
        outcome.fatal = "unauthorized";
        break;
      }
      if (res.status === 403) {
        outcome.fatal = "forbidden";
        break;
      }
      if (res.status === 404) {
        outcome.fatal = "not_found";
        break;
      }
      outcome.failedUnitIds.push(snapshot.unit_id);
    } catch {
      outcome.failedUnitIds.push(snapshot.unit_id);
    }
  }

  return outcome;
}

export type ShortlistSaveTarget = {
  id: string;
  name: string;
  // Snapshots to actually POST — the caller has already excluded any unit
  // known (from persisted membership data) to already be in this shortlist,
  // so a save never re-POSTs a combination it already knows exists.
  toSave: UnitSnapshotPayload[];
  // unit_ids known (from persisted membership data, not session state) to
  // already be in this shortlist — folded straight into the outcome's
  // alreadySavedUnitIds without a network request.
  alreadyKnownUnitIds: string[];
};

export type PerShortlistOutcome = {
  shortlistId: string;
  shortlistName: string;
  outcome: SaveOutcome;
};

export type MultiShortlistSaveResult = {
  perShortlist: PerShortlistOutcome[];
  // A 401 stops the whole operation — the session is gone, so trying the
  // remaining shortlists would just fail the same way. 403/404 are scoped to
  // the one shortlist that returned them (handled inside this function by
  // folding that shortlist's un-attempted snapshots into its failedUnitIds),
  // and do NOT stop the other selected shortlists from being tried.
  unauthorized: boolean;
};

// A unit is not exclusive to one shortlist — the same physical unit can be
// saved into many different clients' shortlists (uniqueness in the DB is
// scoped per shortlist_id). So a bulk save is N units × M shortlists: every
// selected unit gets saved into every selected shortlist, independently —
// a duplicate (409) in one shortlist has no effect on any other shortlist.
export async function saveUnitsToShortlists(targets: ShortlistSaveTarget[]): Promise<MultiShortlistSaveResult> {
  const perShortlist: PerShortlistOutcome[] = [];
  let unauthorized = false;

  for (const target of targets) {
    const outcome = await saveUnitsToShortlist(target.id, target.toSave);
    // Prepend units the membership lookup already told us are here — the 409
    // path above is now just a race-condition safety net (e.g. saved from
    // another tab moments ago), not the primary duplicate check.
    outcome.alreadySavedUnitIds = [...target.alreadyKnownUnitIds, ...outcome.alreadySavedUnitIds];

    if (outcome.fatal === "forbidden" || outcome.fatal === "not_found") {
      // saveUnitsToShortlist stops mid-list on a fatal response — whatever
      // snapshots it never got to for THIS shortlist count as failed for THIS
      // shortlist (not "unknown"), so the totals below always add up to
      // target.toSave.length + target.alreadyKnownUnitIds.length per shortlist.
      const accountedFor = new Set([
        ...outcome.savedUnitIds,
        ...outcome.alreadySavedUnitIds,
        ...outcome.failedUnitIds,
      ]);
      target.toSave.forEach((s) => {
        if (!accountedFor.has(s.unit_id)) outcome.failedUnitIds.push(s.unit_id);
      });
    }

    perShortlist.push({ shortlistId: target.id, shortlistName: target.name, outcome });

    if (outcome.fatal === "unauthorized") {
      unauthorized = true;
      break;
    }
  }

  return { perShortlist, unauthorized };
}

// Understandable wording over exposing raw request counts. Covers:
//   "Saved to Santos Family"                    (1 unit  × 1 shortlist,  all new)
//   "Saved to 2 shortlists"                      (1 unit  × N shortlists, all new)
//   "3 units saved to Santos Family"             (M units × 1 shortlist,  all new)
//   "3 units saved to 2 shortlists"              (M units × N shortlists, all new)
//   "4 saved, 2 already saved"                   (any mix of new + duplicate)
//   "Already saved"                              (every attempt was a duplicate)
// A trailing ". K failed — please try again." is appended whenever any
// (unit, shortlist) attempt failed for a reason other than a duplicate.
export function summarizeMultiSave(perShortlist: PerShortlistOutcome[], unitCount: number): string {
  const savedCount = perShortlist.reduce((n, p) => n + p.outcome.savedUnitIds.length, 0);
  const alreadyCount = perShortlist.reduce((n, p) => n + p.outcome.alreadySavedUnitIds.length, 0);
  const failedCount = perShortlist.reduce((n, p) => n + p.outcome.failedUnitIds.length, 0);
  const shortlistCount = perShortlist.length;

  let base: string;
  if (savedCount > 0 && alreadyCount === 0) {
    if (shortlistCount === 1) {
      const name = perShortlist[0].shortlistName;
      base = unitCount === 1 ? `Saved to ${name}` : `${unitCount} units saved to ${name}`;
    } else {
      base = unitCount === 1 ? `Saved to ${shortlistCount} shortlists` : `${unitCount} units saved to ${shortlistCount} shortlists`;
    }
  } else if (savedCount > 0 && alreadyCount > 0) {
    base = `${savedCount} saved, ${alreadyCount} already saved`;
  } else if (savedCount === 0 && alreadyCount > 0) {
    base = "Already saved";
  } else {
    base = "Nothing was saved";
  }

  return failedCount > 0 ? `${base}. ${failedCount} failed — please try again.` : base;
}

export type RemovalTarget = { shortlistId: string; shortlistUnitId: string };

export type RemoveOutcome = {
  removedShortlistIds: string[];
  failedShortlistIds: string[];
  fatal?: "unauthorized" | "forbidden";
};

// Removes one unit's membership from each given shortlist via the existing
// DELETE /api/shortlists/[id]/units/[shortlistUnitId] — used only by the
// single-unit Save/Saved dialog's explicit "Save Changes" action, never
// automatically and never for bulk-selected units (bulk stays add-only).
export async function removeUnitFromShortlists(removals: RemovalTarget[]): Promise<RemoveOutcome> {
  const outcome: RemoveOutcome = { removedShortlistIds: [], failedShortlistIds: [] };

  for (const { shortlistId, shortlistUnitId } of removals) {
    try {
      const res = await fetch(`/api/shortlists/${shortlistId}/units/${shortlistUnitId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        outcome.removedShortlistIds.push(shortlistId);
        continue;
      }
      if (res.status === 404) {
        // Already gone (e.g. removed from Shortlist Detail moments ago) —
        // that's the outcome the seller wanted, not a failure.
        outcome.removedShortlistIds.push(shortlistId);
        continue;
      }
      if (res.status === 401) {
        outcome.fatal = "unauthorized";
        break;
      }
      if (res.status === 403) {
        outcome.fatal = "forbidden";
        break;
      }
      outcome.failedShortlistIds.push(shortlistId);
    } catch {
      outcome.failedShortlistIds.push(shortlistId);
    }
  }

  return outcome;
}

// Wording for the single-unit membership-edit flow (adds AND removes in one
// "Save Changes" action), distinct from summarizeMultiSave's add-only wording.
export function summarizeMembershipEdit(addedNames: string[], removedNames: string[], failedCount: number): string {
  const parts: string[] = [];
  if (addedNames.length === 1) parts.push(`Added to ${addedNames[0]}`);
  else if (addedNames.length > 1) parts.push(`Added to ${addedNames.length} shortlists`);

  if (removedNames.length === 1) parts.push(`Removed from ${removedNames[0]}`);
  else if (removedNames.length > 1) parts.push(`Removed from ${removedNames.length} shortlists`);

  let base = parts.length > 0 ? `${parts.join(". ")}.` : "No changes made.";
  if (failedCount > 0) {
    base += ` ${failedCount} change${failedCount === 1 ? "" : "s"} failed — please try again.`;
  }
  return base;
}
