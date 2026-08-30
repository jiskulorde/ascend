// src/lib/availability/inventory.ts

import { getGoogleSheetValues } from "@/lib/googleSheets";
import { adminSupabase } from "@/lib/supabase/admin";

// Build a stable canonical unit id (code-safe, URL-safe)
function makeUnitIdCanonical(opts: {
  property_code?: string;
  tower_code?: string;
  building_unit?: string;
}) {
  const p = (opts.property_code || "").trim();
  const t = (opts.tower_code || "").trim();
  const b = (opts.building_unit || "").trim().replace(/\s+/g, "_");
  return [p, t, b].filter(Boolean).join("__"); // e.g. AGP__AGP-00A__C-Amina_1204
}

const parseMoney = (raw: any) =>
  parseFloat(String(raw ?? "0").replace(/[^0-9.-]+/g, "")) || 0;

export type AvailabilityRow = {
  // meta
  property_code: string;
  property_name: string;
  city: string;
  address: string;
  tower_code: string;
  tower_name: string;

  // original / normalized numeric fields
  Property: string;
  BuildingUnit: string;
  Tower: string;
  Floor: string;
  Status: string;
  Type: string;
  GrossAreaSQM: number;
  Amenities: string;
  Facing: string;
  RFODate: string;
  ListPrice: number;
  PerSQM: number;

  // canonical id for linking
  unit_id: string;
};

export type LatestLog = { date: string; time: string; fileName: string } | null;

export type AvailabilityInventory = {
  data: AvailabilityRow[];
  latestLog: LatestLog;
};

/**
 * Single source of truth for loading + enriching the current inventory from
 * Google Sheets (raw availability + process log) joined with Supabase
 * property/tower metadata. Extracted from the original body of
 * GET /api/availability so both the authenticated full endpoint and the
 * public /api/availability/preview endpoint read from exactly one
 * implementation — the Google Sheet and its enrichment logic are unchanged.
 */
export async function loadAvailabilityInventory(): Promise<AvailabilityInventory> {
  // 1) Pull availability + process log from Google Sheets
  const spreadsheetId = process.env.GOOGLE_SHEET_AVAILABILITY_ID || "";

  const availabilityRange =
    process.env.GOOGLE_SHEET_AVAILABILITY_RANGE || "Database!A1:L";
  const availabilityValues = await getGoogleSheetValues(
    spreadsheetId,
    availabilityRange
  );
  const [availabilityHeader, ...availabilityRows] = availabilityValues;
  const baseRows = availabilityRows.map((row) =>
    Object.fromEntries(availabilityHeader.map((key, i) => [key, row[i] || ""]))
  );

  const logRange = "Process Log!A1:D";
  const logValues = await getGoogleSheetValues(spreadsheetId, logRange);
  let latestLog: LatestLog = null;
  if (logValues.length > 1) {
    const [_, ...logRows] = logValues;
    const lastRow = logRows[logRows.length - 1];
    const timestamp = lastRow[0] || ""; // "26/08/2025 12:52:09"
    const fileName = lastRow[2] || "";
    const [d, m, yTime] = timestamp.split("/");
    const [y, time] = (yTime || "").split(" ");
    const formattedDate = new Date(`${m}/${d}/${y}`);
    latestLog = {
      date: formattedDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: time || "",
      fileName,
    };
  }

  // 2) Pull meta maps from Supabase
  const supa = adminSupabase();

  const { data: propsMeta, error: propsErr } = await supa
    .from("property_meta")
    .select("code,name,city,address,active");
  if (propsErr) throw propsErr;

  const { data: towersMeta, error: towersErr } = await supa
    .from("tower_meta")
    .select("property_code,tower_code,tower_name");
  if (towersErr) throw towersErr;

  const propByCode = new Map<string, any>();
  const propByNameLower = new Map<string, any>();
  (propsMeta || []).forEach((p) => {
    propByCode.set((p.code || "").trim(), p);
    propByNameLower.set((p.name || "").trim().toLowerCase(), p);
  });

  const towerByCode = new Map<string, any>();
  (towersMeta || []).forEach((t) => {
    towerByCode.set((t.tower_code || "").trim(), t);
  });

  // 3) Enrich rows
  const enriched: AvailabilityRow[] = baseRows.map((p: any) => {
    const propertyRaw = String(p.Property || "").trim();
    const towerCode = String(p.Tower || "").trim(); // ex: AGP-00A
    const buildingUnit = String(p["Building Unit"] || "").trim();

    // Decide property_code (prefer code; fallback name lookup)
    let property_code = "";
    let propMeta: any | undefined = undefined;

    const looksLikeCode = /^[A-Z0-9]{2,5}$/.test(propertyRaw); // AGP, VAL, etc.
    if (looksLikeCode) {
      property_code = propertyRaw;
      propMeta = propByCode.get(property_code);
    } else {
      // Treat it as a name; try to find by name
      const pm = propByNameLower.get(propertyRaw.toLowerCase());
      if (pm) {
        property_code = pm.code;
        propMeta = pm;
      } else {
        property_code = propertyRaw; // fallback to whatever came
      }
    }

    const towerMeta = towerByCode.get(towerCode);

    const out: AvailabilityRow = {
      // meta
      property_code,
      property_name: propMeta?.name || propertyRaw,
      city: propMeta?.city || "",
      address: propMeta?.address || "",
      tower_code: towerCode,
      tower_name: towerMeta?.tower_name || "",

      // original / normalized numeric fields
      Property: propertyRaw,
      BuildingUnit: buildingUnit,
      Tower: towerCode,
      Floor: String(p.Floor ?? ""),
      Status: String(p.Status ?? ""),
      Type: String(p.Type ?? ""),
      GrossAreaSQM: Number(p["Gross Area(SQM)"] || 0),
      Amenities: String(p.Amenities ?? ""),
      Facing: String(p.Facing ?? ""),
      RFODate: String(p["RFO Date"] || ""),
      ListPrice: parseMoney(p["List Price"]),
      PerSQM: parseMoney(p["per SQM"]),

      // canonical id for linking
      unit_id: makeUnitIdCanonical({
        property_code,
        tower_code: towerCode,
        building_unit: buildingUnit,
      }),
    };

    return out;
  });

  return { data: enriched, latestLog };
}
