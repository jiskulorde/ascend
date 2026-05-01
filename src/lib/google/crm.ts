// src/lib/google/crm.ts
import { google } from "googleapis";

export type CrmLead = {
  rowIndex: number;        // 1-based row index in sheet
  leadId: string;          // A
  dateInquired: string;    // B
  fullName: string;        // C
  mobile: string;          // D
  email: string;           // E
  project: string;         // F
  unit: string;            // G
  cityPreference: string;  // H
  floorPreference: string; // I
  facingPreference: string;// J
  source: string;          // K
  status: string;          // L
  owner: string;           // M
  lastContact: string;     // N
  nextFollowUp: string;    // O
  channel: string;         // P
  priority: string;        // Q
  notes: string;           // R
  daysSince: string;       // S
  overdue: string;         // T
};

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEET_CRM_ID;

  if (!email || !key || !sheetId) {
    throw new Error("Missing Google Sheets CRM env vars.");
  }

  const jwt = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth: jwt });
  return { sheets, sheetId };
}

export async function fetchCrmLeads(): Promise<CrmLead[]> {
  const { sheets, sheetId } = getSheetsClient();
  const range = process.env.GOOGLE_SHEET_CRM_RANGE || "CRM!A1:T";

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  const rows = resp.data.values || [];
  if (rows.length <= 1) return [];

  const dataRows = rows.slice(1); // skip header

  return dataRows.map((row, idx) => {
    const [
      leadId,
      dateInquired,
      fullName,
      mobile,
      email,
      project,
      unit,
      cityPreference,
      floorPreference,
      facingPreference,
      source,
      status,
      owner,
      lastContact,
      nextFollowUp,
      channel,
      priority,
      notes,
      daysSince,
      overdue,
    ] = row;

    const rowIndex = idx + 2; // header is row 1

    return {
      rowIndex,
      leadId: (leadId ?? "").toString(),
      dateInquired: (dateInquired ?? "").toString(),
      fullName: (fullName ?? "").toString(),
      mobile: (mobile ?? "").toString(),
      email: (email ?? "").toString(),
      project: (project ?? "").toString(),
      unit: (unit ?? "").toString(),
      cityPreference: (cityPreference ?? "").toString(),
      floorPreference: (floorPreference ?? "").toString(),
      facingPreference: (facingPreference ?? "").toString(),
      source: (source ?? "").toString(),
      status: (status ?? "").toString(),
      owner: (owner ?? "").toString(),
      lastContact: (lastContact ?? "").toString(),
      nextFollowUp: (nextFollowUp ?? "").toString(),
      channel: (channel ?? "").toString(),
      priority: (priority ?? "").toString(),
      notes: (notes ?? "").toString(),
      daysSince: (daysSince ?? "").toString(),
      overdue: (overdue ?? "").toString(),
    };
  });
}

// ----- UPDATE HELPERS -----

export type CrmUpdatePayload = {
  status?: string;
  owner?: string;
  lastContact?: string;
  nextFollowUp?: string;
  channel?: string;
  priority?: string;
  notes?: string;
};

export async function updateCrmLeadRow(
  rowIndex: number,
  updates: CrmUpdatePayload
) {
  const { sheets, sheetId } = getSheetsClient();

  // Columns L–R (12–18) → status, owner, lastContact, nextFollowUp, channel, priority, notes
  const range = `CRM!L${rowIndex}:R${rowIndex}`;

  const values: (string | null)[] = [
    updates.status ?? null,       // L
    updates.owner ?? null,        // M
    updates.lastContact ?? null,  // N
    updates.nextFollowUp ?? null, // O
    updates.channel ?? null,      // P
    updates.priority ?? null,     // Q
    updates.notes ?? null,        // R
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values],
    },
  });
}
