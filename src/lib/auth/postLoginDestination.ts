// src/lib/auth/postLoginDestination.ts
"use client";

import type { browserSupabase } from "@/lib/supabase/client";
import {
  computeEffectiveState,
  lifecycleDestination,
  type AccountStatus,
} from "@/lib/auth/accountLifecycle";

type BrowserSupabase = ReturnType<typeof browserSupabase>;

const SELLER_ROLES = ["AGENT", "MANAGER", "ADMIN"];

/**
 * Reads a `next=` query value as an explicit destination request, or null if
 * absent/unsafe (not a same-origin path). Shared by LoginClient and the
 * OAuth redirect handler so both treat "no next given" the same way.
 */
export function parseExplicitNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/**
 * Where to send someone right after a successful sign-in/sign-up.
 *
 * Lifecycle takes priority over an explicit `next` (Phase 3B): a PENDING
 * account always lands on /account/pending and a SUSPENDED/DEACTIVATED/
 * EXPIRED one on /account/status, even if they were mid-flow toward a
 * specific protected route — landing there would just be immediately
 * bounced by middleware anyway, and this avoids the extra hop while giving
 * a clearer signal than dropping them on an arbitrary page.
 *
 * A missing or unreadable profile row is treated the same way — routed to
 * /account/status, never defaulted to ACTIVE — since this decides where an
 * authenticated session lands and must fail closed like every other
 * lifecycle check, not quietly send an unverifiable account to Home.
 *
 * Only once the account is confirmed effectively ACTIVE does an explicit
 * `next` get honored as-is, regardless of role — this preserves "seller
 * signs in from a protected route -> lands back on that route" exactly as
 * before. Otherwise: AGENT/MANAGER/ADMIN land on their Dashboard, everyone
 * else (CLIENT) lands on Home.
 */
export async function resolvePostLoginDestination(
  supabase: BrowserSupabase,
  userId: string,
  explicitNext: string | null
): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, account_status, access_expires_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return "/account/status";
  }

  const accountStatus = profile.account_status as AccountStatus;
  const accessExpiresAt = (profile.access_expires_at as string | null) ?? null;
  const effectiveState = computeEffectiveState(accountStatus, accessExpiresAt);

  const lifecycleDest = lifecycleDestination(effectiveState);
  if (lifecycleDest) return lifecycleDest;

  if (explicitNext) return explicitNext;

  const role = profile.role as string | undefined;
  return role && SELLER_ROLES.includes(role) ? "/dashboard" : "/";
}
