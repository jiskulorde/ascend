// src/app/api/admin/role-change-request/route.ts

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { actionSupabase } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { requireApiRole } from "@/lib/auth/role";
import { sendRoleChangeEmail } from "@/lib/email/mailer";

const ALLOWED_ROLES = ["CLIENT", "AGENT", "MANAGER", "ADMIN"] as const;

export async function POST(req: Request) {
  const { userId, newRole } = await req.json();

  if (!userId || !ALLOWED_ROLES.includes(newRole)) {
    return NextResponse.json(
      { error: "Invalid userId or role." },
      { status: 400 }
    );
  }

  const supabase = await actionSupabase();

  // Requires an effectively ACTIVE ADMIN (Phase 3B) — previously an inline
  // role-only check, which meant a PENDING/SUSPENDED/DEACTIVATED/EXPIRED
  // Admin account could still issue role-change requests.
  const authz = await requireApiRole(supabase, ["ADMIN"]);
  if (!authz.ok) return authz.response;

  const me = { id: authz.userId };

  // requireApiRole() doesn't return email, only role — a cheap second call
  // for the "requested by" line in the notification email below.
  const {
    data: { user: callerUser },
  } = await supabase.auth.getUser();

  // Use admin client to get the target user's email from auth.users
  const adminClient = adminSupabase();
  const { data: targetUser, error: targetError } =
    await adminClient.auth.admin.getUserById(userId);

  if (targetError || !targetUser?.user) {
    return NextResponse.json(
      { error: targetError?.message || "Target user not found." },
      { status: 404 }
    );
  }

  const targetEmail = targetUser.user.email;
  const targetName =
    (targetUser.user.user_metadata as any)?.full_name ?? null;

  if (!targetEmail) {
    return NextResponse.json(
      { error: "Target user has no email on record." },
      { status: 400 }
    );
  }

  const token = randomUUID();

  const { data: inserted, error } = await supabase
    .from("role_change_requests")
    .insert({
      target_user_id: userId,
      requested_role: newRole,
      requested_by: me.id,
      token,
      status: "PENDING",
    })
    .select("id, created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message || "Failed to create request." },
      { status: 500 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const confirmUrl = `${baseUrl}/role-change/${token}`;

  try {
    await sendRoleChangeEmail({
      to: targetEmail,
      newRole,
      confirmUrl,
      targetName,
      requestedByEmail: callerUser?.email ?? null,
    });
  } catch (mailError: any) {
    console.error("[role-change-request] email error", mailError);
    // We still keep the DB row but tell the UI something went wrong.
    return NextResponse.json(
      {
        error:
          "Role request saved, but failed to send email. Check server logs.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
