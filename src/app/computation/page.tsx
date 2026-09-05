// src/app/computation/page.tsx

import { redirect } from "next/navigation";
import { requireActivePage, SELLER_ROLES } from "@/lib/auth/role";
import ComputationHubClient from "@/components/computation/ComputationHubClient";

export const dynamic = "force-dynamic";

// Computation is a seller tool (AGENT/MANAGER/ADMIN) — CLIENT is a buyer
// account and is sent Home, not /403 (Phase 1 access matrix).
// requireActivePage() handles authentication AND fails closed on PENDING/
// SUSPENDED/DEACTIVATED/EXPIRED/unverifiable accounts before this role
// check ever runs.
export default async function ComputationHubPage() {
  const currentUser = await requireActivePage("/computation");

  if (!SELLER_ROLES.includes(currentUser.role)) {
    redirect("/");
  }

  return <ComputationHubClient />;
}
