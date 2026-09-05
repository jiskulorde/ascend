// src/app/api/manager/crm/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";
import { requireApiRole } from "@/lib/auth/role";
import { updateCrmLeadRow, CrmUpdatePayload } from "@/lib/google/crm";

export async function POST(req: NextRequest) {
  try {
    const supabase = await actionSupabase();

    // Lifecycle-aware, fail-closed authorization (same allowed roles as
    // before: MANAGER or ADMIN) — a PENDING/SUSPENDED/DEACTIVATED/EXPIRED
    // account, or one whose profile can't be verified at all, is rejected
    // before the role check ever runs. Replaces the previous inline
    // getSession() + profiles.select("role") check, which had no lifecycle
    // awareness. No other behavior in this route changed.
    const authz = await requireApiRole(supabase, ["MANAGER", "ADMIN"]);
    if (!authz.ok) return authz.response;

    const body = await req.json();
    const { rowIndex, updates } = body as {
      rowIndex: number;
      updates: CrmUpdatePayload;
    };

    if (!rowIndex || typeof rowIndex !== "number") {
      return NextResponse.json(
        { error: "rowIndex is required" },
        { status: 400 }
      );
    }

    await updateCrmLeadRow(rowIndex, updates);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[crm/update] error", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
