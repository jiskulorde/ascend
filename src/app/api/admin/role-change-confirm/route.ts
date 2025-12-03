// src/app/api/admin/role-change-confirm/route.ts

import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { token, decision } = await req.json();

  if (!token || !["APPROVE", "REJECT"].includes(decision)) {
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

  let newStatus: "APPROVED" | "REJECTED" = "REJECTED";

  if (decision === "APPROVE") {
    // Update the user's role in profiles
    const { error: updProfileErr } = await supabase
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

  // Mark the request as completed
  const { error: updReqErr } = await supabase
    .from("role_change_requests")
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (updReqErr) {
    return NextResponse.json(
      { error: `Failed to update request: ${updReqErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    newRole: newStatus === "APPROVED" ? request.requested_role : undefined,
  });
}
