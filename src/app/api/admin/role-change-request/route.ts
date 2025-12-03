// src/app/api/admin/role-change-request/route.ts

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { serverSupabase } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { sendRoleChangeEmail } from "@/lib/email/mailer";

const ALLOWED_ROLES = ["CLIENT", "AGENT", "MANAGER", "ADMIN"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export async function POST(req: Request) {
  const { userId, newRole } = await req.json();

  if (!userId || !ALLOWED_ROLES.includes(newRole)) {
    return NextResponse.json(
      { error: "Invalid userId or role." },
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

  // Check caller is ADMIN (using profiles table via anon client)
  const { data: me, error: meError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", session.user.id)
    .single();

  if (meError || !me || me.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only admins can request role changes." },
      { status: 403 }
    );
  }

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
      requestedByEmail: session.user.email ?? null,
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
