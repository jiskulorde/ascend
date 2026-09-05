// src/app/shortlists/[shortlistId]/page.tsx

import { redirect } from "next/navigation";
import { requireActivePage, SELLER_ROLES } from "@/lib/auth/role";
import ShortlistDetailClient from "@/components/shortlists/ShortlistDetailClient";

export const dynamic = "force-dynamic";

// This is page-level UX only. The seller-role gate itself is still enforced
// independently by requireSellerSession() on every /api/shortlists route and
// by RLS in the client_shortlists migration — neither was weakened here.
// CLIENT now gets sent Home instead of /403, matching shortlists/page.tsx.
//
// Not under middleware.ts's matched prefixes — see the note in
// shortlists/page.tsx for why lifecycle enforcement happens here directly,
// via requireActivePageAccount() (fail-closed on a missing/unreadable
// profile), not getCurrentUser().
export default async function ShortlistDetailPage({
  params,
}: {
  params: Promise<{ shortlistId: string }>;
}) {
  const { shortlistId } = await params;

  const currentUser = await requireActivePage(`/shortlists/${shortlistId}`);

  if (!SELLER_ROLES.includes(currentUser.role)) {
    redirect("/");
  }

  // Ownership/existence is checked client-side via GET /api/shortlists/[id] so the
  // page can render a graceful "not found" state instead of Next's generic 404.
  return <ShortlistDetailClient shortlistId={shortlistId} />;
}
