// src/app/account/pending/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getVerifiedCurrentUser, isSellerRole } from "@/lib/auth/role";

export const dynamic = "force-dynamic";

const REQUESTED_ROLE_LABELS: Record<string, string> = {
  CLIENT: "Buyer / Client",
  AGENT: "Property Consultant / Agent",
  MANAGER: "Manager",
};

// Landing page for a newly-registered, not-yet-approved account (Phase 3B).
// No seller/Admin tools, no fake approval time or queue position — just an
// honest status and a way out (Home, or sign out).
export default async function AccountPendingPage() {
  // getVerifiedCurrentUser() fails closed: null means either no session, or
  // an authenticated session whose profile is missing/unreadable — neither
  // is treated as ACTIVE. Both land on login here since this page (and
  // /account/status) are already the fail-closed destination; there's
  // nothing more specific to redirect an unverifiable profile to.
  const currentUser = await getVerifiedCurrentUser();

  if (!currentUser) {
    redirect("/auth/login?next=/account/pending");
  }

  // An ACTIVE user manually visiting this page is sent to their normal
  // destination instead of being stuck here — no redirect loop.
  if (currentUser.effectiveState === "ACTIVE") {
    redirect(isSellerRole(currentUser.role) ? "/dashboard" : "/");
  }

  // Any other non-PENDING effective state (SUSPENDED/DEACTIVATED/EXPIRED)
  // belongs on the generic status page, not here.
  if (currentUser.effectiveState !== "PENDING") {
    redirect("/account/status");
  }

  const requestedLabel = currentUser.requestedRole
    ? REQUESTED_ROLE_LABELS[currentUser.requestedRole] ?? currentUser.requestedRole
    : null;

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Account Pending Approval</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account has been created and is waiting for administrator approval.
          We&apos;ll let you know once it&apos;s ready — there&apos;s nothing else you need to do right now.
        </p>

        <div className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Requested account type: </span>
          <span className="font-medium text-foreground">{requestedLabel || "Not specified"}</span>
        </div>

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
