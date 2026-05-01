// src/app/api/manager/crm/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { updateCrmLeadRow, CrmUpdatePayload } from "@/lib/google/crm";

export async function POST(req: NextRequest) {
  try {
    const supabase = await serverSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    const role = profile?.role as string | undefined;
    if (role !== "MANAGER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
