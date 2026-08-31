// src/app/dashboard/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import SellerDashboardClient from "@/components/dashboard/SellerDashboardClient";
import { isSellerRole, type Role } from "@/lib/auth/role";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The layout above already guards this; re-checked here since a server
  // component shouldn't assume a parent layout ran first on every render path.
  if (!user) {
    redirect("/auth/login?next=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "CLIENT") as Role;

  // CLIENT is a buyer account with no seller dashboard (Phase 1 access
  // matrix) — middleware already redirects CLIENT Home for every
  // /dashboard/* path, but this page re-checks independently rather than
  // assuming middleware ran first, matching every other protected page's
  // defense-in-depth pattern.
  if (!isSellerRole(role)) {
    redirect("/");
  }

  const fullName = profile?.full_name ?? null;
  const email = user.email ?? null;

  return <SellerDashboardClient fullName={fullName} email={email} role={role} />;
}
