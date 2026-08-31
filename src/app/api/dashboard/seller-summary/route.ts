// src/app/api/dashboard/seller-summary/route.ts

import { NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";
import { requireSellerSession } from "@/lib/shortlists/authz";
import { serverError } from "@/lib/shortlists/errors";
import { loadAvailabilityInventory, type AvailabilityRow } from "@/lib/availability/inventory";
import { matchesLegacyOrCanonical } from "@/lib/unit-id";
import type {
  AttentionChange,
  AttentionItem,
  SellerSummaryResponse,
  ShortlistSummary,
} from "@/lib/dashboard/types";

// GET /api/dashboard/seller-summary — read-only, dashboard-oriented rollup of
// the caller's OWN client shortlists (AGENT/MANAGER/ADMIN only, via
// requireSellerSession + RLS — no adminSupabase/service-role anywhere here).
//
// Built specifically to avoid the N+1 a naive dashboard would fall into (one
// GET /api/shortlists/[id] per shortlist card): this does exactly
//   1 query  -> client_shortlists (the caller's own, RLS-scoped)
//   1 query  -> shortlist_units across ALL of those shortlists at once
//   1 load   -> loadAvailabilityInventory() (same loader GET /api/availability
//               and GET /api/availability/preview already use)
// and does unit-count / price / status / missing-from-inventory comparison
// entirely in memory, reusing the exact physical-unit matching
// (matchesLegacyOrCanonical) already used by the Shortlist Detail page.
//
// The inventory load is best-effort: if it fails, shortlist/unit counts (DB
// data) are still returned so the dashboard doesn't fully break — only
// attention/inventory sections degrade to "unavailable", never to a
// fabricated "0 changes".

const MAX_ATTENTION_ITEMS = 8;

function isAvailableStatus(status: string) {
  return String(status || "").toLowerCase().startsWith("avail");
}

function propertyLabel(
  current: AvailabilityRow | undefined,
  saved: { property_code: string; building_unit: string }
): string {
  if (current) return `${current.property_name || current.property_code} • ${current.BuildingUnit}`;
  return `${saved.property_code} • ${saved.building_unit}`;
}

export async function GET() {
  const supabase = await actionSupabase();
  const authz = await requireSellerSession(supabase);
  if (!authz.ok) return authz.response;

  // Query 1 — the caller's own shortlists only (RLS: owner_id = auth.uid()).
  const { data: shortlistRows, error: shortlistsError } = await supabase
    .from("client_shortlists")
    .select("id, name, notes, updated_at")
    .eq("owner_id", authz.userId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (shortlistsError) {
    return serverError("GET /api/dashboard/seller-summary shortlists", shortlistsError);
  }

  const shortlists = shortlistRows ?? [];
  const shortlistNameById = new Map(shortlists.map((s) => [s.id, s.name] as const));
  const shortlistIds = shortlists.map((s) => s.id);

  // Query 2 — every shortlist_units row across those shortlists, one query.
  // RLS already scopes shortlist_units to shortlists the caller owns (see
  // GET /api/shortlists/membership for the same "one query, RLS-only filter"
  // pattern); .in(shortlist_id) here is a cheap, explicit extra bound on top
  // of that, and lets us skip the query entirely when there are no shortlists.
  let units: {
    id: string;
    shortlist_id: string;
    property_code: string;
    tower_code: string;
    building_unit: string;
    unit_id: string;
    saved_price: number | null;
    saved_status: string | null;
    saved_at: string;
  }[] = [];

  if (shortlistIds.length > 0) {
    const { data: unitRows, error: unitsError } = await supabase
      .from("shortlist_units")
      .select(
        "id, shortlist_id, property_code, tower_code, building_unit, unit_id, saved_price, saved_status, saved_at"
      )
      .in("shortlist_id", shortlistIds)
      .order("saved_at", { ascending: false })
      .order("id", { ascending: false });

    if (unitsError) {
      return serverError("GET /api/dashboard/seller-summary units", unitsError);
    }
    units = unitRows ?? [];
  }

  // unit_count is DB-only data — always available regardless of inventory load.
  const unitCountByShortlist = new Map<string, number>();
  units.forEach((u) => {
    unitCountByShortlist.set(u.shortlist_id, (unitCountByShortlist.get(u.shortlist_id) || 0) + 1);
  });

  // The one inventory load, reused for both attention-matching and the
  // Inventory Snapshot section below — never loaded twice.
  let availabilityRows: AvailabilityRow[] = [];
  let latestLog: SellerSummaryResponse["inventory"]["latestLog"] = null;
  let inventoryAvailable = true;
  try {
    const inv = await loadAvailabilityInventory();
    availabilityRows = inv.data;
    latestLog = inv.latestLog;
  } catch (error) {
    console.error("[dashboard] seller-summary inventory load failed", error);
    inventoryAvailable = false;
  }

  const attentionCountByShortlist = new Map<string, number>();
  const attentionItems: AttentionItem[] = [];
  let attentionTotalCount = 0;

  if (inventoryAvailable) {
    units.forEach((u) => {
      const current = availabilityRows.find((r) =>
        matchesLegacyOrCanonical(
          { property_code: r.property_code, tower_code: r.tower_code, building_unit: r.BuildingUnit },
          u.unit_id
        )
      );

      const changes: AttentionChange[] = [];
      const missing = !current;

      if (current) {
        if (u.saved_price != null && Number(u.saved_price) !== current.ListPrice) {
          changes.push({
            kind: "PRICE_CHANGED",
            saved_price: u.saved_price,
            current_price: current.ListPrice,
          });
        }

        const savedStatus = (u.saved_status || "").trim();
        const currentStatus = (current.Status || "").trim();
        if (savedStatus && currentStatus && savedStatus.toLowerCase() !== currentStatus.toLowerCase()) {
          changes.push({
            kind: "STATUS_CHANGED",
            saved_status: u.saved_status,
            current_status: current.Status,
          });
        }
      }

      if (!missing && changes.length === 0) return; // nothing to flag for this unit

      attentionTotalCount += 1;
      attentionCountByShortlist.set(u.shortlist_id, (attentionCountByShortlist.get(u.shortlist_id) || 0) + 1);

      if (attentionItems.length < MAX_ATTENTION_ITEMS) {
        attentionItems.push({
          shortlist_unit_id: u.id,
          shortlist_id: u.shortlist_id,
          shortlist_name: shortlistNameById.get(u.shortlist_id) || "Shortlist",
          property_label: propertyLabel(current, u),
          status: missing ? "missing" : "changed",
          changes,
          saved_price: u.saved_price,
          saved_status: u.saved_status,
        });
      }
    });
  }

  const shortlistSummaries: ShortlistSummary[] = shortlists.map((s) => ({
    id: s.id,
    name: s.name,
    notes: s.notes,
    updated_at: s.updated_at,
    unit_count: unitCountByShortlist.get(s.id) || 0,
    attention_count: inventoryAvailable ? attentionCountByShortlist.get(s.id) || 0 : null,
  }));

  const availableUnitCount = inventoryAvailable
    ? availabilityRows.filter((r) => isAvailableStatus(r.Status)).length
    : null;

  const response: SellerSummaryResponse = {
    success: true,
    shortlists: shortlistSummaries,
    attention: {
      available: inventoryAvailable,
      items: attentionItems,
      totalCount: attentionTotalCount,
    },
    inventory: {
      available: inventoryAvailable,
      availableUnitCount,
      latestLog,
    },
  };

  return NextResponse.json(response);
}
