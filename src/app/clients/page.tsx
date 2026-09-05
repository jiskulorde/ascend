// src/app/clients/page.tsx

import { redirect } from "next/navigation";
import { requireActivePage, SELLER_ROLES } from "@/lib/auth/role";
import ClientPropertiesClient from "@/components/clients/ClientPropertiesClient";

export const dynamic = "force-dynamic";

// This page is an orphaned, un-audited legacy inventory listing (no seller
// actions — the "View Details" button isn't wired to anything, so it isn't
// treated as a seller tool) and fetches full inventory from GET
// /api/availability, which is now AGENT/MANAGER/ADMIN-only. It's not linked
// from primary navigation and isn't being redesigned here — just brought in
// line with the same role rule as every other full-inventory page, so a
// CLIENT never lands on a broken empty page after that API returns 403.
//
// Not under middleware.ts's matched prefixes — lifecycle enforcement
// happens here directly, via requireActivePageAccount() (fail-closed on a
// missing/unreadable profile), not getCurrentUser().
export default async function ClientsPage() {
  const currentUser = await requireActivePage("/clients");

  if (!SELLER_ROLES.includes(currentUser.role)) {
    redirect("/");
  }

  return <ClientPropertiesClient />;
}
