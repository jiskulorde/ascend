// src/components/shortlists/UnitCard.tsx
"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, Minus, Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { computeQuote, fmtPhp } from "@/lib/financing";
import type { AvailabilityRow, RtoInfo, ShortlistUnit, UnitMode } from "@/lib/shortlists/types";

// Mirrors statusTone() in src/components/availability/AvailabilityClient.tsx (not
// exported there, so this is a same-scheme copy, not an import) so status badges
// look consistent with the rest of the app.
function statusTone(status: string) {
  const value = String(status || "").toLowerCase();
  if (value.startsWith("avail")) return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (value.includes("hold")) return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

type Props = {
  unit: ShortlistUnit;
  current: AvailabilityRow | undefined;
  mode: UnitMode;
  rtoInfo: RtoInfo | undefined;
  rtoLoading: boolean;
  selected: boolean;
  selectable: boolean;
  onToggleSelect: () => void;
  onEditNote: () => void;
  onRemove: () => void;
};

export default function UnitCard({
  unit,
  current,
  mode,
  rtoInfo,
  rtoLoading,
  selected,
  selectable,
  onToggleSelect,
  onEditNote,
  onRemove,
}: Props) {
  const title = current ? current.property_name : unit.property_code;
  const subtitle = current
    ? `${current.tower_name || current.tower_code} • ${current.BuildingUnit}`
    : `${unit.tower_code} • ${unit.building_unit}`;

  const savedDate = (() => {
    try {
      return format(new Date(unit.saved_at), "MMM d, yyyy");
    } catch {
      return unit.saved_at;
    }
  })();

  const priceChange =
    current && unit.saved_price != null ? current.ListPrice - unit.saved_price : null;

  const statusChanged =
    current && unit.saved_status && unit.saved_status.trim() !== current.Status.trim();

  const quote = current
    ? computeQuote({ listPrice: current.ListPrice })
    : null;

  const rtoTotalMonthly =
    quote && rtoInfo?.eligible ? quote.dpMonthly + (rtoInfo.monthly || 0) : null;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2 bg-[#0f172a] px-4 py-3 text-white">
        <div className="flex min-w-0 items-start gap-2.5">
          {mode === "matched" && (
            <input
              type="checkbox"
              checked={selected}
              disabled={!selectable}
              onChange={onToggleSelect}
              aria-label={`Select ${title} for comparison`}
              className="mt-1 h-4 w-4 shrink-0 rounded border-white/40 disabled:opacity-40"
              style={{ accentColor: "var(--dmci-blue-500)" }}
            />
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold" title={title}>
              {title}
            </div>
            <div className="truncate text-xs opacity-90">{subtitle}</div>
          </div>
        </div>

        {mode === "matched" && current && (
          <span
            className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(
              current.Status
            )}`}
          >
            {current.Status || "—"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 text-sm">
        {mode === "missing" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            No longer in current inventory
          </div>
        )}
        {mode === "unavailable" && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            Current inventory data is temporarily unavailable — showing saved details only.
          </div>
        )}
        {mode === "checking" && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Checking current inventory…
          </div>
        )}

        {mode === "matched" && current && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div>
              <div className="text-muted-foreground">Unit Type</div>
              <div className="font-semibold text-foreground">{current.Type || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Area</div>
              <div className="font-semibold text-foreground">{current.GrossAreaSQM || 0} sqm</div>
            </div>
            <div>
              <div className="text-muted-foreground">Facing</div>
              <div className="font-semibold text-foreground">{current.Facing || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Floor</div>
              <div className="font-semibold text-foreground">{current.Floor || "—"}</div>
            </div>
          </div>
        )}

        {/* Price: saved vs current (matched) or saved-only (missing/unavailable/checking) */}
        <div className="rounded-lg border px-3 py-2">
          {unit.saved_price != null ? (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Saved price</span>
              <span className="ph-currency font-semibold text-foreground">{fmtPhp(unit.saved_price)}</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No saved price on record</div>
          )}

          {mode === "matched" && current && (
            <>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Current list price</span>
                <span className="ph-currency font-semibold text-foreground">{fmtPhp(current.ListPrice)}</span>
              </div>
              {priceChange !== null && (
                <div
                  className={`mt-1.5 flex items-center gap-1 border-t pt-1.5 text-xs font-semibold ${
                    priceChange > 0
                      ? "text-rose-600"
                      : priceChange < 0
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {priceChange > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : priceChange < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                  <span className="ph-currency">
                    {priceChange === 0
                      ? "Unchanged"
                      : `${priceChange > 0 ? "+" : "-"}${fmtPhp(Math.abs(priceChange))}`}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {statusChanged && current && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            <span className="truncate">{unit.saved_status}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{current.Status}</span>
          </div>
        )}

        {mode === "matched" && quote && (
          <>
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="text-xs text-muted-foreground">Monthly DP</div>
              <div className="ph-currency text-lg font-extrabold text-blue-900">{fmtPhp(quote.dpMonthly)}</div>
            </div>

            {rtoLoading ? (
              <div className="text-[11px] italic text-muted-foreground">Checking RTO eligibility…</div>
            ) : rtoInfo?.eligible ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">RTO Eligible</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>RTO monthly rate</span>
                  <b className="ph-currency text-foreground">{fmtPhp(rtoInfo.monthly || 0)}</b>
                </div>
                <div className="mt-1.5 border-t border-emerald-200 pt-1.5">
                  <div className="text-xs text-muted-foreground">Total Monthly (DP + RTO)</div>
                  <div className="ph-currency text-lg font-extrabold text-emerald-800">
                    {fmtPhp(rtoTotalMonthly ?? 0)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] italic text-muted-foreground">Not available for RTO</div>
            )}

            <div className="rounded-lg border">
              <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 text-xs font-medium">
                <span>Bank Balance</span>
                <b className="ph-currency">{fmtPhp(quote.bankBalance)}</b>
              </div>
              <div className="grid grid-cols-2 divide-x">
                <div className="min-w-0 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">15 yrs</div>
                  <div className="ph-currency truncate text-sm font-semibold">{fmtPhp(quote.monthly15)}</div>
                </div>
                <div className="min-w-0 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">20 yrs</div>
                  <div className="ph-currency truncate text-sm font-semibold">{fmtPhp(quote.monthly20)}</div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="text-[11px] text-muted-foreground">Saved {savedDate}</div>

        {unit.notes && (
          <p className="line-clamp-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">
            {unit.notes}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {mode === "matched" && current && (
            <Link
              href={`/computation/${encodeURIComponent(current.unit_id)}`}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:brightness-110"
            >
              Open Computation
            </Link>
          )}
          <button
            type="button"
            onClick={onEditNote}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-input px-2.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" />
            Note
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-input px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>
    </Card>
  );
}
