// src/lib/shortlists/authz.ts

import { NextResponse } from "next/server";
import type { actionSupabase } from "@/lib/supabase/server";

const SELLER_ROLES = ["AGENT", "MANAGER", "ADMIN"] as const;
type SellerRole = (typeof SELLER_ROLES)[number];

type SupabaseRouteClient = Awaited<ReturnType<typeof actionSupabase>>;

type AuthzResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Shared gate for every /api/shortlists route: requires a signed-in user whose
 * profiles.role is AGENT/MANAGER/ADMIN. This mirrors the role check already
 * enforced by RLS on client_shortlists/shortlist_units — it exists to return
 * clear 401/403 responses instead of relying on a generic RLS/database error.
 */
export async function requireSellerSession(
  supabase: SupabaseRouteClient
): Promise<AuthzResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Failed to verify role." }, { status: 500 }),
    };
  }

  const role = profile?.role as SellerRole | undefined;
  if (!role || !SELLER_ROLES.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}
