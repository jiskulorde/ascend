// src/lib/auth/role.ts
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { serverSupabase, actionSupabase } from "@/lib/supabase/server";
import {
  computeEffectiveState,
  lifecycleDestination,
  LIFECYCLE_ERROR_CODE,
  ACCOUNT_PROFILE_UNAVAILABLE_CODE,
  type AccountStatus,
  type EffectiveAccountState,
} from "@/lib/auth/accountLifecycle";

export type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";
export type SellerRole = "AGENT" | "MANAGER" | "ADMIN";

export const SELLER_ROLES: Role[] = ["AGENT", "MANAGER", "ADMIN"];

export function isSellerRole(role: Role): role is SellerRole {
  return (SELLER_ROLES as Role[]).includes(role);
}

export type { AccountStatus, EffectiveAccountState };

export type CurrentUser = {
  id: string;
  role: Role;
  accountStatus: AccountStatus;
  accessExpiresAt: string | null;
  effectiveState: EffectiveAccountState;
  requestedRole: Role | null;
};

type RouteSupabaseClient = Awaited<ReturnType<typeof actionSupabase>>;

// ---------------------------------------------------------------------------
// Shared internal fetch — every exported helper below uses this for the
// actual query, so the fail-open vs. fail-closed decision is made exactly
// once per caller, in one place, rather than each reimplementing the query.
// ---------------------------------------------------------------------------

type ProfileLifecycleRow = {
  role: Role;
  accountStatus: AccountStatus;
  accessExpiresAt: string | null;
  requestedRole: Role | null;
};

async function fetchProfileLifecycle(
  supabase: RouteSupabaseClient,
  userId: string
): Promise<ProfileLifecycleRow | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, account_status, access_expires_at, requested_role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) return null;

  return {
    role: profile.role as Role,
    accountStatus: profile.account_status as AccountStatus,
    accessExpiresAt: (profile.access_expires_at as string | null) ?? null,
    requestedRole: (profile.requested_role as Role | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Presentational-only reads — intentionally lenient, NEVER used to gate
// protected content or actions.
// ---------------------------------------------------------------------------

/**
 * Server Component / RSC helper for low-stakes, presentational reads only
 * (the Navbar's role badge, the Projects/AGP page's preview-vs-full data
 * source decision). Returns null when there is no session.
 *
 * A signed-in user with no readable profile row defaults to CLIENT / ACTIVE
 * here — this is a deliberate, narrow exception to "fail closed," kept only
 * because every current caller either (a) shows a generic label with no
 * access implication (Navbar), or (b) the CLIENT default is itself the
 * safe/restrictive choice for that caller's decision (AGP: CLIENT means
 * "use the public preview data source," never the sensitive one). This
 * function must NOT be used to authorize a protected page or action — use
 * requireActivePageAccount() for that, which fails closed on the same
 * missing-profile case instead of defaulting to CLIENT/ACTIVE.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await fetchProfileLifecycle(supabase, user.id);

  const role = profile?.role ?? "CLIENT";
  const accountStatus = profile?.accountStatus ?? "ACTIVE";
  const accessExpiresAt = profile?.accessExpiresAt ?? null;

  return {
    id: user.id,
    role,
    accountStatus,
    accessExpiresAt,
    effectiveState: computeEffectiveState(accountStatus, accessExpiresAt),
    requestedRole: profile?.requestedRole ?? null,
  };
}

// ---------------------------------------------------------------------------
// Protected-page authorization — fails CLOSED on a missing/unreadable
// profile. Use these for any page that gates real protected content or
// governance actions.
// ---------------------------------------------------------------------------

/**
 * Like getCurrentUser(), but returns null not only when there's no session,
 * but also when the profile row is missing or the query errors — never
 * defaults an unverifiable profile to CLIENT/ACTIVE. Used by the /account/
 * pending and /account/status pages themselves, where collapsing "not
 * authenticated" and "authenticated but unverifiable" into the same "send
 * back to login" outcome is safe (both pages are already the fail-closed
 * destination; there's no more-specific place to send an unverifiable
 * profile that isn't itself).
 */
export async function getVerifiedCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await fetchProfileLifecycle(supabase, user.id);
  if (!profile) return null;

  return {
    id: user.id,
    role: profile.role,
    accountStatus: profile.accountStatus,
    accessExpiresAt: profile.accessExpiresAt,
    effectiveState: computeEffectiveState(profile.accountStatus, profile.accessExpiresAt),
    requestedRole: profile.requestedRole,
  };
}

export type PageAccessResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; redirectTo: string };

