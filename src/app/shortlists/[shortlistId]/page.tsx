// src/app/shortlists/[shortlistId]/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { SELLER_ROLES, type Role } from "@/lib/auth/role";
import ShortlistDetailClient from "@/components/shortlists/ShortlistDetailClient";

export const dynamic = "force-dynamic";

// This is page-level UX only. The seller-role gate itself is still enforced
// independently by requireSellerSession() on every /api/shortlists route and
// by RLS in the client_shortlists migration — neither was weakened here.
// CLIENT now gets sent Home instead of /403, matching shortlists/page.tsx.
export default async function ShortlistDetailPage({
  params,
}: {
  params: Promise<{ shortlistId: string }>;
}) {
  const { shortlistId } = await params;
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/shortlists/${shortlistId}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "CLIENT") as Role;

  if (!SELLER_ROLES.includes(role)) {
    redirect("/");
  }

  // Ownership/existence is checked client-side via GET /api/shortlists/[id] so the
  // page can render a graceful "not found" state instead of Next's generic 404.
  return <ShortlistDetailClient shortlistId={shortlistId} />;
}
