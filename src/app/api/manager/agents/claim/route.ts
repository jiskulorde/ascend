// src/app/api/manager/agents/claim/route.ts
import { NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/role";
import { setAgentManager } from "@/lib/manager/relationship";

// Manager-only: claim a currently-unassigned Agent. POST body: { agentId }.
// The new manager_id is ALWAYS the authenticated caller's own id — never
// read from the request body, so a Manager can never claim on someone
// else's behalf or write an arbitrary manager_id. Distinct from the Admin
// assignment route: this one requires the Agent to currently be unassigned
// and can never steal an Agent already assigned elsewhere.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || !isValidUuid(body.agentId)) {
    return NextResponse.json({ error: "A valid agentId is required." }, { status: 400 });
  }

  const supabase = await actionSupabase();

  const authz = await requireApiRole(supabase, ["MANAGER"]);
  if (!authz.ok) return authz.response;

  let result;
  try {
    result = await setAgentManager(body.agentId, authz.userId, true);
  } catch (err) {
    console.error("[manager/agents/claim] setAgentManager failed", err);
    return NextResponse.json(
      { error: "Failed to claim this agent. Please try again." },
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
    case "ALREADY_ASSIGNED":
      // Another Manager won a concurrent claim, or the roster the caller
      // was looking at was stale — clean conflict response, not an error.
      return NextResponse.json(
        { error: "This agent was just claimed by another manager." },
        { status: 409 }
      );
    case "AGENT_NOT_FOUND":
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    case "AGENT_INVALID_ROLE":
      return NextResponse.json({ error: "Target account is not an Agent." }, { status: 400 });
    default:
      // SELF_ASSIGN / MANAGER_NOT_FOUND / MANAGER_INVALID_ROLE cannot occur
      // here in practice (the manager id is always the caller's own,
      // already-verified-MANAGER id), but every status is still handled
      // explicitly rather than assuming a specific one is unreachable.
      return NextResponse.json({ error: "Unable to claim this agent." }, { status: 400 });
  }
}
