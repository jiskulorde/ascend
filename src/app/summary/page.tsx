// src/app/summary/page.tsx

import { redirect } from "next/navigation";
import { requireActivePage, SELLER_ROLES } from "@/lib/auth/role";
import SummaryClient from "@/components/summary/SummaryClient";

export const dynamic = "force-dynamic";

// Summary is a seller tool (AGENT/MANAGER/ADMIN) — CLIENT is a buyer account
// and is sent Home, not /403 (Phase 1 access matrix). requireActivePage()
// handles authentication AND fails closed on PENDING/SUSPENDED/DEACTIVATED/
// EXPIRED/unverifiable accounts BEFORE this role check ever runs —
// previously this page only checked role, which let a PENDING account
// (role stays CLIENT) fall through to the seller-role check below and land
// on Home instead of /account/pending.
export default async function SummaryPage() {
  const currentUser = await requireActivePage("/summary");

  if (!SELLER_ROLES.includes(currentUser.role)) {
    redirect("/");
  }

  return <SummaryClient />;
}
