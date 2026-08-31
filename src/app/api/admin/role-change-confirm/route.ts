// src/app/api/admin/role-change-confirm/route.ts

import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";

const VALID_ROLES = ["CLIENT", "AGENT", "MANAGER", "ADMIN"] as const;
type Role = (typeof VALID_ROLES)[number];

function isValidRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    (VALID_ROLES as readonly string[]).includes(value)
  );
}

export async function POST(req: Request) {
  const { token, decision } = await req.json();

  if (!token || typeof token !== "string" || !["APPROVE", "REJECT"].includes(decision)) {
    return NextResponse.json(
      { error: "Missing or invalid token/decision." },
      { status: 400 }
    );
  }

  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Get the request by token
  const { data: request, error } = await supabase
    .from("role_change_requests")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !request) {
    return NextResponse.json(
      { error: "Role change request not found." },
      { status: 404 }
    );
  }

  if (request.status !== "PENDING") {
    return NextResponse.json(
      { error: "This request is no longer pending." },
      { status: 400 }
    );
  }

  // Only the target user can confirm / reject
  if (request.target_user_id !== session.user.id) {
    return NextResponse.json(
      { error: "You are not allowed to act on this request." },
      { status: 403 }
    );
  }

  // Defense in depth: the row's own requested_role should already be one of
  // the enum values (it was validated when the admin created the request),
  // but never trust it blindly before using it to mutate an authoritative
  // column. Everything used below comes from this already-loaded, validated
  // `request` row — never from the raw request body.
  if (!isValidRole(request.requested_role)) {
    return NextResponse.json(
      { error: "This request has an invalid requested role." },
      { status: 400 }
    );
  }

  let newStatus: "APPROVED" | "REJECTED" = "REJECTED";

  if (decision === "APPROVE") {
    // profiles.role is no longer directly writable by an authenticated
    // user's own session (see supabase/migrations/20260831000000_harden_
    // profiles_write_privileges.sql) — even for the user's own row. The
    // mutation has to go through the service-role client. Scope stays
    // narrow: this is the only write it performs, using only the
    // already-validated target_user_id/requested_role from the row above.
    const { error: updProfileErr } = await adminSupabase()
      .from("profiles")
      .update({ role: request.requested_role })
      .eq("id", request.target_user_id);

    if (updProfileErr) {
      return NextResponse.json(
        { error: `Failed to update role: ${updProfileErr.message}` },
        { status: 500 }
      );
    }

    newStatus = "APPROVED";
  }

  // Mark the request as completed. This is an administrative state
  // transition (PENDING -> APPROVED/REJECTED), not a self-service edit, so
  // it now runs through the same trusted server path as the role mutation
  // above rather than the target user's ordinary session. The extra
  // `.eq("status", "PENDING")` makes this a no-op if the row was already
  // resolved by another request in the meantime (e.g. a double-submitted
  // Approve/Reject) instead of silently overwriting an earlier decision —
  // `.select().maybeSingle()` lets us detect that no-op and report it.
  const { data: updatedRequest, error: updReqErr } = await adminSupabase()
    .from("role_change_requests")
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "PENDING")
    .select("id")
    .maybeSingle();

  if (updReqErr) {
    return NextResponse.json(
      { error: `Failed to update request: ${updReqErr.message}` },
      { status: 500 }
    );
  }

  if (!updatedRequest) {
    // Someone else resolved this request between our read above and this
    // write. Note: if this was an APPROVE, the profiles.role update above
    // already happened and is not rolled back here — see the atomicity
    // limitation in the Phase 0B report.
    return NextResponse.json(
      { error: "This request was already resolved. Please refresh the page." },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    newRole: newStatus === "APPROVED" ? request.requested_role : undefined,
  });
}
