import { NextResponse } from "next/server";
import { getGoogleSheetValues } from "@/lib/googleSheets";

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_AVAILABILITY_ID || "";

    // Availability data
    const availabilityRange = process.env.GOOGLE_SHEET_AVAILABILITY_RANGE || "Database!A1:L";
    const availabilityValues = await getGoogleSheetValues(spreadsheetId, availabilityRange);

    const [availabilityHeader, ...availabilityRows] = availabilityValues;
    const availabilityData = availabilityRows.map((row) =>
      Object.fromEntries(availabilityHeader.map((key, i) => [key, row[i] || ""]))
    );

    // Process Log (get latest processed file info)
    const logRange = "Process Log!A1:D"; // Timestamp, Match Type, File Name, Rows Copied
    const logValues = await getGoogleSheetValues(spreadsheetId, logRange);

    let latestLog: { date: string; time: string; fileName: string } | null = null;

    if (logValues.length > 1) {
      const [logHeader, ...logRows] = logValues;

      // Pick the last row (latest entry)
      const lastRow = logRows[logRows.length - 1];
      const timestamp = lastRow[0]; // e.g. "26/08/2025 12:52:09"
      const fileName = lastRow[2] || "";

      // Format date + time
      const [day, month, yearAndTime] = timestamp.split("/");
      const [year, time] = yearAndTime.split(" ");
      const formattedDate = new Date(`${month}/${day}/${year}`);
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };

      latestLog = {
        date: formattedDate.toLocaleDateString("en-US", options), // "August 26, 2025"
        time: time, // "12:52:09"
        fileName,
      };
    }

    return NextResponse.json({
      success: true,
      data: availabilityData,
      latestLog,
    });
  } catch (error) {
    console.error("Error fetching availability or process log:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
