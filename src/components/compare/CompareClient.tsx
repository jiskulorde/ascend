// src/components/compare/CompareClient.tsx

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { useRouter } from "next/navigation";
import { makeUnitId, matchesLegacyOrCanonical } from "@/lib/unit-id";
import { RESERVATION_FEE_DEFAULT, DOWNPAYMENT_PERCENT_DEFAULT } from "@/lib/quoteDefaults";
import {
  computeQuote,
  rtoTypeCandidates,
  DEFAULT_DISCOUNT_PCT,
  DEFAULT_MONTHS_TO_PAY,
  DEFAULT_CLOSING_FEE_PCT,
  DEFAULT_RATE_15YR,
  DEFAULT_RATE_20YR,
} from "@/lib/financing";

// Bump this whenever the meaning of a stored "compare_adjustments" field changes.
const COMPARE_ADJUSTMENTS_VERSION = 2;
// Former shared defaults, kept only so old unversioned localStorage values that exactly
// match them can be remapped to the new approved defaults (see the migration effect below).
const FORMER_DOWNPAYMENT_PERCENT_DEFAULT = 20;
const FORMER_RESERVATION_FEE_DEFAULT = 20000;

// Shape aligned with your enriched /api/availability output (used in computation)
type UnitRow = {
  property_code: string;
  property_name: string;
  city: string;
  address: string;
  tower_code: string;
  tower_name?: string;

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

  unit_id?: string; // canonical id (if your API already includes it)
};

// RTO shape + eligibility-candidate rule. rtoTypeCandidates() now comes from
// @/lib/financing (shared with computation/[unitID]/page.tsx and the shortlist
// detail page) — the actual eligibility decision still comes only from
// /api/rto-rate below; that function just decides which unit_type string(s) to
// query with.
type RtoInfo = {
  eligible: boolean;
  monthly?: number;
  memo?: string | null;
};

// `searchText` is a hidden haystack (not shown in the UI) so filtering can match
// project name/code, tower, unit, and type even though the visible label doesn't
// display all of those fields.
type Option = { value: string; label: string; searchText: string };

