// src/lib/auth/accountLifecycle.ts
//
// Pure, dependency-free lifecycle logic — no Supabase import, so this can be
// used identically from middleware.ts (its own createServerClient instance)
// and from src/lib/auth/role.ts (serverSupabase/actionSupabase). Centralizing
// this one function is what Phase 3B's audit is actually protecting against:
// every route/page computing "is this account usable right now" the same
// way, rather than each reinventing the EXPIRED-derivation rule slightly
// differently.

export type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

// EXPIRED is never persisted (Phase 3A design decision) — it's the one
// value here that never appears in profiles.account_status itself.
export type EffectiveAccountState = AccountStatus | "EXPIRED";

/**
 * role answers "what can this account do, when it may act at all."
 * account_status (and this function's derived EXPIRED) answers "may this
 * account use protected application features at all, right now." The two
 * are independent — see the callers of this function for how they combine.
 */
export function computeEffectiveState(
  accountStatus: AccountStatus,
  accessExpiresAt: string | null
): EffectiveAccountState {
  if (
    accountStatus === "ACTIVE" &&
    accessExpiresAt !== null &&
    new Date(accessExpiresAt).getTime() <= Date.now()
  ) {
    return "EXPIRED";
  }
  return accountStatus;
}

/** Safe error codes returned to API clients — never a raw DB error. */
export const LIFECYCLE_ERROR_CODE: Record<Exclude<EffectiveAccountState, "ACTIVE">, string> = {
  PENDING: "ACCOUNT_PENDING",
  SUSPENDED: "ACCOUNT_SUSPENDED",
  DEACTIVATED: "ACCOUNT_DEACTIVATED",
  EXPIRED: "ACCOUNT_EXPIRED",
};

/**
 * Distinct from LIFECYCLE_ERROR_CODE: this is for when a profile row could
 * not be verified at all (missing, or the query errored) — not "we know
 * this account's state and it isn't ACTIVE," but "we don't know this
 * account's state, so it must be denied." Never synthesize CLIENT/ACTIVE in
 * this case for anything that gates real access.
 */
export const ACCOUNT_PROFILE_UNAVAILABLE_CODE = "ACCOUNT_PROFILE_UNAVAILABLE";

/** Where a signed-in user with this effective state should land. */
export function lifecycleDestination(state: EffectiveAccountState): string | null {
  if (state === "ACTIVE") return null;
  if (state === "PENDING") return "/account/pending";
  return "/account/status";
}
