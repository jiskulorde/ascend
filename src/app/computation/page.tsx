// src/app/computation/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { SELLER_ROLES, type Role } from "@/lib/auth/role";
import ComputationHubClient from "@/components/computation/ComputationHubClient";

export const dynamic = "force-dynamic";

// Computation is a seller tool (AGENT/MANAGER/ADMIN) — CLIENT is a buyer
// account and is sent Home, not /403 (Phase 1 access matrix); anonymous
// still hits the login redirect below (no session at all).
export default async function ComputationHubPage() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/computation");
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

  return <ComputationHubClient />;
}
