// src/app/clients/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { SELLER_ROLES, type Role } from "@/lib/auth/role";
import ClientPropertiesClient from "@/components/clients/ClientPropertiesClient";

export const dynamic = "force-dynamic";

// This page is an orphaned, un-audited legacy inventory listing (no seller
// actions — the "View Details" button isn't wired to anything, so it isn't
// treated as a seller tool) and fetches full inventory from GET
// /api/availability, which is now AGENT/MANAGER/ADMIN-only. It's not linked
// from primary navigation and isn't being redesigned here — just brought in
// line with the same role rule as every other full-inventory page, so a
// CLIENT never lands on a broken empty page after that API returns 403.
export default async function ClientsPage() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/clients");
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

  return <ClientPropertiesClient />;
}
