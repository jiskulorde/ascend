// src/app/dashboard/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import SellerDashboardClient from "@/components/dashboard/SellerDashboardClient";
import { isSellerRole, type Role } from "@/lib/auth/role";
import { computeEffectiveState, lifecycleDestination, type AccountStatus } from "@/lib/auth/accountLifecycle";

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
    .select("full_name, role, account_status, access_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  // Fail closed: a missing/unreadable profile is never treated as
  // CLIENT/ACTIVE (mirrors middleware.ts and requireActivePageAccount()).
  if (!profile) {
    redirect("/account/status");
  }

  const role = profile.role as Role;
  const accountStatus = profile.account_status as AccountStatus;
  const accessExpiresAt = (profile.access_expires_at as string | null) ?? null;

  // Lifecycle BEFORE role. This page previously only checked role — a
  // PENDING account's role stays CLIENT (Phase 3B), so the role-only check
  // below sent it to Home via isSellerRole(), never to /account/pending.
  // middleware.ts already enforces lifecycle correctly for /dashboard/*, but
  // this page must not rely on that alone as its only line of defense.
  const lifecycleRedirect = lifecycleDestination(computeEffectiveState(accountStatus, accessExpiresAt));
  if (lifecycleRedirect) {
    redirect(lifecycleRedirect);
  }

  if (!isSellerRole(role)) {
    redirect("/");
  }

  const fullName = profile.full_name ?? null;
  const email = user.email ?? null;

  return <SellerDashboardClient fullName={fullName} email={email} role={role} />;
}
