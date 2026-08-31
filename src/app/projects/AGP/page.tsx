// src/app/projects/AGP/page.tsx

import { getCurrentUser, isSellerRole } from "@/lib/auth/role";
import AGPPageClient from "@/components/projects/AGPPageClient";

export const dynamic = "force-dynamic";

// Projects stay public — this page never redirects or denies access. The
// only thing role changes is which inventory source the "lowest price by
// type" table reads from: the capped public preview endpoint for anonymous
// visitors AND CLIENT alike, or the full seller endpoint for AGENT/MANAGER/
// ADMIN (Phase 1 access matrix — CLIENT must get the same preview as
// anonymous, not the full endpoint just for being signed in, which is what
// this page did before). See AGPPageClient for the branch.
export default async function AGPPage() {
  const currentUser = await getCurrentUser();
  const canViewFullInventory = !!currentUser && isSellerRole(currentUser.role);

  return <AGPPageClient canViewFullInventory={canViewFullInventory} />;
}
