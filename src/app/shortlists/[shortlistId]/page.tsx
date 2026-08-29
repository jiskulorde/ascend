// src/app/shortlists/[shortlistId]/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import ShortlistDetailClient from "@/components/shortlists/ShortlistDetailClient";

export const dynamic = "force-dynamic";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

// Mirrors the seller-role gate enforced by requireSellerSession() on the
// /api/shortlists routes and by RLS in the client_shortlists migration.
const SELLER_ROLES: Role[] = ["AGENT", "MANAGER", "ADMIN"];

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
    redirect("/403");
  }

  // Ownership/existence is checked client-side via GET /api/shortlists/[id] so the
  // page can render a graceful "not found" state instead of Next's generic 404.
  return <ShortlistDetailClient shortlistId={shortlistId} />;
}
