// src/app/shortlists/page.tsx

import { redirect } from "next/navigation";
import { requireActivePage, SELLER_ROLES } from "@/lib/auth/role";
import ShortlistsClient from "@/components/shortlists/ShortlistsClient";

export const dynamic = "force-dynamic";

// This is page-level UX only. The seller-role gate itself is still enforced
// independently by requireSellerSession() on every /api/shortlists route and
// by RLS in the client_shortlists migration — neither was weakened here.
// CLIENT now gets sent Home instead of /403 (Phase 1 access matrix: CLIENT
// is a normal, expected role hitting a seller-only page, not an error
// state), matching Summary/Compare/Computation's redirect target.
//
// /shortlists is not under middleware.ts's matched prefixes (unlike
// /dashboard, /summary, /compare, /computation), so lifecycle enforcement
// has to happen here directly rather than relying on middleware as the
// primary layer. Uses requireActivePageAccount() (fail-closed on a missing
// or unreadable profile — never treated as ACTIVE), not getCurrentUser().
export default async function ShortlistsPage() {
  const currentUser = await requireActivePage("/shortlists");

  if (!SELLER_ROLES.includes(currentUser.role)) {
    redirect("/");
  }

  return <ShortlistsClient />;
}
