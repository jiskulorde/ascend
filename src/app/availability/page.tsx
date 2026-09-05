// src/app/availability/page.tsx

import { serverSupabase } from "@/lib/supabase/server";
import { SELLER_ROLES, type Role } from "@/lib/auth/role";
import AvailabilityClient from "@/components/availability/AvailabilityClient";
import AvailabilityPreviewClient from "@/components/availability/AvailabilityPreviewClient";

export const dynamic = "force-dynamic";

// CRITICAL: full inventory (AvailabilityClient, backed by GET
// /api/availability) is for AGENT/MANAGER/ADMIN only. Anonymous visitors AND
// CLIENT both get the exact same capped public preview
// (AvailabilityPreviewClient, backed by GET /api/availability/preview) — a
// signed-in CLIENT is never routed to the full client just because they're
// authenticated. This page never redirects anonymous visitors to login —
// that would defeat the public preview requirement.
export default async function AvailabilityPage() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AvailabilityPreviewClient />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "CLIENT") as Role;

  if (!SELLER_ROLES.includes(role)) {
    return <AvailabilityPreviewClient />;
  }

  return <AvailabilityClient />;
}
