// src/components/shortlists/UnitCard.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calculator,
  ChevronRight,
  Loader2,
  Minus,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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

// Abbreviated, whole-peso formatting for the Compact mobile row ONLY — full
// precise values (financing.ts's fmtPhp, 2 decimals) remain what's shown
// inside Details/the desktop card. ₱4,794,000 -> "₱4.794M", ₱15,147 -> "₱15,147".
function fmtCompactPhp(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(3)}M`;
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
}

// Focus-visible ring for the plain (non shadcn-Button) interactive elements in
// this file, so keyboard focus is always visibly indicated.
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

type Props = {
  unit: ShortlistUnit;
  current: AvailabilityRow | undefined;
  mode: UnitMode;
  rtoInfo: RtoInfo | undefined;
  onRetryRto?: () => void;
  selected: boolean;
  selectable: boolean;
  onToggleSelect: () => void;
  onEditNote: () => void;
  onRemove: () => void;
  // "card" (default) is the full desktop-grid card, always fully expanded.
  // "compact" renders a dense summary row with a "Details" toggle that reveals
  // the same detail content the card shows — used for the mobile Compact view.
  variant?: "card" | "compact";
};

export default function UnitCard({
  unit,
  current,
  mode,
  rtoInfo,
  onRetryRto,
  selected,
  selectable,
  onToggleSelect,
  onEditNote,
  onRemove,
  variant = "card",
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const title = current ? current.property_name : unit.property_code;
  const unitNo = current ? current.BuildingUnit : unit.building_unit;
  const towerLabel = current ? current.tower_name || current.tower_code : unit.tower_code;

  const savedDate = (() => {
    try {
      return format(new Date(unit.saved_at), "MMM d, yyyy");
    } catch {
      return unit.saved_at;
    }
  })();

  const priceChange = current && unit.saved_price != null ? current.ListPrice - unit.saved_price : null;

  const statusChanged = current && unit.saved_status && unit.saved_status.trim() !== current.Status.trim();

  const quote = current ? computeQuote({ listPrice: current.ListPrice }) : null;

  const rtoTotalMonthly = quote && rtoInfo?.status === "eligible" ? quote.dpMonthly + (rtoInfo.monthly || 0) : null;

  // Icon + text together (never color alone) so the increase/decrease/unchanged
  // signal doesn't depend on color perception.
  const priceChangeNode =
    mode === "matched" && priceChange !== null ? (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
          priceChange > 0 ? "text-rose-600" : priceChange < 0 ? "text-emerald-600" : "text-muted-foreground"
        }`}
      >
        {priceChange > 0 ? (
          <TrendingUp className="h-3 w-3" />
        ) : priceChange < 0 ? (
          <TrendingDown className="h-3 w-3" />
        ) : (
          <Minus className="h-3 w-3" />
        )}
        <span className="ph-currency">
          {priceChange === 0 ? "Price unchanged" : `${priceChange > 0 ? "+" : "-"}${fmtPhp(Math.abs(priceChange))}`}
        </span>
      </span>
    ) : null;

  const checkbox =
    mode === "matched" ? (
      <span className="-m-2 flex shrink-0 items-center justify-center p-2">
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          onChange={onToggleSelect}
          aria-label={`Select ${title} ${unitNo} for comparison`}
          className={`h-5 w-5 shrink-0 rounded disabled:opacity-40 ${FOCUS_RING} ${
            variant === "compact" ? "border-input" : "border-white/40"
          }`}
          style={{ accentColor: "var(--dmci-blue-500)" }}
        />
      </span>
    ) : null;

  const detailBody = (
    <div className="flex flex-1 flex-col gap-2.5 text-sm">
      {mode === "missing" && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
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

      {/* PRIMARY: current price, Monthly DP, and — when RTO-eligible — RTO
          Monthly and Total Monthly grouped right alongside them, in one box
          instead of scattered across three. Total Monthly is the visually
          prominent figure (bold, larger, its own divider). */}
      {mode === "matched" && current && quote && (
        <div className="rounded-lg bg-muted/40 px-3 py-2.5">
          <StatRow label="Current Price" value={fmtPhp(current.ListPrice)} />
          <StatRow label="Monthly DP" value={fmtPhp(quote.dpMonthly)} />
          {rtoInfo?.status === "eligible" && (
            <>
              <div className="mt-1.5 border-t pt-1.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                RTO Eligible
              </div>
              <StatRow label="RTO Monthly" value={fmtPhp(rtoInfo.monthly || 0)} />
              <StatRow label="Total Monthly" value={fmtPhp(rtoTotalMonthly ?? 0)} emphasize noDivider />
            </>
          )}
        </div>
      )}

      {/* CHANGE: saved -> current, plain text (no extra box) */}
      {mode === "matched" && current && unit.saved_price != null && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="ph-currency text-muted-foreground">
            {fmtPhp(unit.saved_price)} <ArrowRight className="inline h-3 w-3" /> {fmtPhp(current.ListPrice)}
          </span>
          {priceChangeNode}
        </div>
      )}

      {mode === "matched" && <RtoLine rtoInfo={rtoInfo} onRetry={onRetryRto} />}

      {statusChanged && current && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          <span className="truncate">{unit.saved_status}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="truncate">{current.Status}</span>
        </div>
      )}

      {/* Saved-snapshot-only info for non-matched modes */}
      {mode !== "matched" && (unit.saved_price != null || unit.saved_status) && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {unit.saved_price != null && (
            <div className="flex items-center justify-between gap-2">
              <span>Saved price</span>
              <span className="ph-currency font-semibold text-foreground">{fmtPhp(unit.saved_price)}</span>
            </div>
          )}
          {unit.saved_status && (
            <div className="flex items-center justify-between gap-2">
              <span>Saved status</span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(
                  unit.saved_status
                )}`}
              >
                {unit.saved_status}
              </span>
            </div>
          )}
          {unit.saved_rto_eligible && (
            <div className="flex items-center justify-between gap-2">
              <span>RTO eligible at time of saving</span>
              {unit.saved_rto_rate != null && (
                <span className="ph-currency font-semibold text-foreground">
                  Saved RTO monthly rate {fmtPhp(unit.saved_rto_rate)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECONDARY: plain text, no box */}
      {mode === "matched" && current && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <span>{towerLabel}</span>
          <span aria-hidden="true">•</span>
          <span>{current.Type || "—"}</span>
          <span aria-hidden="true">•</span>
          <span>{current.GrossAreaSQM || 0} sqm</span>
          <span aria-hidden="true">•</span>
          <span>{current.Facing || "—"}</span>
          <span aria-hidden="true">•</span>
          <span>Floor {current.Floor || "—"}</span>
        </div>
      )}

      {/* FINANCING: the one other box worth keeping — a genuinely distinct group */}
      {mode === "matched" && quote && (
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
      )}

      <div className="text-[11px] text-muted-foreground">Saved {savedDate}</div>

      {unit.notes && (
        <p className="line-clamp-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">{unit.notes}</p>
      )}

      <div className="mt-1 grid grid-cols-3 gap-2">
        {mode === "matched" && current ? (
          // BUG FIX: this used to render as an invisible-text "solid blue
          // rectangle." Root cause: src/app/globals.css defines `a { color:
          // var(--primary); }` as a PLAIN, unlayered CSS rule (not inside any
          // `@layer` block), while Tailwind's own utility classes — including
          // `text-primary-foreground` — are emitted inside Tailwind's
          // `utilities` @layer. Per the CSS Cascade Layers spec, ANY unlayered
          // rule beats ANY layered rule regardless of selector specificity, so
          // that global `a` rule silently overrode `text-primary-foreground`
          // on this <Link> (which renders as an <a>), forcing the label text
          // to the SAME blue as the `bg-primary` background — invisible text,
          // not a missing label. The inline `style` below is the fix: inline
          // styles outrank stylesheet rules that aren't `!important` (this one
          // isn't), so it reliably wins without touching the shared,
          // app-wide globals.css. Do not "simplify" this back to a plain
          // `text-primary-foreground` class — that reintroduces the bug.
          <Link
            href={`/computation/${encodeURIComponent(current.unit_id)}`}
            aria-label={`Open computation for ${title} ${unitNo}`}
            className={`col-span-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-[11px] font-semibold shadow-sm hover:brightness-110 sm:text-xs ${FOCUS_RING}`}
            style={{ color: "var(--primary-foreground)" }}
          >
            <Calculator className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Open Computation</span>
          </Link>
        ) : (
          <span className="col-span-1" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={onEditNote}
          aria-label={`Edit note for ${title} ${unitNo}`}
          className={`inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input px-2 text-[11px] font-medium text-foreground hover:bg-muted sm:text-xs ${FOCUS_RING}`}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          Note
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${title} ${unitNo} from this shortlist`}
          className={`inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input px-2 text-[11px] font-medium text-destructive hover:bg-destructive/10 sm:text-xs ${FOCUS_RING}`}
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
          Remove
        </button>
      </div>
    </div>
  );

  if (variant === "compact") {
    return (
      <Card className={`overflow-hidden ${selected ? "border-primary ring-1 ring-primary/30" : ""}`}>
        <div className="flex items-center gap-2 px-3 py-2">
          {checkbox}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-foreground" title={`${title} • ${unitNo}`}>
                {title} • {unitNo}
              </span>
              {mode === "matched" && current && (
                <span
                  className={`shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${statusTone(
                    current.Status
                  )}`}
                >
                  {current.Status || "—"}
                </span>
              )}
            </div>

            {mode === "matched" && current && quote ? (
              <div className="mt-0.5 flex items-baseline gap-2 text-xs">
                <span className="ph-currency font-semibold text-foreground">{fmtCompactPhp(current.ListPrice)}</span>
                <span className="ph-currency text-muted-foreground">DP {fmtCompactPhp(quote.dpMonthly)}/mo</span>
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {unit.saved_price != null ? `Saved ${fmtCompactPhp(unit.saved_price)}` : "No saved price on record"}
              </div>
            )}

            {mode === "matched" && rtoInfo?.status === "eligible" && (
              <div className="ph-currency text-xs font-semibold text-emerald-700">
                RTO Total {fmtCompactPhp(rtoTotalMonthly ?? 0)}
              </div>
            )}
            {mode === "missing" && (
              <div className="flex items-center gap-1 text-xs font-medium text-amber-700">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                No longer in current inventory
              </div>
            )}
            {mode === "unavailable" && (
              <div className="text-xs font-medium text-slate-600">Current data unavailable</div>
            )}

            <div className="mt-0.5 flex items-center justify-between gap-2">
              {priceChangeNode ?? <span />}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-label={expanded ? "Hide unit details" : "Show unit details"}
                className={`-m-1.5 flex shrink-0 items-center gap-0.5 rounded p-1.5 text-xs font-semibold text-primary ${FOCUS_RING}`}
              >
                {expanded ? "Hide" : "Details"}
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {expanded && <div className="border-t px-3 pb-3 pt-2.5">{detailBody}</div>}
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col overflow-hidden ${selected ? "border-primary ring-1 ring-primary/30" : ""}`}>
      <div className="flex items-start justify-between gap-2 bg-[#0f172a] px-4 py-3 text-white">
        <div className="flex min-w-0 items-start gap-2.5">
          {checkbox}
          <div className="min-w-0">
            <div className="truncate font-semibold" title={title}>
              {title}
            </div>
            <div className="truncate text-xs opacity-90">
              {towerLabel} • {unitNo}
            </div>
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

      <div className="p-4">{detailBody}</div>
    </Card>
  );
}

