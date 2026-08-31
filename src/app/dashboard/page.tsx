// src/app/dashboard/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import SellerDashboardClient from "@/components/dashboard/SellerDashboardClient";
import ClientDashboardClient from "@/components/dashboard/ClientDashboardClient";

export const dynamic = "force-dynamic";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";
type SellerRole = "AGENT" | "MANAGER" | "ADMIN";

function isSellerRole(role: Role): role is SellerRole {
  return role === "AGENT" || role === "MANAGER" || role === "ADMIN";
}

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
  const fullName = profile?.full_name ?? null;
  const email = user.email ?? null;

  if (isSellerRole(role)) {
    return <SellerDashboardClient fullName={fullName} email={email} role={role} />;
  }

  return <ClientDashboardClient fullName={fullName} email={email} />;
}
