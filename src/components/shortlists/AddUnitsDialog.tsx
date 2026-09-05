// src/components/shortlists/AddUnitsDialog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildUnitSnapshots, saveUnitsToShortlist, type SavableUnit } from "@/lib/shortlists/save";
import { membershipKey } from "@/lib/shortlists/membership";
import { rtoTypeCandidates } from "@/lib/financing";
import type { AvailabilityRow, RtoInfo, ShortlistUnit } from "@/lib/shortlists/types";

// Mirrors statusTone() in AvailabilityClient/UnitCard (not exported from
// either, so this is a same-scheme copy, not an import).
function statusTone(status: string) {
  const value = String(status || "").toLowerCase();
  if (value.startsWith("avail")) return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (value.includes("hold")) return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function fmtPhp(n: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
}

// Same key shape as ShortlistDetailClient's rtoKeyFor()/save.ts's rtoKeyFor() —
// each file keeps its own one-liner rather than sharing an export, consistent
// with how this dedup key is already handled elsewhere in this feature.
function rtoKeyFor(row: AvailabilityRow): string {
  return `${row.property_code}::${row.GrossAreaSQM}::${rtoTypeCandidates(row.Type).join("|")}`;
}

const MAX_RESULTS = 40;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  shortlistName: string;
  availabilityRows: AvailabilityRow[];
  availabilityState: "loading" | "ready" | "error";
  // Physical-identity keys (membershipKey format) already saved in THIS
  // shortlist — derived by the caller from its own already-loaded `units`, so
  // this dialog needs no new API call to know what's already added.
  existingKeys: Set<string>;
  // Best-effort only: RTO info ShortlistDetailClient has already resolved for
  // ITS OWN saved units, reused here to show an indicator on a search result
  // that happens to share the same (project, area, type) lookup key — never a
  // fresh fetch triggered by search results themselves.
  rtoByKey?: Record<string, RtoInfo>;
  onAdded: (newUnits: ShortlistUnit[]) => void;
};

export default function AddUnitsDialog({
  open,
  onOpenChange,
  shortlistId,
  shortlistName,
  availabilityRows,
  availabilityState,
  existingKeys,
  rtoByKey,
  onAdded,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedUnitIds(new Set());
    setSubmitting(false);
    setSubmitError(null);
    setSuccessMessage(null);
  }, [open]);

  // Filter first, then cap — with ~8,000 units this still runs well under a
  // frame per keystroke, so no debouncing/virtualization is needed for a
  // capped 40-row result set.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = availabilityRows.filter((r) => {
      const haystack = [r.property_name, r.property_code, r.tower_name, r.tower_code, r.BuildingUnit, r.Type, r.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    return matches.slice(0, MAX_RESULTS);
  }, [query, availabilityRows]);

  function toggleUnit(unitId: string) {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  async function handleAdd() {
    if (selectedUnitIds.size === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const selectedRows = availabilityRows.filter((r) => selectedUnitIds.has(r.unit_id));
      const savable: SavableUnit[] = selectedRows.map((r) => ({
        unit_id: r.unit_id,
        property_code: r.property_code,
        tower_code: r.tower_code,
        building_unit: r.BuildingUnit,
        ListPrice: r.ListPrice,
        Status: r.Status,
        Type: r.Type,
        GrossAreaSQM: r.GrossAreaSQM,
      }));

      const snapshots = await buildUnitSnapshots(savable);
      const outcome = await saveUnitsToShortlist(shortlistId, snapshots);

      if (outcome.savedUnits.length > 0) {
        onAdded(outcome.savedUnits);
      }

      if (outcome.fatal === "unauthorized") {
        setSubmitError("Your session has expired. Please sign in again.");
        return;
      }
      if (outcome.fatal === "forbidden") {
        setSubmitError("You don't have permission to add units to this shortlist.");
        return;
      }
      if (outcome.fatal === "not_found") {
        setSubmitError("This shortlist no longer exists.");
        return;
      }

      const savedCount = outcome.savedUnitIds.length;
      const alreadyCount = outcome.alreadySavedUnitIds.length;
      const failedCount = outcome.failedUnitIds.length;

      const parts: string[] = [];
      if (savedCount > 0) parts.push(savedCount === 1 ? "1 unit added" : `${savedCount} units added`);
      if (alreadyCount > 0) parts.push(`${alreadyCount} already in this shortlist`);
      let message = parts.length > 0 ? `${parts.join(", ")}.` : "Nothing was added.";
      if (failedCount > 0) message += ` ${failedCount} failed — please try again.`;

      setSuccessMessage(message);
      setSelectedUnitIds(new Set());
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!submitting ? onOpenChange(v) : null)}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Units to {shortlistName}</DialogTitle>
          <DialogDescription>Search current inventory and add one or more units to this shortlist.</DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSuccessMessage(null);
            }}
            placeholder="Search project, tower, unit #, type…"
            disabled={submitting || availabilityState !== "ready"}
            className="pl-9"
          />
        </div>

        {availabilityState === "loading" && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Loading current inventory…
          </div>
        )}
        {availabilityState === "error" && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Current inventory could not be loaded, so search is not available right now. This shortlist&rsquo;s saved data is unaffected.</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {submitError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
          {availabilityState === "ready" && !query.trim() && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Type to search current inventory.
            </div>
          )}
          {availabilityState === "ready" && query.trim() && results.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No matching units found.</div>
          )}
          {results.length > 0 && (
            <ul className="divide-y">
              {results.map((r) => {
                const key = membershipKey({
                  property_code: r.property_code,
                  tower_code: r.tower_code,
                  building_unit: r.BuildingUnit,
                });
                const alreadyAdded = existingKeys.has(key);
                const isSelected = selectedUnitIds.has(r.unit_id);
                const rto = rtoByKey?.[rtoKeyFor(r)];

                return (
                  <li key={r.unit_id}>
                    <label
                      className={`flex items-start gap-2.5 px-3 py-2.5 text-sm ${
                        alreadyAdded ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted"
                      } ${isSelected ? "bg-primary/10" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyAdded || submitting}
                        onChange={() => toggleUnit(r.unit_id)}
                        aria-label={`Select ${r.property_name} ${r.BuildingUnit}`}
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ accentColor: "var(--dmci-blue-500)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-foreground">{r.property_name}</span>
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(
                              r.Status
                            )}`}
                          >
                            {r.Status || "—"}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {(r.tower_name || r.tower_code) + " • " + r.BuildingUnit} • {r.Type || "—"} •{" "}
                          {r.GrossAreaSQM || 0} sqm
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="ph-currency text-sm font-bold text-foreground">{fmtPhp(r.ListPrice)}</span>
                          {rto?.status === "eligible" && (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                              RTO eligible
                            </span>
                          )}
                          {alreadyAdded && (
                            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                              Already added
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Done
          </Button>
          <Button type="button" onClick={handleAdd} disabled={submitting || selectedUnitIds.size === 0}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting
              ? "Adding…"
              : selectedUnitIds.size > 0
              ? `Add Selected (${selectedUnitIds.size})`
              : "Add Selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
