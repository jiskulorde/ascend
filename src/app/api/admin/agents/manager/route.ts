// src/app/api/admin/agents/manager/route.ts
import { NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/role";
import { setAgentManager } from "@/lib/manager/relationship";

// Admin-only: assign, reassign, or unassign an Agent's Manager.
// POST body: { agentId: string, managerId: string | null }
// managerId = null unassigns. Admin may overwrite an existing assignment —
// unlike the Manager claim route, there is no "must currently be
// unassigned" requirement here (see setAgentManager's requireUnassigned).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || !isValidUuid(body.agentId)) {
    return NextResponse.json({ error: "A valid agentId is required." }, { status: 400 });
  }

  const managerIdInput = body.managerId ?? null;
  if (managerIdInput !== null && !isValidUuid(managerIdInput)) {
    return NextResponse.json({ error: "managerId must be a valid id or null." }, { status: 400 });
  }

  const supabase = await actionSupabase();

  // Never trust a role claim from the request body — always re-derive the
  // caller's role from their own authenticated session.
  const authz = await requireApiRole(supabase, ["ADMIN"]);
  if (!authz.ok) return authz.response;

  let result;
  try {
    result = await setAgentManager(body.agentId, managerIdInput, false);
  } catch (err) {
    console.error("[admin/agents/manager] setAgentManager failed", err);
    return NextResponse.json(
      { error: "Failed to update the assignment. Please try again." },
      { status: 500 }
    );
  }

  switch (result.status) {
    case "OK":
      return NextResponse.json({
        ok: true,
        agentId: result.agentId,
        managerId: result.managerId,
      });
    case "AGENT_NOT_FOUND":
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    case "AGENT_INVALID_ROLE":
      return NextResponse.json({ error: "Target account is not an Agent." }, { status: 400 });
    case "MANAGER_NOT_FOUND":
      return NextResponse.json({ error: "Manager not found." }, { status: 404 });
    case "MANAGER_INVALID_ROLE":
      return NextResponse.json({ error: "Selected account is not a Manager." }, { status: 400 });
    case "SELF_ASSIGN":
      return NextResponse.json({ error: "An account cannot manage itself." }, { status: 400 });
    default:
      // ALREADY_ASSIGNED cannot occur here (requireUnassigned is always
      // false for Admin), but every status is handled explicitly rather
      // than falling through to a generic message.
      return NextResponse.json({ error: "Unable to complete the assignment." }, { status: 400 });
  }
}
