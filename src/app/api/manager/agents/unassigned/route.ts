// src/app/api/manager/agents/unassigned/route.ts
import { NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/role";

// Manager-only: currently-unassigned Agents, for a future "Add Agent" flow
// feeding the claim route (POST /api/manager/agents/claim). GET, no body.
//
// Same reasoning as GET /api/manager/agents: no profiles RLS relied on,
// server-side authorization + an explicit service-role query with a narrow
// filter (role = AGENT AND manager_id IS NULL) and minimal fields — no
// email, no other roles, no assigned Agents (those belong to whichever
// Manager already claimed them, not visible here).
export async function GET() {
  const supabase = await actionSupabase();

  const authz = await requireApiRole(supabase, ["MANAGER"]);
  if (!authz.ok) return authz.response;

  const { data: agents, error } = await adminSupabase()
    .from("profiles")
    .select("id, full_name")
    .eq("role", "AGENT")
    .is("manager_id", null)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[manager/agents/unassigned] query failed", error);
    return NextResponse.json({ error: "Failed to load unassigned agents." }, { status: 500 });
  }

  return NextResponse.json({ agents: agents ?? [] });
}
