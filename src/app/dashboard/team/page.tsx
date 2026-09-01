// src/app/dashboard/team/page.tsx
import { redirect } from "next/navigation";

// This used to list every non-CLIENT account in the system (Agents,
// Managers, Admins alike) — not a real "My Agents" roster, just everyone.
// Replaced by the real Manager-scoped roster at /dashboard/agents (Phase
// 2E), backed by GET /api/manager/agents (manager_id = caller only).
// Kept as a compatibility redirect rather than deleted outright, in case
// anything still links here.
export default function LegacyTeamRedirect() {
  redirect("/dashboard/agents");
}
