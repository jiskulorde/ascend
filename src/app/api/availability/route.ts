// src/app/api/availability/route.ts

import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { loadAvailabilityInventory } from "@/lib/availability/inventory";

// Full, unfiltered inventory — every field, every row. Requires an
// authenticated session (any recognized role: CLIENT/AGENT/MANAGER/ADMIN).
// Anonymous callers must use GET /api/availability/preview instead, which
// enforces a server-side row cap. This route's data/enrichment logic is
// unchanged from before the auth gate was added — see
// src/lib/availability/inventory.ts for the shared loader both endpoints use.
export async function GET() {
  try {
    const supabase = await serverSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

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
