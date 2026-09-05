// src/app/compare/page.tsx

import { redirect } from "next/navigation";
import { requireActivePage, SELLER_ROLES } from "@/lib/auth/role";
import CompareClient from "@/components/compare/CompareClient";

export const dynamic = "force-dynamic";

// Compare is a seller tool (AGENT/MANAGER/ADMIN) — CLIENT is a buyer account
// and is sent Home, not /403 (Phase 1 access matrix). requireActivePage()
// handles authentication AND fails closed on PENDING/SUSPENDED/DEACTIVATED/
// EXPIRED/unverifiable accounts before this role check ever runs.
export default async function ComparePage() {
  const currentUser = await requireActivePage("/compare");

  if (!SELLER_ROLES.includes(currentUser.role)) {
    redirect("/");
  }

  return <CompareClient />;
}
