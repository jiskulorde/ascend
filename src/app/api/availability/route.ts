// src/app/api/availability/route.ts

import { NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";
import { requireApiRole, SELLER_ROLES } from "@/lib/auth/role";
import { loadAvailabilityInventory } from "@/lib/availability/inventory";

// Full, unfiltered inventory — every field, every row. AGENT/MANAGER/ADMIN
// only (Phase 1 access matrix): anonymous callers get 401, an authenticated
// CLIENT gets 403 — CLIENT must use GET /api/availability/preview instead,
// same as anonymous, never this endpoint. Now routed through requireApiRole
// (Phase 3B) so a PENDING/SUSPENDED/DEACTIVATED/EXPIRED account is rejected
// even if role happens to say AGENT/MANAGER/ADMIN, not just role-checked.
// This route's data/enrichment logic is otherwise unchanged — see
// src/lib/availability/inventory.ts for the shared loader both endpoints use.
export async function GET() {
  try {
    const supabase = await actionSupabase();
    const authz = await requireApiRole(supabase, SELLER_ROLES);
    // requireApiRole's response body is { error, code? } rather than this
    // route's usual { success: false, error } — every current consumer only
    // checks truthiness of `success`/`data`, never the literal absence of a
    // `success` key, so returning it as-is is safe and avoids re-wrapping.
    if (!authz.ok) return authz.response;

    const { data, latestLog } = await loadAvailabilityInventory();

    return NextResponse.json({
      success: true,
      data,
      latestLog,
    });
  } catch (error) {
    console.error("Error in /api/availability:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
