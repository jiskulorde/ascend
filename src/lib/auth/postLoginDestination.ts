// src/lib/auth/postLoginDestination.ts
"use client";

import type { browserSupabase } from "@/lib/supabase/client";

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
 * Where to send someone right after a successful sign-in/sign-up when no
 * explicit `next=` was requested: AGENT/MANAGER/ADMIN land on their
 * Dashboard, everyone else (CLIENT, or a profile row that isn't ready yet)
 * lands on Home — CLIENT has no seller dashboard (Phase 1 access matrix), so
 * defaulting it to /dashboard just meant an extra bounce through middleware.
 * An explicit `next` is always honored as-is regardless of role — this
 * function is only ever consulted when there wasn't one.
 */
export async function resolvePostLoginDestination(
  supabase: BrowserSupabase,
  userId: string,
  explicitNext: string | null
): Promise<string> {
  if (explicitNext) return explicitNext;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  return role && SELLER_ROLES.includes(role) ? "/dashboard" : "/";
}
