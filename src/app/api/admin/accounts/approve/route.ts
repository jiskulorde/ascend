// src/app/api/admin/accounts/approve/route.ts
import { NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/role";

// Admin-only: approve a PENDING account, assigning its final authoritative
// role. POST body: { userId: string, role: "CLIENT" | "AGENT" | "MANAGER" }.
// ADMIN is never an accepted value here — promotion to ADMIN stays a
// separate, future, more-strongly-confirmed governance action.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_FINAL_ROLES = ["CLIENT", "AGENT", "MANAGER"] as const;
type FinalRole = (typeof ALLOWED_FINAL_ROLES)[number];

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function isValidFinalRole(value: unknown): value is FinalRole {
  return typeof value === "string" && (ALLOWED_FINAL_ROLES as readonly string[]).includes(value);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || !isValidUuid(body.userId)) {
    return NextResponse.json({ error: "A valid userId is required." }, { status: 400 });
  }

  if (!isValidFinalRole(body.role)) {
    return NextResponse.json({ error: "role must be CLIENT, AGENT, or MANAGER." }, { status: 400 });
  }

  const supabase = await actionSupabase();

  // Caller must be authenticated, effectively ACTIVE, and ADMIN — never
  // trusted from the request body.
  const authz = await requireApiRole(supabase, ["ADMIN"]);
  if (!authz.ok) return authz.response;

  if (body.userId === authz.userId) {
    return NextResponse.json({ error: "You cannot approve your own account." }, { status: 400 });
  }

  // Single atomic conditional UPDATE (Part L): all approval fields are
  // written together, gated on account_status = 'PENDING' still being true
  // at write time — not on a prior SELECT. If a second Admin's request
  // reaches here after this one already won, this returns zero rows,
  // handled below as a clean 409 rather than silently double-processing or
  // clobbering a decision another Admin already made. requested_role is
  // deliberately NOT written here — it stays exactly as the trigger
  // recorded it, a historical "what they asked for" independent of
  // whatever final role this Admin actually approves them for.
  const { data, error } = await adminSupabase()
    .from("profiles")
    .update({
      role: body.role,
      account_status: "ACTIVE",
      approved_by: authz.userId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", body.userId)
    .eq("account_status", "PENDING")
    .select("id, role, account_status, requested_role, approved_by, approved_at")
    .maybeSingle();

  if (error) {
    console.error("[admin/accounts/approve] update failed", error);
    return NextResponse.json(
      { error: "Failed to approve this account. Please try again." },
      { status: 500 }
    );
  }

  if (!data) {
    // Zero rows matched: either the target never existed, or it's no longer
    // PENDING (already approved/handled — including by another Admin who
    // won a concurrent request). Checked only for a clearer message; this
    // read does not gate or affect the mutation above in any way.
    const { data: existing } = await adminSupabase()
      .from("profiles")
      .select("id")
      .eq("id", body.userId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    return NextResponse.json(
      { error: "This account is no longer pending approval." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, profile: data });
}
