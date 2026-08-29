// src/lib/shortlists/types.ts

export type ClientShortlist = {
  id: string;
  owner_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ShortlistUnit = {
  id: string;
  shortlist_id: string;
  unit_id: string;
  property_code: string;
  tower_code: string;
  building_unit: string;
  saved_price: number | null;
  saved_status: string | null;
  saved_rto_eligible: boolean | null;
  saved_rto_rate: number | null;
  notes: string | null;
  saved_at: string;
  created_at: string;
};

// Same shape as the local UnitRow type in src/app/compare/page.tsx and
// src/app/computation/[unitID]/page.tsx — copied (not imported) for the same
// reason those two don't share one either: /api/availability's enriched response
// isn't exported as a type anywhere in the app yet.
export type AvailabilityRow = {
  property_code: string;
  property_name: string;
  city: string;
  address: string;
  tower_code: string;
  tower_name: string;
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
  unit_id: string;
};

export type RtoInfo = { eligible: boolean; monthly?: number; memo?: string | null };

export type UnitMode = "matched" | "missing" | "checking" | "unavailable";
