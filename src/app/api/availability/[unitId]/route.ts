// app/api/availability/[unitId]/route.ts
import { NextResponse } from "next/server";
import { getGoogleSheetValues } from "@/lib/googleSheets";
import { actionSupabase } from "@/lib/supabase/server";
import { requireApiRole, SELLER_ROLES } from "@/lib/auth/role";

// Returns the full, unfiltered sheet row for a single unit — the same
// full-inventory sensitivity as GET /api/availability, just scoped to one
// row. Previously had no auth check at all (found during the Phase 1 API
// audit) despite not being called from any current client code; locked down
// to the same AGENT/MANAGER/ADMIN-only rule as the rest of full inventory
// rather than left open because nothing currently calls it. Now routed
// through requireApiRole (Phase 3B) for lifecycle enforcement too.
export async function GET(
  req: Request,
  context: { params: Promise<{ unitId: string }> }
) {
  const { unitId } = await context.params; // ✅ must await params
  try {
    const supabase = await actionSupabase();
    const authz = await requireApiRole(supabase, SELLER_ROLES);
    if (!authz.ok) return authz.response;

    const spreadsheetId = process.env.GOOGLE_SHEET_AVAILABILITY_ID || "";
    const range = process.env.GOOGLE_SHEET_AVAILABILITY_RANGE || "Database!A1:L";

    const values = await getGoogleSheetValues(spreadsheetId, range);

    if (!values || values.length === 0) {
      return NextResponse.json({ success: false, error: "No data found" }, { status: 404 });
    }

    const [header, ...rows] = values;
    const data = rows.map((row) =>
      Object.fromEntries(header.map((key, i) => [key, row[i] || ""]))
    );

    // Lookup by Building Unit
    const unit = data.find(
      (row) =>
        row["Building Unit"]?.toString().trim().toLowerCase() ===
        unitId.trim().toLowerCase()
    );

    if (!unit) {
      return NextResponse.json({ success: false, error: "Unit not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: unit });
  } catch (error) {
    console.error("Error fetching unit:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch unit" }, { status: 500 });
  }
}
