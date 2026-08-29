// src/app/shortlists/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import ShortlistsClient from "@/components/shortlists/ShortlistsClient";

export const dynamic = "force-dynamic";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

// Mirrors the seller-role gate enforced by requireSellerSession() on the
// /api/shortlists routes and by RLS in the client_shortlists migration.
const SELLER_ROLES: Role[] = ["AGENT", "MANAGER", "ADMIN"];

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
    redirect("/403");
  }

  return <ShortlistsClient />;
}
