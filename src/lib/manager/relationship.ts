// src/lib/manager/relationship.ts
import { adminSupabase } from "@/lib/supabase/admin";

export type SetAgentManagerStatus =
  | "OK"
  | "AGENT_NOT_FOUND"
  | "AGENT_INVALID_ROLE"
  | "SELF_ASSIGN"
  | "ALREADY_ASSIGNED"
  | "MANAGER_NOT_FOUND"
  | "MANAGER_INVALID_ROLE";

export type SetAgentManagerResult = {
  status: SetAgentManagerStatus;
  agentId: string;
  managerId: string | null;
};

/**
 * The sole write path for profiles.manager_id. Wraps the
 * set_agent_manager() DB function (see supabase/migrations/
 * 20260831030000_manager_relationship_functions.sql for why this needs to
 * be a single atomic DB function rather than a read-then-write from here).
 *
 * Callers MUST already have authorized the actor (ADMIN for
 * assign/reassign/unassign, MANAGER for a claim) before calling this — this
 * function performs no authorization of its own, only the relationship
 * mutation, via the service-role client.
 *
 * @param requireUnassigned true for a Manager claiming an unassigned Agent
 *   (fails if it's already assigned to anyone); false for an Admin
 *   assign/reassign/unassign (may overwrite an existing assignment).
 */
export async function setAgentManager(
  agentId: string,
  managerId: string | null,
  requireUnassigned: boolean
): Promise<SetAgentManagerResult> {
  const { data, error } = await adminSupabase().rpc("set_agent_manager", {
    p_agent_id: agentId,
    p_manager_id: managerId,
    p_require_unassigned: requireUnassigned,
  });

  if (error) {
    throw new Error(`set_agent_manager RPC failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("set_agent_manager RPC returned no result.");
  }

  return {
    status: row.status as SetAgentManagerStatus,
    agentId: row.agent_id as string,
    managerId: (row.assigned_manager_id as string | null) ?? null,
  };
}
