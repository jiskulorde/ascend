// src/lib/manager/types.ts
//
// Shared shape between GET /api/manager/agents, GET /api/manager/agents/
// unassigned, and their client components. V1 fields only — no email
// (email lives in auth.users, not exposed to Managers yet), no
// account_status/expiration (don't exist yet).

export type AgentSummary = {
  id: string;
  full_name: string | null;
  role: "AGENT";
};

export type UnassignedAgentSummary = {
  id: string;
  full_name: string | null;
};
