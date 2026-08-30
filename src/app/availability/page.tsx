// src/app/availability/page.tsx

import { serverSupabase } from "@/lib/supabase/server";
import AvailabilityClient from "@/components/availability/AvailabilityClient";
import AvailabilityPreviewClient from "@/components/availability/AvailabilityPreviewClient";

export const dynamic = "force-dynamic";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

const ALLOWED_ROLES: Role[] = ["CLIENT", "AGENT", "MANAGER", "ADMIN"];

// /availability is intentionally reachable by both anonymous visitors (a
// capped public preview backed by GET /api/availability/preview) and
// authenticated CLIENT/AGENT/MANAGER/ADMIN users (the full seller experience
// backed by GET /api/availability, which now requires a session). This page
// no longer redirects anonymous visitors to login — that would defeat the
// public preview requirement.
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

  // An authenticated session with an unrecognized role falls back to the
  // public preview rather than a hard 403 — every real profile row is one of
  // the four known roles, so this only guards against a missing/corrupt row.
  if (!ALLOWED_ROLES.includes(role)) {
    return <AvailabilityPreviewClient />;
  }

  return <AvailabilityClient />;
}