/**
 * Protected-page authorization, fail-closed. Authenticates the caller and
 * requires a verifiable, effectively ACTIVE profile:
 *   - not authenticated             -> /auth/login (with ?next= if given)
 *   - profile missing/unreadable    -> /account/status (never CLIENT/ACTIVE)
 *   - PENDING                       -> /account/pending
 *   - SUSPENDED/DEACTIVATED/EXPIRED -> /account/status
 *   - ACTIVE                        -> { ok: true, user }
 *
 * Use this instead of getCurrentUser() for any page that gates real
 * protected content or governance actions (shortlists, clients, the legacy
 * role-change confirmation page, etc.) — it never treats an unverifiable
 * profile as ACTIVE the way getCurrentUser() intentionally does for its
 * presentational-only callers.
 */
export async function requireActivePageAccount(loginNext?: string): Promise<PageAccessResult> {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      redirectTo: loginNext ? `/auth/login?next=${encodeURIComponent(loginNext)}` : "/auth/login",
    };
  }

  const profile = await fetchProfileLifecycle(supabase, user.id);
  if (!profile) {
    return { ok: false, redirectTo: "/account/status" };
  }

  const effectiveState = computeEffectiveState(profile.accountStatus, profile.accessExpiresAt);
  const lifecycleRedirect = lifecycleDestination(effectiveState);
  if (lifecycleRedirect) {
    return { ok: false, redirectTo: lifecycleRedirect };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      role: profile.role,
      accountStatus: profile.accountStatus,
      accessExpiresAt: profile.accessExpiresAt,
      effectiveState,
      requestedRole: profile.requestedRole,
    },
  };
}

/** Convenience wrapper: call requireActivePageAccount() and redirect immediately on failure. */
export async function requireActivePage(loginNext?: string): Promise<CurrentUser> {
  const access = await requireActivePageAccount(loginNext);
  if (!access.ok) {
    redirect(access.redirectTo);
  }
  return access.user;
}

// ---------------------------------------------------------------------------
// API-route authorization — fails CLOSED on a missing/unreadable profile.
// ---------------------------------------------------------------------------

export type RequireRoleResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; response: NextResponse };

/**
 * API-route helper: requires an authenticated caller whose account is
 * effectively ACTIVE and whose profiles.role is one of `allowedRoles`.
 * Never trusts a role claim from the request body — always re-derives it
 * from the caller's own session.
 *
 * Lifecycle is checked BEFORE role: a PENDING/SUSPENDED/DEACTIVATED/EXPIRED
 * account is rejected regardless of what its role column currently says.
 * A missing or unreadable profile is its own rejection — 403
 * ACCOUNT_PROFILE_UNAVAILABLE — and never synthesized as CLIENT/ACTIVE
 * before falling through to the role check. This is the shared underlying
 * helper for every route using requireApiRole (and, via
 * requireSellerSession's delegation in src/lib/shortlists/authz.ts, every
 * /api/shortlists route and /api/rto-rate too) — fixing it here protects
 * all of them at once.
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

  const profile = await fetchProfileLifecycle(supabase, user.id);

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unable to verify account.", code: ACCOUNT_PROFILE_UNAVAILABLE_CODE },
        { status: 403 }
      ),
    };
  }

  const effectiveState = computeEffectiveState(profile.accountStatus, profile.accessExpiresAt);

  if (effectiveState !== "ACTIVE") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This account cannot use protected features right now.", code: LIFECYCLE_ERROR_CODE[effectiveState] },
        { status: 403 }
      ),
    };
  }

  if (!allowedRoles.includes(profile.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, role: profile.role };
}

export type RequireActiveAccountResult =
  | { ok: true; userId: string; accountStatus: AccountStatus; accessExpiresAt: string | null }
  | { ok: false; response: NextResponse };

/**
 * Narrower than requireApiRole: authenticates the caller and requires their
 * account to be effectively ACTIVE, with no role check at all. For flows
 * that are self-service by design — any authenticated user acting on a
 * resource that is provably their own (matched by id, not by role) — but
 * that must still never be usable by a PENDING/SUSPENDED/DEACTIVATED/
 * EXPIRED, or unverifiable, account. role-change-confirm is the caller: a
 * target user confirming/rejecting a request about themselves is not a
 * role-gated action, so requireApiRole (which always ends in a role check)
 * doesn't fit; this does the lifecycle half only.
 *
 * Fails CLOSED on a missing or unreadable profile, same as requireApiRole.
 */
export async function requireActiveApiAccount(
  supabase: RouteSupabaseClient
): Promise<RequireActiveAccountResult> {
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

  const profile = await fetchProfileLifecycle(supabase, user.id);

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unable to verify account.", code: ACCOUNT_PROFILE_UNAVAILABLE_CODE },
        { status: 403 }
      ),
    };
  }

  const effectiveState = computeEffectiveState(profile.accountStatus, profile.accessExpiresAt);

  if (effectiveState !== "ACTIVE") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This account cannot use protected features right now.", code: LIFECYCLE_ERROR_CODE[effectiveState] },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: user.id, accountStatus: profile.accountStatus, accessExpiresAt: profile.accessExpiresAt };
}
