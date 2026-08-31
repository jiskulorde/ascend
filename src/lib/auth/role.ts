// src/lib/auth/role.ts
import { NextResponse } from "next/server";
import { serverSupabase, actionSupabase } from "@/lib/supabase/server";

export type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";
export type SellerRole = "AGENT" | "MANAGER" | "ADMIN";

export const SELLER_ROLES: Role[] = ["AGENT", "MANAGER", "ADMIN"];

export function isSellerRole(role: Role): role is SellerRole {
  return (SELLER_ROLES as Role[]).includes(role);
}

export type CurrentUser = {
  id: string;
  role: Role;
};

/**
 * Server Component / RSC helper shared by every page that only needs
 * "who is signed in and what's their role" — replaces the same inline
 * getUser() + profiles.select("role") pair that was previously copy-pasted
 * into each protected page. Returns null when there is no session.
 *
 * A signed-in user with no profiles row (or a null role) defaults to
 * CLIENT, matching the fallback every page already used before this helper
 * existed — not a new behavior.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { id: user.id, role: (profile?.role || "CLIENT") as Role };
}

type RouteSupabaseClient = Awaited<ReturnType<typeof actionSupabase>>;

export type RequireRoleResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; response: NextResponse };

/**
 * API-route helper: requires an authenticated caller whose profiles.role is
 * one of `allowedRoles`. Never trusts a role claim from the request body —
 * always re-derives it from the caller's own session. Mirrors
 * requireSellerSession() in src/lib/shortlists/authz.ts, generalized to an
 * arbitrary allow-list so Phase 2D's Admin-only and Manager-only routes
 * don't each reimplement the same getUser() + profiles.select("role") pair.
 */
export async function requireApiRole(
  supabase: RouteSupabaseClient,
  allowedRoles: Role[]
): Promise<RequireRoleResult> {
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

  const role = (profile?.role || "CLIENT") as Role;
  if (!allowedRoles.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, role };
}
