import { NextResponse } from "next/server";
import { getGoogleSheetValues } from "@/lib/googleSheets";

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_AVAILABILITY_ID || "";
    const range = process.env.GOOGLE_SHEET_AVAILABILITY_RANGE || "Database!A1:L";

    const values = await getGoogleSheetValues(spreadsheetId, range);

    // Convert first row into headers, rest into objects
    const [header, ...rows] = values;
    const data = rows.map((row) =>
      Object.fromEntries(header.map((key, i) => [key, row[i] || ""]))
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch availability" }, { status: 500 });
  }
}
