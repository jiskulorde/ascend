// src/app/account/status/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getVerifiedCurrentUser, isSellerRole } from "@/lib/auth/role";

export const dynamic = "force-dynamic";

// Generic landing page for a signed-in account that is effectively
// SUSPENDED, DEACTIVATED, or EXPIRED. No suspension/expiration controls
// live here (those ship in a later phase) — this is only the safe,
// no-loop destination those future features will redirect into, plus what
// Phase 3B's own redirect logic already needs to point at today even
// though no account can reach this state yet (every existing account is
// ACTIVE, and nothing in this phase can set SUSPENDED/DEACTIVATED, and
// access_expires_at is always NULL).
export default async function AccountStatusPage() {
  // getVerifiedCurrentUser() fails closed — see the note in
  // account/pending/page.tsx for why collapsing "no session" and
  // "unverifiable profile" into the same login redirect is safe here.
  const currentUser = await getVerifiedCurrentUser();

  if (!currentUser) {
    redirect("/auth/login?next=/account/status");
  }

  if (currentUser.effectiveState === "ACTIVE") {
    redirect(isSellerRole(currentUser.role) ? "/dashboard" : "/");
  }

  if (currentUser.effectiveState === "PENDING") {
    redirect("/account/pending");
  }

  const message =
    currentUser.effectiveState === "SUSPENDED"
      ? "Your account has been temporarily suspended."
      : currentUser.effectiveState === "DEACTIVATED"
      ? "Your account has been deactivated."
      : "Your account access has expired.";

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Access Unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {message} Please contact an administrator if you believe this is a mistake.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className="btn btn-outline">
            Return to Home
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost w-full">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