// Compact label/value cell used inside comparison cards. `best` applies a subtle
// (single-color) highlight + small badge instead of the old table's flat rows.
function StatCell({
  label,
  value,
  best,
  bestLabel = "lowest",
}: {
  label: string;
  value: React.ReactNode;
  best?: boolean;
  bestLabel?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold truncate ${best ? "text-emerald-700" : ""}`}>{value}</div>
      {best && (
        <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600">{bestLabel}</div>
      )}
    </div>
  );
}

// Keep cache small & robust
const COMPARE_CACHE_KEY = "compare_rows_cache_v2";

function slimForCompare(data: any[]): UnitRow[] {
  // Keep only the fields Compare uses. Intentionally NOT capped to a unit count —
  // the Add Units selector must search the full inventory (see the selector below),
  // and the slimmed payload comfortably fits safeSetJSON's localStorage size guard.
  return data.map((u) => ({
    // meta
    property_code: u.property_code ?? "",
    property_name: u.property_name ?? "",
    city: u.city ?? "",
    address: u.address ?? "",
    tower_code: u.tower_code ?? "",
    tower_name: u.tower_name ?? "",

    // legacy/availability fields (kept to satisfy UnitRow typing/UI)
    Property: u.Property ?? "",
    BuildingUnit: u.BuildingUnit ?? "",
    Tower: u.Tower ?? "",
    Floor: String(u.Floor ?? ""),
    Status: u.Status ?? "",
    Type: u.Type ?? "",
    GrossAreaSQM: Number(u.GrossAreaSQM ?? 0),
    Amenities: u.Amenities ?? "",
    Facing: u.Facing ?? "",
    RFODate: u.RFODate ?? "",
    ListPrice: Number(u.ListPrice ?? 0),
    PerSQM: Number(u.PerSQM ?? 0),

    // id
    unit_id: u.unit_id ?? undefined,
  }));
}

function safeSetJSON(key: string, value: unknown) {
  try {
    // stringify once, throw if too large
    const str = JSON.stringify(value);
    // Optional: skip caching if > 4.5MB to be safe
    if (str.length > 4_500_000) return;
    localStorage.setItem(key, str);
  } catch (e: any) {
    // QuotaExceededError (code 22 / name varies across browsers)
    // If it fails, we just skip caching—no user impact
    // console.warn("Cache write skipped:", e);
  }
}

function safeGetJSON<T = unknown>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}


export default function ComparePage() {
  const router = useRouter();

  // ---------------- State
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // units chosen for comparison (we’ll import from localStorage set by Availability)
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // global adjustments
  const [discountPct, setDiscountPct] = useState<number>(DEFAULT_DISCOUNT_PCT);
  const [downPct, setDownPct] = useState<number>(DOWNPAYMENT_PERCENT_DEFAULT);
  const [monthsToPay, setMonthsToPay] = useState<number>(DEFAULT_MONTHS_TO_PAY);
  const [reservationFee, setReservationFee] = useState<number>(RESERVATION_FEE_DEFAULT);
  const [closingFeePct, setClosingFeePct] = useState<number>(DEFAULT_CLOSING_FEE_PCT);
  const [rate15yr, setRate15yr] = useState<number>(DEFAULT_RATE_15YR);
  const [rate20yr, setRate20yr] = useState<number>(DEFAULT_RATE_20YR);

  // adjustments panel (shared trigger across breakpoints)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  // export refs
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);

    // Pull selected unit IDs saved by Availability page
    try {
      const raw = localStorage.getItem("selectedUnits");
      if (raw) {
        const arr: string[] = JSON.parse(raw);
        setCompareIds(Array.from(new Set(arr)).slice(0, 6));
      }
    } catch {}

    // Preload saved global tweaks if you want persistence.
    // Conservative migration: unrelated fields (discount/months/closing/rates) are always
    // preserved as-is; downPct/reservationFee are only remapped from their FORMER default
    // values to the new approved defaults, so a deliberately-customized value survives.
    try {
      const raw = localStorage.getItem("compare_adjustments");
      if (raw) {
        const s = JSON.parse(raw);
        const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
        const storedVersion = isNum(s?.version) ? s.version : 0;

        const migrated = {
          discountPct: isNum(s?.discountPct) ? s.discountPct : DEFAULT_DISCOUNT_PCT,
          downPct: isNum(s?.downPct) ? s.downPct : DOWNPAYMENT_PERCENT_DEFAULT,
          monthsToPay: isNum(s?.monthsToPay) ? s.monthsToPay : DEFAULT_MONTHS_TO_PAY,
          reservationFee: isNum(s?.reservationFee) ? s.reservationFee : RESERVATION_FEE_DEFAULT,
          closingFeePct: isNum(s?.closingFeePct) ? s.closingFeePct : DEFAULT_CLOSING_FEE_PCT,
          rate15yr: isNum(s?.rate15yr) ? s.rate15yr : DEFAULT_RATE_15YR,
          rate20yr: isNum(s?.rate20yr) ? s.rate20yr : DEFAULT_RATE_20YR,
        };

        if (storedVersion < COMPARE_ADJUSTMENTS_VERSION) {
          if (migrated.downPct === FORMER_DOWNPAYMENT_PERCENT_DEFAULT) {
            migrated.downPct = DOWNPAYMENT_PERCENT_DEFAULT;
          }
          if (migrated.reservationFee === FORMER_RESERVATION_FEE_DEFAULT) {
            migrated.reservationFee = RESERVATION_FEE_DEFAULT;
          }
        }

        setDiscountPct(migrated.discountPct);
        setDownPct(migrated.downPct);
        setMonthsToPay(migrated.monthsToPay);
        setReservationFee(migrated.reservationFee);
        setClosingFeePct(migrated.closingFeePct);
        setRate15yr(migrated.rate15yr);
        setRate20yr(migrated.rate20yr);

        // Persist the migrated payload immediately so future loads read it pre-migrated.
        localStorage.setItem(
          "compare_adjustments",
          JSON.stringify({ version: COMPARE_ADJUSTMENTS_VERSION, ...migrated })
        );
      }
    } catch {
      // Malformed stored data — fall back to the centralized defaults already set as initial state.
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(
      "compare_adjustments",
      JSON.stringify({
        version: COMPARE_ADJUSTMENTS_VERSION,
        discountPct,
        downPct,
        monthsToPay,
        reservationFee,
        closingFeePct,
        rate15yr,
        rate20yr,
      })
    );
  }, [mounted, discountPct, downPct, monthsToPay, reservationFee, closingFeePct, rate15yr, rate20yr]);

  // ---------------- Fetch rows (enriched availability)
  const fetchRows = async () => {
  setLoading(true);
  setLoadError(null);
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/availability`;
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      const preview = await res.text();
      throw new Error(`API ${res.status} ${res.statusText} — ${preview.slice(0, 200)}`);
    }

    const json = await res.json();
    const raw: any[] = Array.isArray(json.data) ? json.data : [];

    // ↓↓↓ FIX: slim + cap before storing to localStorage
    const slim = slimForCompare(raw);
    setRows(slim);
    safeSetJSON(COMPARE_CACHE_KEY, slim); // ← FIX: quota-safe write
  } catch (err: any) {
    // ↓↓↓ FIX: quota-safe read (and also works if user blocked storage)
    const cached = safeGetJSON<UnitRow[]>(COMPARE_CACHE_KEY);
    if (cached) setRows(cached);

    setLoadError(err?.message || "Failed to fetch");
    console.error("Failed to fetch /api/availability:", err);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    fetchRows();
  }, []);

  // ---------------- Helpers
  const canonicalIdFor = (u: UnitRow) => {
    return u.unit_id || makeUnitId({ property_code: u.property_code, tower_code: u.tower_code, building_unit: u.BuildingUnit });
  };

  const fmtPhp = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(n);

  // Given a unit, compute comparable fields with global adjustments.
  // Wrapped in useCallback (with its actual inputs as deps) so computedUnits below
  // can depend on `compute` itself and satisfy exhaustive-deps without a manual list.
  const compute = useCallback(
    (u: UnitRow) =>
      computeQuote({
        listPrice: u.ListPrice || 0,
        discountPct,
        downPct,
        reservationFee,
        monthsToPay,
        closingFeePct,
        rate15yr,
        rate20yr,
      }),
    [discountPct, downPct, monthsToPay, reservationFee, closingFeePct, rate15yr, rate20yr]
  );

  // ---------------- Dataset: only those in compareIds
  const comparedUnits = useMemo(() => {
    if (!compareIds.length) return [];
    return rows.filter(u =>
      compareIds.some(id =>
        matchesLegacyOrCanonical(
          { property_code: u.property_code, tower_code: u.tower_code, building_unit: u.BuildingUnit },
          id
        ) || canonicalIdFor(u) === id
      )
    );
  }, [rows, compareIds]);

  // ---------------- RTO eligibility (per selected unit)
  // Uses the same /api/rto-rate endpoint and area/type-matching rule as
  // computation/[unitID]/page.tsx (shared rtoTypeCandidates() from @/lib/financing,
  // imported above). Results are cached by canonical unit id in rtoByUnit, so this
  // only ever requests units that are (a)
  // currently selected — capped at 6 by compareIds/addId — and (b) not already checked;
  // re-renders from unrelated state (Adjust assumptions, etc.) never re-trigger a fetch
  // because comparedUnits itself doesn't change when those fire.
  const [rtoByUnit, setRtoByUnit] = useState<Record<string, RtoInfo>>({});
  const [rtoLoadingIds, setRtoLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const pending = comparedUnits
      .map((u) => ({ u, cid: canonicalIdFor(u) }))
      .filter(({ cid }) => !(cid in rtoByUnit));
    if (!pending.length) return;

    let cancelled = false;
    setRtoLoadingIds((prev) => {
      const next = new Set(prev);
      pending.forEach(({ cid }) => next.add(cid));
      return next;
    });

    (async () => {
      try {
        const results = await Promise.all(
          pending.map(async ({ u, cid }) => {
            const candidates = rtoTypeCandidates(u.Type);
            for (const unit_type of candidates) {
              const qs = new URLSearchParams({
                project_code: u.property_code,
                unit_type,
                area: String(u.GrossAreaSQM || 0),
              });
              try {
                const res = await fetch(`/api/rto-rate?${qs.toString()}`, { cache: "no-store" });
                if (!res.ok) continue;
                const json = await res.json();
                if (json?.eligible) {
                  return [
                    cid,
                    { eligible: true, monthly: Number(json.monthly_rate) || 0, memo: json.memo_ref || null },
                  ] as const;
                }
              } catch {
                // try next candidate
              }
            }
            return [cid, { eligible: false }] as const;
          })
        );

        if (cancelled) return;
        setRtoByUnit((prev) => {
          const next = { ...prev };
          results.forEach(([cid, info]) => { next[cid] = info; });
          return next;
        });
      } finally {
        setRtoLoadingIds((prev) => {
          const next = new Set(prev);
          pending.forEach(({ cid }) => next.delete(cid));
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [comparedUnits, rtoByUnit]);

  // ---------------- Add/remove compare items
  const addId = (id: string) => {
    setCompareIds(prev => {
      const next = Array.from(new Set([...prev, id])).slice(0, 6);
      localStorage.setItem("selectedUnits", JSON.stringify(next));
      return next;
    });
  };

  const removeId = (id: string) => {
    setCompareIds(prev => {
      const next = prev.filter(x => x !== id);
      localStorage.setItem("selectedUnits", JSON.stringify(next));
      return next;
    });
  };

  // ---------------- Add-unit select options
  // Built from the FULL loaded inventory (`rows`, from /api/availability — no slicing),
  // excluding only units already in the comparison. Search matches project name/code,
  // tower, building unit, and type via the custom filterOption below.
  const selectedCanonicalIds = useMemo(
    () => new Set(comparedUnits.map(canonicalIdFor)),
    [comparedUnits]
  );

  const allOptions: Option[] = useMemo(
    () =>
      rows
        .filter((u) => !selectedCanonicalIds.has(canonicalIdFor(u)))
        .map((u) => ({
          value: canonicalIdFor(u),
          label: `${u.property_name} • ${u.tower_name || u.tower_code} • ${u.BuildingUnit} • ₱${u.ListPrice.toLocaleString()}`,
          searchText: [u.property_name, u.property_code, u.tower_name, u.tower_code, u.BuildingUnit, u.Type]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        })),
    [rows, selectedCanonicalIds]
  );

  const filterUnitOption = (option: { data: Option }, rawInput: string) => {
    const q = rawInput.trim().toLowerCase();
    if (!q) return true;
    return option.data.searchText.includes(q);
  };

  // Computed units paired with their canonical id + derived figures, shared by the
  // desktop and mobile comparison cards so both stay in sync from one source.
  const computedUnits = useMemo(
    () => comparedUnits.map((u) => ({ u, c: compute(u), cid: canonicalIdFor(u) })),
    [comparedUnits, compute]
  );

  // Subtle "best value" indicators — only meaningful when comparing 2+ units.
  const winners = useMemo(() => {
    if (computedUnits.length < 2) return null;
    const minBy = (sel: (x: (typeof computedUnits)[number]) => number) =>
      computedUnits.reduce((best, cur) => (sel(cur) < sel(best) ? cur : best), computedUnits[0]).cid;
    const maxBy = (sel: (x: (typeof computedUnits)[number]) => number) =>
      computedUnits.reduce((best, cur) => (sel(cur) > sel(best) ? cur : best), computedUnits[0]).cid;
    return {
      listPrice: minBy((x) => x.u.ListPrice),
      tcp: minBy((x) => x.c.TCP),
      area: maxBy((x) => x.u.GrossAreaSQM),
      dpMonthly: minBy((x) => x.c.dpMonthly),
      monthly15: minBy((x) => x.c.monthly15),
      monthly20: minBy((x) => x.c.monthly20),
    };
  }, [computedUnits]);

  // ---------------- Exports
  // The live comparison area stretches to fill whatever viewport it's on, and the desktop
  // card row scrolls horizontally past 3-4 units — capturing it as-is either crops cards
  // (a fixed width cap) or under-measures width entirely (an `overflow:visible` element's
  // scrollWidth does NOT include a descendant's overflowed content — only an element that
  // is itself the scrolling container reports that). So width is computed in two passes:
  // first the horizontally-scrolling row (marked data-export-relax-overflow) is measured
  // at its own true natural width via a transient `width:max-content` (immediately reverted
  // — its children are fixed-width cards, not percentage-based, so this can't cascade into
  // unwrapping text inside them); that natural width (or the node's current width if no
  // such row is present/visible, e.g. the mobile stacked layout) becomes the content width
  // the whole wrapper is pinned to, so every selected unit (up to 6) fits with no cropping
  // and no horizontal scrollbar.
  //
  // It also swaps the captured DOM from "interactive UI" to "clean document": elements
  // marked data-export-hide (remove/Compute buttons) are hidden, the element marked
  // data-export-only (the "Unit Comparison" heading + assumptions summary, normally
  // display:none) is shown, and export-only padding is applied on all sides.
  const EXPORT_PADDING_PX = 22; // ~20–24px on every side, per spec
  const withSheetFrozen = async <T,>(
    work: (dims: { width: number; height: number }) => Promise<T>
  ): Promise<T | undefined> => {
    const node = sheetRef.current;
    if (!node) return undefined;

    const hideEls = Array.from(node.querySelectorAll<HTMLElement>('[data-export-hide="true"]'));
    const showEls = Array.from(node.querySelectorAll<HTMLElement>('[data-export-only="true"]'));
    const relaxEls = Array.from(node.querySelectorAll<HTMLElement>('[data-export-relax-overflow="true"]'));
    const prevHideDisplay = hideEls.map((el) => el.style.display);
    const prevShowDisplay = showEls.map((el) => el.style.display);
    const prevRelax = relaxEls.map((el) => ({
      overflow: el.style.overflow,
      maxWidth: el.style.maxWidth,
      minWidth: el.style.minWidth,
    }));

    hideEls.forEach((el) => { el.style.display = "none"; });
    showEls.forEach((el) => { el.style.display = "block"; });
    relaxEls.forEach((el) => {
      el.style.overflow = "visible";
      el.style.maxWidth = "none";
      el.style.minWidth = "0";
    });

    const prevNode = {
      width: node.style.width,
      maxWidth: node.style.maxWidth,
      minWidth: node.style.minWidth,
      padding: node.style.padding,
      boxShadow: node.style.boxShadow,
      overflow: node.style.overflow,
    };

    node.style.overflow = "visible";
    node.style.maxWidth = "none";
    node.style.minWidth = "0";
    document.body.classList.add("exporting");

    // Pass 1: measure the true natural width. Only the relax-marked row (fixed-width
    // cards) is briefly unconstrained to measure it — never `node` itself, since its
    // mobile-layout children use percentage widths that would runaway-unwrap under an
    // indefinite-width ancestor. getBoundingClientRect() forces a synchronous layout,
    // so no animation-frame wait is needed for this read/revert pair.
    let contentWidth = node.getBoundingClientRect().width;
    relaxEls.forEach((el) => {
      const prevWidth = el.style.width;
      el.style.width = "max-content";
      contentWidth = Math.max(contentWidth, el.getBoundingClientRect().width);
      el.style.width = prevWidth;
    });

    const finalWidth = Math.ceil(contentWidth) + EXPORT_PADDING_PX * 2;

    // Pass 2: pin the wrapper to that width and add the export-only padding, then let
    // layout settle before measuring the (now-final) height.
    node.style.width = `${finalWidth}px`;
    node.style.padding = `${EXPORT_PADDING_PX}px`;
    node.style.boxShadow = "none";
    await new Promise((r) => requestAnimationFrame(() => r(null as any)));

    // wait for webfonts so capture doesn't race Poppins loading; never hang if the API misbehaves
    await Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 1500)),
    ]);

    const finalHeight = Math.ceil(node.getBoundingClientRect().height);

    try {
      return await work({ width: finalWidth, height: finalHeight });
    } finally {
      node.style.width = prevNode.width;
      node.style.maxWidth = prevNode.maxWidth;
      node.style.minWidth = prevNode.minWidth;
      node.style.padding = prevNode.padding;
      node.style.boxShadow = prevNode.boxShadow;
      node.style.overflow = prevNode.overflow;
      hideEls.forEach((el, i) => { el.style.display = prevHideDisplay[i]; });
      showEls.forEach((el, i) => { el.style.display = prevShowDisplay[i]; });
      relaxEls.forEach((el, i) => {
        el.style.overflow = prevRelax[i].overflow;
        el.style.maxWidth = prevRelax[i].maxWidth;
        el.style.minWidth = prevRelax[i].minWidth;
      });
      document.body.classList.remove("exporting");
    }
  };

  const downloadPNG = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    await withSheetFrozen(async ({ width, height }) => {
      const node = sheetRef.current!;
      const url = await toPng(node, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width,
        height,
        style: { transform: "none" },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = "unit-comparison.png";
      a.click();
    });
  };

  const downloadPDF = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");
    await withSheetFrozen(async ({ width: imgW, height: imgH }) => {
      const node = sheetRef.current!;
      const imgData = await toPng(node, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        width: imgW,
        height: imgH,
        style: { transform: "none" },
      });

      const pdf = new jsPDF({ orientation: imgW >= imgH ? "l" : "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const scale = Math.min(pageW / imgW, pageH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;

      pdf.addImage(imgData, "PNG", x, y, drawW, drawH);
      pdf.save("unit-comparison.pdf");
    });
  };

  const downloadExcel = async () => {
    const XLSX = await import("xlsx");

    // FIX 3: header can remain string[], but we’ll widen to (string|number)[] to match rows we add later
    const header: (string | number)[] = [
      "Field",
      ...comparedUnits.map(
        u => `${u.property_name} • ${u.tower_name || u.tower_code} • ${u.BuildingUnit}`
      ),
    ];

    // FIX 4: fields return (string | number)
    const fields: Array<[string, (u: UnitRow) => string | number]> = [
      ["Project", (u) => u.property_name],
      ["City", (u) => u.city],
      ["Address", (u) => u.address],
      ["Tower", (u) => u.tower_name || u.tower_code],
      ["Unit", (u) => u.BuildingUnit],
      ["Type", (u) => u.Type],
      ["Floor", (u) => u.Floor],
      ["Area (SQM)", (u) => u.GrossAreaSQM],
      ["Facing", (u) => u.Facing],
      ["Status", (u) => u.Status],
      ["RFO Date", (u) => u.RFODate],
      ["List Price", (u) => u.ListPrice],
      ["Price / SQM", (u) => u.PerSQM],
      ["Discount %", () => discountPct],
      ["TCP", (u) => compute(u).TCP],
      ["Downpayment %", () => downPct],
      ["Downpayment", (u) => compute(u).dpAmount],
      ["Reservation Fee", () => reservationFee],
      ["Net DP", (u) => compute(u).netDp],
      ["Months to Pay", () => monthsToPay],
      ["DP Monthly", (u) => compute(u).dpMonthly],
      ["Closing Fee %", () => closingFeePct],
      ["Closing Fee", (u) => compute(u).closingFee],
      ["Bank Balance", (u) => compute(u).bankBalance],
      [`15yrs @ ${rate15yr}%`, (u) => compute(u).monthly15],
      [`20yrs @ ${rate20yr}%`, (u) => compute(u).monthly20],
      [
        "RTO Eligible",
        (u) => {
          const r = rtoByUnit[canonicalIdFor(u)];
          return r ? (r.eligible ? "Yes" : "No") : "Pending";
        },
      ],
      ["RTO Monthly Rate", (u) => rtoByUnit[canonicalIdFor(u)]?.eligible ? rtoByUnit[canonicalIdFor(u)]!.monthly || 0 : ""],
      [
        "RTO Total Monthly (DP + RTO)",
        (u) => {
          const r = rtoByUnit[canonicalIdFor(u)];
          return r?.eligible ? compute(u).dpMonthly + (r.monthly || 0) : "";
        },
      ],
      ["RTO Memo", (u) => rtoByUnit[canonicalIdFor(u)]?.memo || ""],
    ];

    // FIX 5: make the 2D array able to hold strings OR numbers
    const rowsAoa: (string | number)[][] = [header];
    fields.forEach(([name, fn]) => {
      rowsAoa.push([name, ...comparedUnits.map(u => fn(u))]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rowsAoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison");
    XLSX.writeFile(wb, "unit-comparison.xlsx");
  };

  // Renders one unit as a compact comparison card. Shared by the desktop
  // side-by-side row and the mobile stacked list so both stay identical.
  const renderUnitCard = ({ u, c, cid }: (typeof computedUnits)[number]) => {
    const isBest = (key: keyof NonNullable<typeof winners>) => !!winners && winners[key] === cid;
    const rtoInfo = rtoByUnit[cid];
    const rtoLoading = rtoLoadingIds.has(cid);
    const rtoTotalMonthly = rtoInfo?.eligible ? c.dpMonthly + (rtoInfo.monthly || 0) : null;
    return (
      <div key={cid} className="card overflow-hidden flex flex-col w-full md:w-[300px] md:shrink-0">
        <div className="bg-[#0f172a] text-white px-4 py-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{u.property_name}</div>
            <div className="text-xs opacity-90 truncate">
              {u.tower_name || u.tower_code} • {u.BuildingUnit}
            </div>
          </div>
          <button
            onClick={() => removeId(cid)}
            data-export-hide="true"
            className="shrink-0 rounded border border-white/30 px-2 py-1 text-xs hover:bg-white/10"
            title="Remove from comparison"
          >
            ✕
          </button>
        </div>

        <div className="p-4 text-sm flex-1 flex flex-col gap-3">
          {/* Primary values */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <StatCell
              label="List Price"
              value={<span className="ph-currency">{fmtPhp(u.ListPrice)}</span>}
              best={isBest("listPrice")}
            />
            <StatCell
              label="Total Contract Price"
              value={<span className="ph-currency">{fmtPhp(c.TCP)}</span>}
              best={isBest("tcp")}
            />
            <StatCell label="Area" value={`${u.GrossAreaSQM} sqm`} best={isBest("area")} bestLabel="largest" />
            <StatCell label="Downpayment" value={<span className="ph-currency">{fmtPhp(c.dpAmount)}</span>} />
          </div>

          {/* Monthly payment — the number a customer actually pays each month, kept prominent */}
          <div
            className={`rounded-lg px-3 py-2 border ${
              isBest("dpMonthly") ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-100"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Monthly DP ({monthsToPay} mos)</span>
              {isBest("dpMonthly") && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">lowest</span>
              )}
            </div>
            <div
              className={`ph-currency text-[22px] font-extrabold ${
                isBest("dpMonthly") ? "text-emerald-800" : "text-blue-900"
              }`}
            >
              {fmtPhp(c.dpMonthly)}
            </div>
          </div>

          {/* RTO — eligibility/rate come only from /api/rto-rate; never invented client-side */}
          {rtoLoading ? (
            <div className="text-[11px] text-muted-foreground italic">Checking RTO eligibility…</div>
          ) : rtoInfo?.eligible ? (
            <div className="rounded-lg px-3 py-2 border bg-emerald-50 border-emerald-200">
              <div className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">RTO Eligible</div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>RTO monthly rate</span>
                <b className="ph-currency text-foreground">{fmtPhp(rtoInfo.monthly || 0)}</b>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-emerald-200">
                <div className="text-xs text-muted-foreground">Total Monthly (DP + RTO)</div>
                <div className="ph-currency text-[22px] font-extrabold text-emerald-800">
                  {fmtPhp(rtoTotalMonthly!)}
                </div>
              </div>
              {rtoInfo.memo && (
                <div className="mt-1 text-[10px] text-muted-foreground truncate" title={rtoInfo.memo}>
                  Memo: {rtoInfo.memo}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground italic">Not available for RTO</div>
          )}

          {/* Bank financing */}
          <div className="rounded-lg border">
            <div className="px-3 py-1.5 bg-slate-50 text-xs font-medium flex items-center justify-between gap-2">
              <span>Bank Balance</span>
              <b className="ph-currency">{fmtPhp(c.bankBalance)}</b>
            </div>
            <div className="grid grid-cols-2 divide-x">
              <div className="px-3 py-2 min-w-0">
                <StatCell
                  label={`15 yrs @ ${rate15yr}%`}
                  value={<span className="ph-currency">{fmtPhp(c.monthly15)}</span>}
                  best={isBest("monthly15")}
                />
              </div>
              <div className="px-3 py-2 min-w-0">
                <StatCell
                  label={`20 yrs @ ${rate20yr}%`}
                  value={<span className="ph-currency">{fmtPhp(c.monthly20)}</span>}
                  best={isBest("monthly20")}
                />
              </div>
            </div>
          </div>

          {/* Secondary: descriptive details, condensed to a couple of lines */}
          <div className="mt-auto pt-2 border-t text-xs text-muted-foreground space-y-1">
            <div className="truncate" title={`${u.city} • ${u.address}`}>
              {u.city}
              {u.address ? ` • ${u.address}` : ""}
            </div>
            <div className="truncate">
              {u.Type || "—"} • Floor {u.Floor || "—"} • {u.Facing || "Facing n/a"}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">
                {u.Status || "—"}
                {u.RFODate ? ` • RFO ${u.RFODate}` : ""}
              </span>
              <button
                onClick={() => router.push(`/computation/${encodeURIComponent(cid)}`)}
                data-export-hide="true"
                className="shrink-0 rounded border px-2 py-0.5 text-[11px] hover:bg-muted"
              >
                Compute →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------------- UI
  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">Compare Units</h1>
            <p className="text-sm text-muted-foreground">
              Side-by-side details and payments. You can tweak assumptions for all units at once.
            </p>
          </div>

          {/* Export — single toolbar (all breakpoints); PNG/PDF/Excel share the same styling */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={downloadPNG}
              disabled={!comparedUnits.length}
              className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              PNG
            </button>
            <button
              onClick={downloadPDF}
              disabled={!comparedUnits.length}
              className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              PDF
            </button>
            <button
              onClick={downloadExcel}
              disabled={!comparedUnits.length}
              className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Excel
            </button>
          </div>
        </div>

        {/* Top bar: add unit + compact Adjust trigger */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-start">
          <div className="card p-4 flex-1">
            <div className="text-sm font-medium mb-2">Add units to compare</div>
            {mounted && (
              <Select
                instanceId="compare-add-select"
                options={allOptions}
                filterOption={filterUnitOption}
                onChange={(opt) => {
                  const id = (opt as Option)?.value;
                  if (id) addId(id);
                }}
                placeholder="Search by project / tower / unit / type…"
              />
            )}
            {!!compareIds.length && (
              <div className="mt-3 text-xs text-muted-foreground">
                Currently selected: <b>{compareIds.length}</b> (max 6)
              </div>
            )}
          </div>

          <button
            onClick={() => setIsAdjustOpen(true)}
            className="btn btn-outline sm:mt-0 whitespace-nowrap"
          >
            ⚙ Adjust assumptions
          </button>
        </div>

        {/* Adjust panel — one implementation shared across breakpoints */}
        {isAdjustOpen && (
          <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsAdjustOpen(false)} />
            <div className="absolute left-0 right-0 bottom-0 sm:left-1/2 sm:right-auto sm:bottom-auto sm:top-24 sm:-translate-x-1/2 sm:w-[440px] max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b rounded-t-2xl">
                <div className="font-semibold">Adjustments</div>
                <button onClick={() => setIsAdjustOpen(false)} className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50">
                  Done
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Special Discount %", value: discountPct, step: 0.1, set: setDiscountPct },
                    { label: "Downpayment %", value: downPct, step: 0.1, set: setDownPct },
                    { label: "Months to Pay", value: monthsToPay, step: 1, set: (n: number) => setMonthsToPay(Math.max(1, Math.floor(n))) },
                    { label: "Reservation Fee", value: reservationFee, step: 1000, set: (n: number) => setReservationFee(Math.max(0, Math.floor(n))) },
                    { label: "Closing Fee %", value: closingFeePct, step: 0.1, set: setClosingFeePct },
                  ].map((f, i) => (
                    <label key={i} className="block text-xs">
                      {f.label}
                      <input
                        type="number"
                        step={f.step as number}
                        value={Number.isFinite(f.value as number) ? (f.value as number) : 0}
                        onChange={(e) => (f.set as any)(Number(e.target.value || 0))}
                        onFocus={(e) => e.currentTarget.select()}
                        className="mt-1 w-full px-2 py-2 border rounded"
                      />
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs">
                    15 years %
                    <input type="number" step={0.1} value={rate15yr} onChange={(e) => setRate15yr(Number(e.target.value || 0))} className="mt-1 w-full px-2 py-2 border rounded" />
                  </label>
                  <label className="block text-xs">
                    20 years %
                    <input type="number" step={0.1} value={rate20yr} onChange={(e) => setRate20yr(Number(e.target.value || 0))} className="mt-1 w-full px-2 py-2 border rounded" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Comparison content ---------------- */}
        <div className="mt-6" ref={sheetRef}>
          {/* Export-only heading + assumptions summary — hidden in the live UI (display:none),
              shown only while withSheetFrozen has toggled it on for a PNG/PDF capture. */}
          <div data-export-only="true" style={{ display: "none" }} className="mb-4">
            <div className="text-lg font-bold text-foreground">Unit Comparison</div>
            <div className="text-xs text-muted-foreground mt-1">
              Discount {discountPct}% • DP {downPct}% • Reservation{" "}
              <span className="ph-currency">{fmtPhp(reservationFee)}</span> • {monthsToPay} mos to pay • Closing{" "}
              {closingFeePct}% • Bank 15yr {rate15yr}% / 20yr {rate20yr}%
            </div>
          </div>

          {loading && <div className="card p-6">Loading…</div>}
          {loadError && (
            <div className="card p-4 border border-red-200 bg-red-50 text-sm text-red-800">
              <div className="font-semibold mb-1">Couldn’t load availability.</div>
              <div className="opacity-80 break-all">{loadError}</div>
              <button className="mt-2 rounded border px-3 py-1 text-xs" onClick={fetchRows}>Retry</button>
            </div>
          )}

          {!loading && !comparedUnits.length && (
            <div className="card p-8 text-center text-muted-foreground">
              Pick at least two units from Availability, or add here via search, to compare them side-by-side.
            </div>
          )}

          {comparedUnits.length > 0 && (
            <>
              {/* Desktop/tablet: side-by-side cards */}
              <div
                className="hidden md:flex gap-4 overflow-x-auto pb-1"
                data-export-relax-overflow="true"
              >
                {computedUnits.map(renderUnitCard)}
              </div>

              {/* Mobile: stacked cards */}
              <div className="md:hidden space-y-3">
                {computedUnits.map(renderUnitCard)}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
