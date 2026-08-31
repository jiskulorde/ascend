// src/lib/auth/role.ts
import { serverSupabase } from "@/lib/supabase/server";

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
