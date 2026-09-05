// src/lib/shortlists/authz.ts

import { NextResponse } from "next/server";
import type { actionSupabase } from "@/lib/supabase/server";
import { requireApiRole, SELLER_ROLES } from "@/lib/auth/role";

type SupabaseRouteClient = Awaited<ReturnType<typeof actionSupabase>>;

type AuthzResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Shared gate for every /api/shortlists route (and /api/rto-rate): requires
 * a signed-in, effectively ACTIVE user whose profiles.role is
 * AGENT/MANAGER/ADMIN. This mirrors the role check already enforced by RLS
 * on client_shortlists/shortlist_units — it exists to return clear 401/403
 * responses instead of relying on a generic RLS/database error.
 *
 * Delegates to requireApiRole() (Phase 3B) rather than reimplementing its
 * own getUser()/profile query, so lifecycle enforcement (PENDING/SUSPENDED/
 * DEACTIVATED/EXPIRED) applies here automatically instead of needing a
 * second, separately-maintained copy of that logic.
 */
export async function requireSellerSession(
  supabase: SupabaseRouteClient
): Promise<AuthzResult> {
  const result = await requireApiRole(supabase, SELLER_ROLES);
  if (!result.ok) return result;
  return { ok: true, userId: result.userId };
}
