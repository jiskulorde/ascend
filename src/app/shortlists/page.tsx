// src/app/shortlists/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { SELLER_ROLES, type Role } from "@/lib/auth/role";
import ShortlistsClient from "@/components/shortlists/ShortlistsClient";

export const dynamic = "force-dynamic";

// This is page-level UX only. The seller-role gate itself is still enforced
// independently by requireSellerSession() on every /api/shortlists route and
// by RLS in the client_shortlists migration — neither was weakened here.
// CLIENT now gets sent Home instead of /403 (Phase 1 access matrix: CLIENT
// is a normal, expected role hitting a seller-only page, not an error
// state), matching Summary/Compare/Computation's redirect target.
export default async function ShortlistsPage() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/shortlists");
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

  return <ShortlistsClient />;
}
