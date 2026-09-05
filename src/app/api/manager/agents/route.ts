// src/app/api/manager/agents/route.ts
import { NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/role";

// Manager-only: the caller's own Agent roster. GET, no body.
//
// profiles carries no Manager-facing SELECT policy (deliberately, per
// Phase 2C/2D — profiles will grow more governance fields a Manager's
// browser should never receive wholesale just because an Agent's
// manager_id points at them). So this route does NOT rely on RLS at all:
// it authorizes the caller as MANAGER itself, then reads via the
// service-role client with an explicit `manager_id = caller` filter and an
// explicit, narrow field list — id/full_name/role only. No email (email
// lives in auth.users, not profiles, and isn't exposed here).
export async function GET() {
  const supabase = await actionSupabase();

  const authz = await requireApiRole(supabase, ["MANAGER"]);
  if (!authz.ok) return authz.response;

  const { data: agents, error } = await adminSupabase()
    .from("profiles")
    .select("id, full_name, role")
    .eq("manager_id", authz.userId)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[manager/agents] query failed", error);
    return NextResponse.json({ error: "Failed to load agents." }, { status: 500 });
  }

  return NextResponse.json({ agents: agents ?? [] });
}
