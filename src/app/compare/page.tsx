"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { useRouter } from "next/navigation";
import { makeUnitId, matchesLegacyOrCanonical } from "@/lib/unit-id";

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

type Option = { value: string; label: string };

// FIX 1: give the row renderer a proper type so `u` is not `any`
type TableRow = [label: string, render: (u: UnitRow) => React.ReactNode];

// Keep cache small & robust
const COMPARE_CACHE_KEY = "compare_rows_cache_v2";
const MAX_CACHE_UNITS = 800; // tune as you like

function slimForCompare(data: any[]): UnitRow[] {
  // keep only fields Compare uses and cap to MAX_CACHE_UNITS
  return data.slice(0, MAX_CACHE_UNITS).map((u) => ({
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
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [downPct, setDownPct] = useState<number>(20);
  const [monthsToPay, setMonthsToPay] = useState<number>(36);
  const [reservationFee, setReservationFee] = useState<number>(20000);
  const [closingFeePct, setClosingFeePct] = useState<number>(10.5);
  const [rate15yr, setRate15yr] = useState<number>(6);
  const [rate20yr, setRate20yr] = useState<number>(6);

  // mobile adjustments panel
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [floatingDocked, setFloatingDocked] = useState(true);

  // export ref
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

    // Preload saved global tweaks if you want persistence:
    try {
      const raw = localStorage.getItem("compare_adjustments");
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.discountPct === "number") setDiscountPct(s.discountPct);
        if (typeof s.downPct === "number") setDownPct(s.downPct);
        if (typeof s.monthsToPay === "number") setMonthsToPay(s.monthsToPay);
        if (typeof s.reservationFee === "number") setReservationFee(s.reservationFee);
        if (typeof s.closingFeePct === "number") setClosingFeePct(s.closingFeePct);
        if (typeof s.rate15yr === "number") setRate15yr(s.rate15yr);
        if (typeof s.rate20yr === "number") setRate20yr(s.rate20yr);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(
      "compare_adjustments",
      JSON.stringify({ discountPct, downPct, monthsToPay, reservationFee, closingFeePct, rate15yr, rate20yr })
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

  // Given a unit, compute comparable fields with global adjustments
  const compute = (u: UnitRow) => {
    const TCP = (u.ListPrice || 0) * (1 - discountPct / 100);
    const dpAmount = (TCP * downPct) / 100;
    const netDp = Math.max(0, dpAmount - reservationFee);
    const dpMonthly = monthsToPay > 0 ? netDp / monthsToPay : 0;
    const closingFee = (TCP * closingFeePct) / 100;
    const bankBalance = Math.max(0, TCP - dpAmount);

    const amort = (principal: number, annual: number, years: number) => {
      const r = annual / 100 / 12;
      const n = years * 12;
      return r === 0 ? principal / n : principal * (r / (1 - Math.pow(1 + r, -n)));
    };
    const monthly15 = amort(bankBalance, rate15yr, 15);
    const monthly20 = amort(bankBalance, rate20yr, 20);

    return { TCP, dpAmount, netDp, dpMonthly, closingFee, bankBalance, monthly15, monthly20 };
  };

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
  const allOptions: Option[] = useMemo(
    () =>
      rows.map(u => ({
        value: canonicalIdFor(u),
        label: `${u.property_name} • ${u.tower_name || u.tower_code} • ${u.BuildingUnit} • ₱${u.ListPrice.toLocaleString()}`
      })),
    [rows]
  );

  // FIX 2: define TABLE_ROWS at the component level (not inside a function)
  const TABLE_ROWS: TableRow[] = [
    ["Project",          (u) => u.property_name],
    ["City",             (u) => u.city],
    ["Address",          (u) => u.address],
    ["Tower",            (u) => u.tower_name || u.tower_code],
    ["Unit",             (u) => u.BuildingUnit],
    ["Type",             (u) => u.Type],
    ["Floor",            (u) => u.Floor],
    ["Area (SQM)",       (u) => u.GrossAreaSQM],
    ["Facing",           (u) => u.Facing],
    ["Status",           (u) => u.Status],
    ["RFO Date",         (u) => u.RFODate],
    ["List Price",       (u) => fmtPhp(u.ListPrice)],
    ["Price / SQM",      (u) => fmtPhp(u.PerSQM)],
    ["—",                ()  => "—"],
    ["Discount %",       ()  => `${discountPct}%`],
    ["Total Contract Price", (u) => fmtPhp(compute(u).TCP)],
    ["Downpayment %",    ()  => `${downPct}%`],
    ["Downpayment",      (u) => fmtPhp(compute(u).dpAmount)],
    ["Reservation Fee",  ()  => fmtPhp(reservationFee)],
    ["Net DP",           (u) => fmtPhp(compute(u).netDp)],
    ["Months to Pay",    ()  => monthsToPay],
    ["DP Monthly",       (u) => fmtPhp(compute(u).dpMonthly)],
    ["Closing Fee %",    ()  => `${closingFeePct}%`],
    ["Closing Fee",      (u) => fmtPhp(compute(u).closingFee)],
    ["Bank Balance",     (u) => fmtPhp(compute(u).bankBalance)],
    [`15yrs @ ${rate15yr}%`, (u) => fmtPhp(compute(u).monthly15)],
    [`20yrs @ ${rate20yr}%`, (u) => fmtPhp(compute(u).monthly20)],
  ];

  // ---------------- Exports
  const downloadPNG = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    const url = await toPng(sheetRef.current, { cacheBust: true, pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = "unit-comparison.png";
    a.click();
  };

  const downloadPDF = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    const imgData = await toPng(sheetRef.current, { cacheBust: true, pixelRatio: 2 });
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "l", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const img = new Image();
    img.src = imgData;
    await new Promise(res => (img.onload = res));
    const scale = pageWidth / img.width;
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, img.height * scale);
    pdf.save("unit-comparison.pdf");
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

  // ---------------- UI
  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">Compare Units</h1>
            <p className="text-sm text-muted-foreground">
              Side-by-side details and payments. You can tweak assumptions for all units at once.
            </p>
          </div>

          {/* Export */}
          <div className="hidden md:flex items-center gap-2">
            <button onClick={downloadPNG} className="btn btn-outline">PNG</button>
            <button onClick={downloadPDF} className="btn btn-outline">PDF</button>
            <button onClick={downloadExcel} className="btn btn-primary">Excel</button>
          </div>
        </div>

        {/* Top bar: add unit + adjustments (desktop inline) */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          {/* Add unit */}
          <div className="card p-4">
            <div className="text-sm font-medium mb-2">Add units to compare</div>
            {mounted && (
              <Select
                instanceId="compare-add-select"
                options={allOptions}
                onChange={(opt) => {
                  const id = (opt as Option)?.value;
                  if (id) addId(id);
                }}
                placeholder="Search by project / tower / unit…"
              />
            )}
            {!!compareIds.length && (
              <div className="mt-3 text-xs text-muted-foreground">
                Currently selected: <b>{compareIds.length}</b> (max 6)
              </div>
            )}
          </div>

          {/* Adjustments (desktop) */}
          <div className="hidden lg:block card p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Adjustments</div>
              <button
                onClick={() => setFloatingDocked((v) => !v)}
                className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              >
                {floatingDocked ? "Undock" : "Dock"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
              <label className="block text-xs">
                Special Discount %
                <input type="number" step={0.1} value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value || 0))} className="mt-1 w-full px-2 py-1 border rounded" />
              </label>
              <label className="block text-xs">
                Downpayment %
                <input type="number" step={0.1} value={downPct} onChange={(e) => setDownPct(Number(e.target.value || 0))} className="mt-1 w-full px-2 py-1 border rounded" />
              </label>
              <label className="block text-xs">
                Months to Pay
                <input type="number" step={1} value={monthsToPay} onChange={(e) => setMonthsToPay(Math.max(1, Math.floor(Number(e.target.value || 0))))} className="mt-1 w-full px-2 py-1 border rounded" />
              </label>
              <label className="block text-xs">
                Reservation Fee
                <input type="number" step={1000} value={reservationFee} onChange={(e) => setReservationFee(Math.max(0, Math.floor(Number(e.target.value || 0))))} className="mt-1 w-full px-2 py-1 border rounded" />
              </label>
              <label className="block text-xs">
                Closing Fee %
                <input type="number" step={0.1} value={closingFeePct} onChange={(e) => setClosingFeePct(Number(e.target.value || 0))} className="mt-1 w-full px-2 py-1 border rounded" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs">
                  15 yrs %
                  <input type="number" step={0.1} value={rate15yr} onChange={(e) => setRate15yr(Number(e.target.value || 0))} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="block text-xs">
                  20 yrs %
                  <input type="number" step={0.1} value={rate20yr} onChange={(e) => setRate20yr(Number(e.target.value || 0))} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile FAB for adjustments */}
        {mounted && (
          <button
            onClick={() => setIsAdjustOpen(true)}
            className="lg:hidden fixed bottom-5 right-5 z-50 rounded-full shadow-lg bg-blue-600 text-white px-4 py-3"
            aria-label="Open adjustments"
          >
            Adjust
          </button>
        )}

        {/* Mobile bottom sheet for adjustments */}
        {isAdjustOpen && (
          <div className="lg:hidden fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsAdjustOpen(false)} />
            <div className="absolute left-0 right-0 bottom-0 max-h-[85vh] bg-white rounded-t-2xl shadow-2xl">
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
        <div className="mt-6">
          {/* Desktop: wide comparison table */}
          <div className="hidden md:block">
            <div className="card p-0 overflow-x-auto" ref={sheetRef}>
              {(!comparedUnits.length && !loading) && (
                <div className="p-8 text-center text-muted-foreground">
                  Pick at least two units from Availability and click “Compare”, or add here via search.
                </div>
              )}

              {comparedUnits.length > 0 && (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-[#0f172a] text-white">
                      <th className="sticky left-0 z-10 bg-[#0f172a] text-left px-3 py-3">Field</th>
                      {comparedUnits.map((u) => {
                        const cid = canonicalIdFor(u);
                        return (
                          <th key={cid} className="px-3 py-3 text-left whitespace-nowrap">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-semibold">{u.property_name}</div>
                                <div className="text-xs opacity-90">
                                  {u.tower_name || u.tower_code} • {u.BuildingUnit}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => router.push(`/computation/${encodeURIComponent(cid)}`)}
                                  className="rounded border px-2 py-1 text-xs hover:bg-white/10"
                                >
                                  Compute
                                </button>
                                <button
                                  onClick={() => removeId(cid)}
                                  className="rounded border px-2 py-1 text-xs hover:bg-white/10"
                                  title="Remove from comparison"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {TABLE_ROWS.map(([label, fn], idx) => (
                      <tr key={idx} className="even:bg-white odd:bg-slate-50">
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium">
                          {label}
                        </td>
                        {comparedUnits.map((u) => {
                          const cid = canonicalIdFor(u);
                          return (
                            <td
                              key={`${label}-${cid}`}
                              className="px-3 py-2 whitespace-nowrap text-right md:text-left"
                            >
                              {fn(u)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Exports (desktop bottom) */}
            {comparedUnits.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <button onClick={downloadPNG} className="btn btn-outline">PNG</button>
                <button onClick={downloadPDF} className="btn btn-outline">PDF</button>
                <button onClick={downloadExcel} className="btn btn-primary">Excel</button>
              </div>
            )}
          </div>

          {/* Mobile: stacked cards */}
          <div className="md:hidden">
            {loading && <div className="card p-6">Loading…</div>}
            {loadError && (
              <div className="card p-4 border border-red-200 bg-red-50 text-sm text-red-800">
                <div className="font-semibold mb-1">Couldn’t load availability.</div>
                <div className="opacity-80 break-all">{loadError}</div>
                <button className="mt-2 rounded border px-3 py-1 text-xs" onClick={fetchRows}>Retry</button>
              </div>
            )}

            {!loading && !comparedUnits.length && (
              <div className="card p-6 text-center text-muted-foreground">
                Pick at least two units from Availability and tap “Compare”, or add here via search.
              </div>
            )}

            <div className="space-y-3">
              {comparedUnits.map((u) => {
                const cid = canonicalIdFor(u);
                const c = compute(u);
                return (
                  <div key={cid} className="card overflow-hidden">
                    <div className="bg-[#0f172a] text-white px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{u.property_name}</div>
                        <div className="text-xs opacity-90">{u.tower_name || u.tower_code} • {u.BuildingUnit}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/computation/${encodeURIComponent(cid)}`)}
                          className="rounded border px-2 py-1 text-xs hover:bg-white/10"
                        >
                          Compute
                        </button>
                        <button onClick={() => removeId(cid)} className="rounded border px-2 py-1 text-xs hover:bg-white/10">✕</button>
                      </div>
                    </div>

                    <div className="p-4 text-sm space-y-2">
                      <div className="text-xs text-muted-foreground">{u.city} • {u.address}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>Type: <b>{u.Type}</b></div>
                        <div>Floor: <b>{u.Floor}</b></div>
                        <div>Area: <b>{u.GrossAreaSQM} sqm</b></div>
                        <div>Facing: <b>{u.Facing || "-"}</b></div>
                        <div>Status: <b>{u.Status}</b></div>
                        <div>RFO: <b>{u.RFODate || "TBA"}</b></div>
                      </div>

                      <div className="mt-2 rounded-lg border">
                        <div className="px-3 py-2 bg-slate-50 font-medium">Pricing</div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>List Price</span>
                          <b>{fmtPhp(u.ListPrice)}</b>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>Price / SQM</span>
                          <b>{fmtPhp(u.PerSQM)}</b>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>TCP (disc {discountPct}%)</span>
                          <b>{fmtPhp(c.TCP)}</b>
                        </div>
                      </div>

                      <div className="mt-2 rounded-lg border">
                        <div className="px-3 py-2 bg-slate-50 font-medium">Downpayment</div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>DP {downPct}%</span>
                          <b>{fmtPhp(c.dpAmount)}</b>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>Reservation</span>
                          <b>{fmtPhp(reservationFee)}</b>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>Net DP</span>
                          <b>{fmtPhp(c.netDp)}</b>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>DP Monthly ({monthsToPay} mos)</span>
                          <b>{fmtPhp(c.dpMonthly)}</b>
                        </div>
                      </div>

                      <div className="mt-2 rounded-lg border">
                        <div className="px-3 py-2 bg-slate-50 font-medium">Bank</div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>Closing Fee {closingFeePct}%</span>
                          <b>{fmtPhp(c.closingFee)}</b>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>Balance</span>
                          <b>{fmtPhp(c.bankBalance)}</b>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>15 yrs @ {rate15yr}%</span>
                          <b>{fmtPhp(c.monthly15)}</b>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span>20 yrs @ {rate20yr}%</span>
                          <b>{fmtPhp(c.monthly20)}</b>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Exports (mobile) */}
            {comparedUnits.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <button onClick={downloadPNG} className="btn btn-outline">PNG</button>
                <button onClick={downloadPDF} className="btn btn-outline">PDF</button>
                <button onClick={downloadExcel} className="btn btn-primary">Excel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop floating adjustments panel (draggable-ish) */}
      <div
        className={`hidden lg:block fixed z-40 ${floatingDocked ? "top-24 right-6" : "top-24 left-1/2 -translate-x-1/2"}`}
      >
        <div className="rounded-2xl shadow-2xl border bg-white p-3">
          <div className="text-xs font-medium pb-2 border-b">Quick Adjust</div>
          <div className="grid grid-cols-3 gap-2 pt-2">
            <input className="px-2 py-1 border rounded text-xs" type="number" step={0.1} value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value || 0))} placeholder="Discount %" />
            <input className="px-2 py-1 border rounded text-xs" type="number" step={0.1} value={downPct} onChange={(e) => setDownPct(Number(e.target.value || 0))} placeholder="DP %" />
            <input className="px-2 py-1 border rounded text-xs" type="number" step={1} value={monthsToPay} onChange={(e) => setMonthsToPay(Math.max(1, Math.floor(Number(e.target.value || 0))))} placeholder="Months" />
            <input className="px-2 py-1 border rounded text-xs" type="number" step={1000} value={reservationFee} onChange={(e) => setReservationFee(Math.max(0, Math.floor(Number(e.target.value || 0))))} placeholder="Reservation" />
            <input className="px-2 py-1 border rounded text-xs" type="number" step={0.1} value={closingFeePct} onChange={(e) => setClosingFeePct(Number(e.target.value || 0))} placeholder="Closing %" />
            <div className="grid grid-cols-2 gap-2">
              <input className="px-2 py-1 border rounded text-xs" type="number" step={0.1} value={rate15yr} onChange={(e) => setRate15yr(Number(e.target.value || 0))} placeholder="15 yrs %" />
              <input className="px-2 py-1 border rounded text-xs" type="number" step={0.1} value={rate20yr} onChange={(e) => setRate20yr(Number(e.target.value || 0))} placeholder="20 yrs %" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
