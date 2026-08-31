// src/app/api/availability/route.ts

import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { SELLER_ROLES, type Role } from "@/lib/auth/role";
import { loadAvailabilityInventory } from "@/lib/availability/inventory";

// Full, unfiltered inventory — every field, every row. AGENT/MANAGER/ADMIN
// only (Phase 1 access matrix): anonymous callers get 401, an authenticated
// CLIENT gets 403 — CLIENT must use GET /api/availability/preview instead,
// same as anonymous, never this endpoint. This route's data/enrichment logic
// is otherwise unchanged — see src/lib/availability/inventory.ts for the
// shared loader both endpoints use.
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profile?.role || "CLIENT") as Role;

    if (!SELLER_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden." },
        { status: 403 }
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