function StatRow({
  label,
  value,
  emphasize,
  noDivider,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  noDivider?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${emphasize && !noDivider ? "mt-1.5 border-t pt-1.5" : emphasize ? "mt-0.5" : ""}`}>
      <span className={emphasize ? "text-xs font-medium text-foreground" : "text-xs text-muted-foreground"}>
        {label}
      </span>
      <span className={`ph-currency font-bold text-foreground ${emphasize ? "text-lg" : "text-sm"}`}>{value}</span>
    </div>
  );
}

// Compact single-line RTO status — checking/not_eligible/error only need one
// line since "eligible" already surfaces Total Monthly up in the PRIMARY
// stats box; this line just confirms eligibility + the raw monthly rate.
function RtoLine({ rtoInfo, onRetry }: { rtoInfo: RtoInfo | undefined; onRetry?: () => void }) {
  const status = rtoInfo?.status ?? "checking";

  if (status === "checking") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] italic text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking RTO eligibility…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
        <span className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Unable to check RTO
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`shrink-0 rounded font-semibold text-primary hover:underline ${FOCUS_RING}`}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (status === "eligible") {
    // Fully represented in the PRIMARY stats box above (RTO Monthly + Total
    // Monthly grouped with Current Price / Monthly DP) — nothing to add here.
    return null;
  }

  return <div className="text-[11px] italic text-muted-foreground">Not available for RTO</div>;
}
