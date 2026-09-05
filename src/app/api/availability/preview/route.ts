// src/app/api/availability/preview/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  loadAvailabilityInventory,
  type AvailabilityRow,
} from "@/lib/availability/inventory";

// Public, unauthenticated preview of current inventory. Deliberately far more
// restrictive than GET /api/availability (which now requires a session):
//
//   - fixed page size, hard-capped page count -> at most 36 rows ever, no
//     matter what `page`/`limit` a caller sends (see PAGE_SIZE/MAX_PAGES below)
//   - only Project / City / Unit Type filters are honored — no status,
//     amenities, facing, floor, size, or budget filtering like the seller UI
//   - only marketing-safe fields are returned per row (see PreviewRow below);
//     exact BuildingUnit, tower/property codes, per-sqm price, and the
//     canonical unit_id are withheld — those exist to route into
//     Save/Compare/Compute, none of which are available to anonymous users
//   - only currently-available units are shown (on-hold/sold inventory is a
//     seller-facing detail, not public marketing content)
//
// Reuses the exact same Google Sheets + Supabase enrichment logic as the
// authenticated endpoint via loadAvailabilityInventory() — no duplicated
// inventory/enrichment implementation, no change to the underlying data.
const PAGE_SIZE = 12;
const MAX_PAGES = 3;

type PreviewRow = {
  property_name: string;
  city: string;
  tower_name: string;
  Type: string;
  Floor: string;
  GrossAreaSQM: number;
  Facing: string;
  RFODate: string;
  Status: string;
  ListPrice: number;
  Amenities: string;
};

function isAvailableStatus(status: string) {
  return String(status || "").toLowerCase().startsWith("avail");
}

function toPreviewRow(u: AvailabilityRow): PreviewRow {
  return {
    property_name: u.property_name,
    city: u.city,
    tower_name: u.tower_name,
    Type: u.Type,
    Floor: u.Floor,
    GrossAreaSQM: u.GrossAreaSQM,
    Facing: u.Facing,
    RFODate: u.RFODate,
    Status: u.Status,
    ListPrice: u.ListPrice,
    Amenities: u.Amenities,
  };
}

function distinctSorted(values: (string | undefined | null)[]) {
  return Array.from(new Set(values.map((v) => (v || "").trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Only Project / City / Unit Type are accepted — anything else a caller
    // sends (status, floor, budget, etc.) is silently ignored, not honored.
    const projectParam = (searchParams.get("project") || "").trim().toLowerCase();
    const cityParam = (searchParams.get("city") || "").trim().toLowerCase();
    const typeParam = (searchParams.get("type") || "").trim().toLowerCase();

    // `limit` is intentionally never read from the query string — page size
    // is fixed server-side so a caller cannot request limit=10000.
    const rawPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(rawPage)
      ? Math.min(MAX_PAGES, Math.max(1, rawPage))
      : 1;

    const { data, latestLog } = await loadAvailabilityInventory();

    const available = data.filter((u) => isAvailableStatus(u.Status));

    const filtered = available.filter((u) => {
      if (projectParam) {
        const matchesProject =
          u.property_code.toLowerCase() === projectParam ||
          u.property_name.toLowerCase() === projectParam;
        if (!matchesProject) return false;
      }
      if (cityParam && u.city.toLowerCase() !== cityParam) return false;
      if (typeParam && u.Type.toLowerCase() !== typeParam) return false;
      return true;
    });

    const cappedTotal = Math.min(filtered.length, PAGE_SIZE * MAX_PAGES);
    const totalPages = Math.max(1, Math.ceil(cappedTotal / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE).map(toPreviewRow);

    return NextResponse.json({
      success: true,
      data: pageRows,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
      maxPages: MAX_PAGES,
      hasMore: page < totalPages,
      // Real match count so the UI can say "36 of 245 available — sign in to
      // see all"; row-level data itself never exceeds the 36-row cap above.
      totalMatching: filtered.length,
      lastUpdated: latestLog,
      filters: {
        projects: distinctSorted(
          available.map((u) => u.property_name || u.property_code)
        ),
        cities: distinctSorted(available.map((u) => u.city)),
        types: distinctSorted(available.map((u) => u.Type)),
      },
    });
  } catch (error) {
    console.error("Error in /api/availability/preview:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
