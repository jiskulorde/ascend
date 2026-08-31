// src/lib/profiles/applyRoleChange.ts
import { adminSupabase } from "@/lib/supabase/admin";
import type { Role } from "@/lib/auth/role";

export type ApplyRoleChangeStatus = "OK" | "PROFILE_NOT_FOUND" | "MANAGER_HAS_AGENTS";

export type ApplyRoleChangeResult = {
  status: ApplyRoleChangeStatus;
  profileId: string;
  role: Role | null;
  managerId: string | null;
  blockedAgentCount: number;
};

/**
 * Centralized, trusted-server-only role mutation. Wraps the
 * apply_profile_role_change() DB function so every caller — the existing
 * email-confirm role-change flow today, a future direct Admin role-change
 * endpoint later — gets the same two rules applied consistently instead of
 * each reimplementing (or forgetting) them:
 *
 *   - leaving AGENT clears manager_id in the same atomic update
 *   - leaving MANAGER while Agents are still assigned is BLOCKED
 *     (never silently mass-unassigned) — see blockedAgentCount
 *
 * Callers MUST already have authorized the actor before calling this — it
 * performs no authorization itself, only the role mutation, via the
 * service-role client.
 */
export async function applyProfileRoleChange(
  profileId: string,
  newRole: Role
): Promise<ApplyRoleChangeResult> {
  const { data, error } = await adminSupabase().rpc("apply_profile_role_change", {
    p_profile_id: profileId,
    p_new_role: newRole,
  });

  if (error) {
    throw new Error(`apply_profile_role_change RPC failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("apply_profile_role_change RPC returned no result.");
  }

  return {
    status: row.status as ApplyRoleChangeStatus,
    profileId: row.profile_id as string,
    role: (row.new_role as Role | null) ?? null,
    managerId: (row.assigned_manager_id as string | null) ?? null,
    blockedAgentCount: (row.blocked_agent_count as number | null) ?? 0,
  };
}
