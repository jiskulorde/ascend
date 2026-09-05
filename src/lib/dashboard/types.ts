// src/lib/dashboard/types.ts
//
// Shared shape between GET /api/dashboard/seller-summary and
// SellerDashboardClient. Kept separate from src/lib/shortlists/types.ts
// because these are dashboard-summary projections, not the underlying
// shortlist/shortlist_units row shapes.

export type ShortlistSummary = {
  id: string;
  name: string;
  notes: string | null;
  updated_at: string;
  unit_count: number;
  // null means "unknown" — the inventory load failed, so attention could not
  // be computed. Never conflate with 0 (a real "no changes" result).
  attention_count: number | null;
};

export type AttentionChange =
  | { kind: "PRICE_CHANGED"; saved_price: number | null; current_price: number }
  | { kind: "STATUS_CHANGED"; saved_status: string | null; current_status: string };

// One entry per shortlist_units row that needs attention — never split one
// unit's price + status change into two separate entries.
export type AttentionItem = {
  shortlist_unit_id: string;
  shortlist_id: string;
  shortlist_name: string;
  // Current property/unit label when matched in current inventory, else the
  // saved physical identity (property_code + building_unit).
  property_label: string;
  status: "changed" | "missing";
  changes: AttentionChange[]; // empty when status === "missing"
  saved_price: number | null;
  saved_status: string | null;
};

export type LatestInventoryLog = { date: string; time: string; fileName: string } | null;

export type SellerSummaryResponse = {
  success: true;
  shortlists: ShortlistSummary[];
  attention: {
    available: boolean; // false when the inventory load failed
    items: AttentionItem[]; // capped server-side; see totalCount for the real total
    totalCount: number;
  };
  inventory: {
    available: boolean;
    availableUnitCount: number | null;
    latestLog: LatestInventoryLog;
  };
};
