// app/api/availability/[unitId]/route.ts
import { NextResponse } from "next/server";
import { getGoogleSheetValues } from "@/lib/googleSheets";

export async function GET(
  req: Request,
  context: { params: Promise<{ unitId: string }> }
) {
  const { unitId } = await context.params; // ✅ must await params
  try {
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
