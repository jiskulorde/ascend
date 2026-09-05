// src/app/api/shortlists/membership/route.ts

import { NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";
import { requireSellerSession } from "@/lib/shortlists/authz";
import { serverError } from "@/lib/shortlists/errors";

export type UnitMembershipRow = {
  // shortlist_units.id — the row id DELETE /api/shortlists/[id]/units/[shortlistUnitId]
  // needs to remove this specific membership. Added so the Save-to-Shortlist
  // dialog can offer removal without a second round trip per shortlist.
  id: string;
  shortlist_id: string;
  property_code: string;
  tower_code: string;
  building_unit: string;
};

// GET /api/shortlists/membership — every (id, shortlist_id, property_code,
// tower_code, building_unit) row across ALL of the caller's own shortlists.
//
// Identity is the physical-unit triple, not unit_id: a shortlist_units row's
// unit_id was captured at save time and may be in an older canonical/legacy
// format than what /api/availability returns for the same physical unit today,
// so matching on unit_id alone could miss real memberships.
//
// No owner_id filter is applied here — RLS (shortlist_units_owner_all, see
// supabase/migrations/20260829000000_client_shortlists.sql) already restricts
// this query to rows whose parent shortlist is owned by the caller AND whose
// profile role is currently AGENT/MANAGER/ADMIN, using the cookie-scoped
// actionSupabase client (never a service-role client). Returning "everything
// this query yields" is therefore already "only the current user's own
// memberships" by construction.
//
// This is a single query regardless of how many units the caller is checking —
// callers filter the returned rows down to whatever units they care about
// client-side, so this scales with one round trip whether checking 1 unit or
// a bulk selection, never N+1 shortlist-detail fetches.
export async function GET() {
  const supabase = await actionSupabase();
  const authz = await requireSellerSession(supabase);
  if (!authz.ok) return authz.response;

  const { data, error } = await supabase
    .from("shortlist_units")
    .select("id, shortlist_id, property_code, tower_code, building_unit");

  if (error) {
    return serverError("GET /api/shortlists/membership", error);
  }

  return NextResponse.json({ memberships: (data ?? []) as UnitMembershipRow[] });
}
