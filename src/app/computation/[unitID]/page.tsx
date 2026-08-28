"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Select from "react-select";
import { matchesLegacyOrCanonical } from "@/lib/unit-id";
import { RESERVATION_FEE_DEFAULT, DOWNPAYMENT_PERCENT_DEFAULT } from "@/lib/quoteDefaults";

type UnitRow = {
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

type Option = { value: string; label: string };

// ---------- RTO helpers ----------
type RtoInfo = {
  eligible: boolean;
  monthly?: number;                 // monthly HomeAdvance rate (incl dues)
  memo?: string | null;             // memo ref (optional)
  match?: { area_min: number | null; area_max: number | null };
};

function rtoTypeCandidates(rawType: string): string[] {
  const t = (rawType || "").toUpperCase().replace(/\s+/g, "");
  const out: string[] = [];
  if (t.includes("STUDIO")) out.push("STUDIO");
  if (t.includes("1BR") || t.includes("1BED")) out.push("1BR");
  if (t.includes("2BR") || t.includes("2BED")) out.push("2BR");
  if (t.includes("3BR") || t.includes("3BED")) {
    if (t.includes("LOFT") && t.includes("INNER")) out.push("3BR LOFT INNER");
    if (t.includes("LOFT") && t.includes("END")) out.push("3BR LOFT END");
    out.push("3BR");
  }
  if (t.includes("4BR") || t.includes("4BED")) out.push("4BR");
  if (out.length === 0) out.push(rawType.toUpperCase());
  return out;
}

export default function ComputationPage() {
  const router = useRouter();
  const params = useParams();
  const unitIdFromUrl = decodeURIComponent((params?.unitID as string) || "");

  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(unitIdFromUrl);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Inputs
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [downPct, setDownPct] = useState<number>(DOWNPAYMENT_PERCENT_DEFAULT);
  const [monthsToPay, setMonthsToPay] = useState<number>(36);
  const [reservationFee, setReservationFee] = useState<number>(RESERVATION_FEE_DEFAULT);
  const [closingFeePct, setClosingFeePct] = useState<number>(10.5);
  const [rate15yr, setRate15yr] = useState<number>(6);
  const [rate20yr, setRate20yr] = useState<number>(6);

  // UI
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [floatPanel, setFloatPanel] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);

  // The sheet we render/export
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  // ---- fetch availability ----
  const fetchRows = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/api/availability`;
      const res = await fetch(url, { method: "GET", cache: "no-store", headers: { accept: "application/json" } });
      if (!res.ok) {
        const preview = await res.text();
        throw new Error(`API ${res.status} ${res.statusText} — ${preview.slice(0, 200)}`);
      }
      const json = await res.json();
      const data: UnitRow[] = Array.isArray(json.data) ? json.data : [];
      setRows(data);
      localStorage.setItem("comp_rows_cache", JSON.stringify(data));
    } catch (err: any) {
      const cached = localStorage.getItem("comp_rows_cache");
      if (cached) { try { setRows(JSON.parse(cached)); } catch {} }
      setLoadError(err?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); /* eslint-disable-next-line */ }, []);

  // ---- selected unit (canonical or legacy) ----
  const selectedUnit = useMemo(() => {
    return rows.find((u) =>
      matchesLegacyOrCanonical(
        { property_code: u.property_code, tower_code: u.tower_code, building_unit: u.BuildingUnit },
        selectedUnitId
      )
    );
  }, [rows, selectedUnitId]);

  // sync URL
  useEffect(() => {
    if (!rows.length || !unitIdFromUrl) return;
    const ok = rows.some((u) =>
      matchesLegacyOrCanonical(
        { property_code: u.property_code, tower_code: u.tower_code, building_unit: u.BuildingUnit },
        unitIdFromUrl
      )
    );
    if (ok) setSelectedUnitId(unitIdFromUrl);
  }, [rows, unitIdFromUrl]);

  // ---- RTO state & loader ----
  const [mode, setMode] = useState<"STANDARD" | "RTO">("STANDARD");
  const [rto, setRto] = useState<RtoInfo>({ eligible: false });
  const [rtoLoading, setRtoLoading] = useState(false);

  // move-in defaults (can expose later as editable)
  const [rtoAdvanceRentMonths] = useState(1);
  const [rtoSecurityDepositMonths] = useState(2);
  const [rtoAdvanceDpMonths] = useState(4);
  const [turnoverFees] = useState(25_000);

  // Fixed utility deposit for all RTO computations
  const RTO_UTILITY_DEPOSIT_PHP = 12_500 as const;

  useEffect(() => {
    let cancelled = false;
    async function loadRto() {
      setRtoLoading(true);
      setRto({ eligible: false });
      const u = selectedUnit;
      if (!u) { setRtoLoading(false); return; }

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
          if (!cancelled && json?.eligible) {
            setRto({
              eligible: true,
              monthly: Number(json.monthly_rate) || 0,
              memo: json.memo_ref || null,
              match: json.match || undefined,
            });
            setRtoLoading(false);
            return;
          }
        } catch { /* try next candidate */ }
      }
      if (!cancelled) { setRto({ eligible: false }); setRtoLoading(false); }
    }
    loadRto();
    return () => { cancelled = true; };
  }, [selectedUnit?.unit_id, selectedUnit?.Type, selectedUnit?.GrossAreaSQM, selectedUnit?.property_code]);

  // ---- unit dropdown options ----
  const unitOptions: Option[] = useMemo(
    () => rows.map((u) => ({
      value: u.unit_id,
      label: `${u.property_name} • ${u.tower_name || u.tower_code} • ${u.BuildingUnit} • ₱${u.ListPrice.toLocaleString()}`,
    })),
    [rows]
  );
  const selectedOption = useMemo(
    () => unitOptions.find((o) => o.value === selectedUnitId) || null,
    [unitOptions, selectedUnitId]
  );

  // ---- math helpers ----
  const fmtPhp = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(n);

  const listPrice = selectedUnit?.ListPrice ?? 0;
  const TCP = listPrice * (1 - discountPct / 100);
  const discountSavings = Math.max(0, listPrice - TCP);

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

  const validityText = (() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `VALID UNTIL: ${last.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} • may vary with unit availability`;
  })();

  // RTO math
  const rtoRate = rto.monthly || 0;
  const rtoTotalMonthly = dpMonthly + rtoRate;
  const rtoCashOutMoveIn =
    rtoRate * (rtoAdvanceRentMonths + rtoSecurityDepositMonths) +
    RTO_UTILITY_DEPOSIT_PHP +
    dpMonthly * rtoAdvanceDpMonths;

  // ---- compact spacing helpers ----
  const td = "py-[3px] px-2";    // consistent compact cell padding
  const tdTight = "py-0.5 px-2"; // even tighter for small labels
  const sectionPad = "px-3 py-2";

  // ---- robust capture for PNG/PDF (crisp & consistent) ----
  // We temporarily set a fixed export width so downloads look identical across devices.
  const EXPORT_WIDTH = 480; // px — narrow/portrait so PNG/PDF reads naturally on a phone screen
  const withSheetFrozen = async <T,>(work: () => Promise<T>): Promise<T> => {
    if (!sheetRef.current) return work();
    const node = sheetRef.current;
    const prev = {
      width: node.style.width,
      maxWidth: node.style.maxWidth,
      boxShadow: node.style.boxShadow,
      transform: node.style.transform,
      borderRadius: node.style.borderRadius,
    };
    node.style.width = `${EXPORT_WIDTH}px`;
    node.style.maxWidth = "none";
    node.style.boxShadow = "none";        // avoids shadow cut-offs
    node.style.transform = "none";        // avoid scaled parent issues
    // html-to-image's SVG-based capture can't be trusted to clip rounded corners
    // consistently across browsers; force hard corners for export so all 4 sides match.
    node.style.borderRadius = "0";
    document.body.classList.add("exporting"); // if you want to target global tweaks
    // RTO capture has several stacked sub-blocks (Cash-Out, Turnover, Bank Financing) that make
    // it much taller than Standard; this extra marker lets export-only CSS compact RTO specifically
    // without touching Standard export or the live UI.
    const isRtoExport = mode === "RTO";
    if (isRtoExport) document.body.classList.add("exporting-rto");
    // give the browser a tick to reflow
    await new Promise((r) => requestAnimationFrame(() => r(null as any)));
    // wait for webfonts so capture doesn't race Poppins loading; never hang if the API misbehaves
    await Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    try {
      return await work();
    } finally {
      node.style.width = prev.width;
      node.style.maxWidth = prev.maxWidth;
      node.style.boxShadow = prev.boxShadow;
      node.style.transform = prev.transform;
      node.style.borderRadius = prev.borderRadius;
      document.body.classList.remove("exporting");
      if (isRtoExport) document.body.classList.remove("exporting-rto");
    }
  };

  const downloadPNG = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    await withSheetFrozen(async () => {
      const node = sheetRef.current!;
      const width = EXPORT_WIDTH;
      const height = Math.max(node.scrollHeight, node.offsetHeight);
      const url = await toPng(node, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 3,              // crisp
        width,
        height,
        style: { transform: "none" }
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileStem(selectedUnitId)}.png`;
      a.click();
    });
  };

  const downloadPDF = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");

    await withSheetFrozen(async () => {
      const node = sheetRef.current!;
      const imgW = EXPORT_WIDTH;
      const imgH = Math.max(node.scrollHeight, node.offsetHeight);
      const imgData = await toPng(node, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 3,
        width: imgW,
        height: imgH,
        style: { transform: "none" }
      });

      // A4 in points (jsPDF default, 72pt = 1in)
      const pdf = new jsPDF({ orientation: imgW >= imgH ? "l" : "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Fit the whole image on a single page (no cropping)
      const scale = Math.min(pageW / imgW, pageH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;

      pdf.addImage(imgData, "PNG", x, y, drawW, drawH);
      pdf.save(`${safeFileStem(selectedUnitId)}.pdf`);
    });
  };

  // Excel stays the same
  const downloadExcel = async () => {
    const XLSX = await import("xlsx");
    const u = selectedUnit!;
    const data = [
      ["Project", u.property_name],
      ["City", u.city],
      ["Address", u.address],
      ["Tower", u.tower_name || u.tower_code],
      ["Unit", u.BuildingUnit],
      ["Type", u.Type],
      ["Floor", u.Floor],
      ["Area (SQM)", u.GrossAreaSQM],
      ["Facing", u.Facing],
      ["RFO Date", u.RFODate],
      [],
      ["List Price", u.ListPrice],
      ["Discount %", discountPct],
      ["TCP", TCP],
      ["Downpayment %", downPct],
      ["Downpayment", dpAmount],
      ["Reservation Fee", reservationFee],
      ["Net DP", netDp],
      ["Months to Pay", monthsToPay],
      ["DP Monthly", dpMonthly],
      ["Closing Fee %", closingFeePct],
      ["Closing Fee", closingFee],
      ["Bank Balance", bankBalance],
      [`15yrs @ ${rate15yr}%`, monthly15],
      [`20yrs @ ${rate20yr}%`, monthly20],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Computation");
    XLSX.writeFile(wb, `${safeFileStem(selectedUnitId)}.xlsx`);
  };

  // drag helpers (only when floating)
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!floatPanel || !mounted) return;
    const start = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    const startX = start.clientX, startY = start.clientY;
    const startPos = panelPos ?? {
      x: Math.max(16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 360),
      y: Math.max(16, (typeof window !== "undefined" ? window.innerHeight : 800) - 480),
    };
    const move = (ev: any) => {
      const p = "touches" in ev ? ev.touches[0] : ev;
      setPanelPos({ x: startPos.x + (p.clientX - startX), y: startPos.y + (p.clientY - startY) });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", up);
  };

  const adjustmentInputs = [
    { key: "discount", label: "Special Discount %", value: discountPct, step: 0.1, onChange: setDiscountPct },
    { key: "down", label: "Downpayment %", value: downPct, step: 0.1, onChange: setDownPct },
    { key: "months", label: "Months to Pay", value: monthsToPay, step: 1, onChange: (n: number) => setMonthsToPay(Math.max(1, Math.floor(n))) },
    { key: "res", label: "Reservation Fee", value: reservationFee, step: 1000, onChange: (n: number) => setReservationFee(Math.max(0, Math.floor(n))) },
    { key: "closing", label: "Closing Fee %", value: closingFeePct, step: 0.1, onChange: setClosingFeePct },
  ];

  return (
    <main className="min-h-screen flex bg-[#f6f7fb]">
      {/* Sidebar */}
      <aside
        className={`hidden md:block ${floatPanel ? "fixed z-50 w-80" : "w-72 sticky top-4 m-4"} bg-white shadow-xl rounded-2xl h-fit`}
        style={floatPanel && mounted && panelPos ? { left: panelPos.x, top: panelPos.y } : undefined}
      >
        <div
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          className="flex items-center justify-between gap-2 px-3 py-2 border-b rounded-t-2xl cursor-move select-none"
          title={floatPanel ? "Drag me" : "Click Float to undock"}
        >
          <div className="text-sm font-semibold text-blue-900">Adjustments</div>
          <div className="flex gap-2">
            <button onClick={() => setFloatPanel((v) => !v)} className="text-xs rounded-lg border px-2 py-1 hover:bg-gray-50">
              {floatPanel ? "Dock" : "Float"}
            </button>
            <button onClick={() => router.back()} className="text-xs rounded-lg border px-2 py-1 hover:bg-gray-50">← Back</button>
          </div>
        </div>

        <div className="p-3 space-y-3 text-sm">
          {adjustmentInputs.map(({ key, label, value, step, onChange }) => (
            <label key={key} className="block text-xs">
              {label}
              <input
                type="number"
                step={step}
                value={Number.isFinite(value as number) ? (value as number) : 0}
                onChange={(e) => (onChange as any)(Number(e.target.value || 0))}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1 w-full px-2 py-1 border rounded"
              />
            </label>
          ))}
        </div>

        <div className="px-3 py-2 border-t">
          <h3 className="font-semibold mb-2 text-blue-900 text-sm">Bank Rates</h3>
          <div className="space-y-2 text-sm">
            <label className="block text-xs">
              15 years %
              <input
                type="number"
                step={0.1}
                value={rate15yr}
                onChange={(e) => setRate15yr(Number(e.target.value || 0))}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1 w-full px-2 py-1 border rounded"
              />
            </label>
            <label className="block text-xs">
              20 years %
              <input
                type="number"
                step={0.1}
                value={rate20yr}
                onChange={(e) => setRate20yr(Number(e.target.value || 0))}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1 w-full px-2 py-1 border rounded"
              />
            </label>
          </div>
        </div>
      </aside>

      {/* Main */}
      <section className="flex-1 flex flex-col items-center p-4 pb-24 md:pb-4 md:pl-0 overflow-auto">
        {/* Unit picker + mode */}
        <div className="bg-white rounded-xl p-3 shadow-sm border w-full max-w-[480px] mb-2">
          <p className="font-semibold mb-2 text-blue-900">Select a unit to compute</p>
          <Select
            instanceId="comp-unit-select"
            options={unitOptions}
            value={selectedOption}
            onChange={(opt) => {
              const id = (opt as Option)?.value;
              if (id) {
                setSelectedUnitId(id);
                window.history.replaceState(null, "", `/computation/${encodeURIComponent(id)}`);
              }
            }}
            placeholder="Search unit…"
          />

          <div className="mt-2 flex items-center gap-2">
            <div className="inline-flex p-1 bg-white border rounded-xl">
              <button
                className={`px-3 py-1 rounded-lg text-sm ${mode === "STANDARD" ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
                onClick={() => setMode("STANDARD")}
              >
                Standard
              </button>
              <button
                className={`px-3 py-1 rounded-lg text-sm ${mode === "RTO" ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
                onClick={() => setMode("RTO")}
                disabled={!rto.eligible || rtoLoading}
                title={!rto.eligible && !rtoLoading ? "RTO not available for this unit" : undefined}
              >
                {rtoLoading ? "RTO…" : "RTO"}
              </button>
            </div>

            {mode === "RTO" && rto.eligible && rto.memo && (
              <span className="text-xs text-muted-foreground">Memo: {rto.memo}</span>
            )}
            {mode === "RTO" && !rtoLoading && !rto.eligible && (
              <span className="text-xs text-muted-foreground">RTO not available for this unit</span>
            )}
          </div>
        </div>

        {/* Error */}
        {loadError && (
          <div className="w-full max-w-[480px] mb-3">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="font-semibold mb-1">Couldn’t load availability.</div>
              <div className="opacity-80 break-all">{loadError}</div>
              <button className="mt-2 inline-flex items-center rounded border px-3 py-1 text-xs hover:bg-red-100" onClick={fetchRows}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Sheet */}
        {selectedUnit ? (
          <div className="w-full max-w-[480px] flex flex-col items-center space-y-3">
            <div ref={sheetRef} className="bg-white rounded-xl shadow-md w-full border overflow-hidden">
              {/* Top banner for RTO */}
              {mode === "RTO" && (
                <div className="px-3 py-0.5 bg-red-600 text-white font-extrabold tracking-wide text-center leading-tight">
                  RENT TO OWN — COMPUTATION
                </div>
              )}

              {/* Header */}
              <div className="bg-blue-900 text-white py-2">
                <h1 className="px-3 text-xl md:text-2xl font-bold">{selectedUnit.property_name}</h1>
                <p className="px-3 mt-0.5 text-blue-100 text-[13px]">{selectedUnit.address || selectedUnit.city}</p>
              </div>

              {/* Validity */}
              <div className="px-3 py-[3px] border-b leading-tight">
                <span className="text-[12px] font-semibold text-red-600">{validityText}</span>
              </div>

              {/* Unit meta */}
              <div className="px-3 py-[3px] border-b text-[12.5px] leading-tight grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 bg-[#fcfdff]">
                <div>Turnover date: <span className="font-semibold text-blue-900">{selectedUnit.RFODate || "TBA"}</span></div>
                <div>Building | Unit type: <span className="font-semibold text-blue-900">{selectedUnit.BuildingUnit} | {selectedUnit.Type}</span></div>
                <div>Total area: <span className="font-semibold text-blue-900">{selectedUnit.GrossAreaSQM} sqm</span></div>
              </div>

              {/* Table */}
              <div className="pb-2 rto-bottom-pad">
                <table className="w-full text-[13px] border-collapse rounded-none shadow-none overflow-visible">
                  <tbody>
                    <tr className="py-0.5 border-b">
                      <td className={td}>List Price:</td>
                      <td className={`${td} text-right font-semibold text-blue-900 ph-currency`}>{fmtPhp(selectedUnit.ListPrice)}</td>
                    </tr>
                    
                    {/* Special Discount highlight */}
                    {discountPct > 0 ? (
  <tr className="py-0.5 border-b">
    <td className="p-0" colSpan={2}>
      <div className="flex items-stretch justify-between rounded-md overflow-hidden ">
        <div className="p-0">
          <div className=" text-red-700">Special Discount</div>
        </div>
        <div className="flex items-center gap-1 px-1">
          <span className="text-[12px] text-red-700 px-2 py-1 rounded font-extrabold">
            {discountPct}%
          </span>
          <span className="text-sm text-red-700 ph-currency">
            −{fmtPhp(discountSavings)}
          </span>
        </div>
      </div>
    </td>
  </tr>
) : (
                    
                      <tr className="py-0.5 border-b">
                        <td className={tdTight}>Special Discount:</td>
                        <td className={`${tdTight} text-right text-slate-600 font-semibold`}>{discountPct}%</td>
                      </tr>
                    )}

                    <tr className="py-0.5 border-b bg-gray-50 font-semibold text-blue-900">
                      <td className={td}>Total Contract Price:</td>
                      <td className={`${td} text-right text-[18px] font-bold ph-currency`}>{fmtPhp(TCP)}</td>
                    </tr>
                    <tr className="py-0.5 border-b">
                      <td className={td}>Reservation Fee:</td>
                      <td className={`${td} text-right ph-currency`}>{fmtPhp(reservationFee)}</td>
                    </tr>
                    <tr className="py-0.5 border-b bg-gray-50">
                      <td className={td}>Downpayment <span className="text-xs text-muted-foreground">({downPct}%)</span>:</td>
                      <td className={`${td} text-right ph-currency`}>{fmtPhp(dpAmount)}</td>
                    </tr>

                    {/* Net DP highlight */}
                    <tr className="py-0.5 border-b">
                      <td className="p-0" colSpan={2}>
                        <div className="flex items-stretch justify-between rounded-md overflow-hidden">
                          <div className="flex-1 min-w-0 bg-blue-100 p-1 text-[13px]">
                            <div className="font-semibold text-blue-900">Net Downpayment Payable in:</div>
                            <div className="text-[11px] text-blue-800">*starts one month after reservation date</div>
                          </div>
                          <div className="flex items-center gap-2 bg-blue-100 px-3 shrink-0">
                            <span className="text-[12px] bg-blue-200 px-2 py-1 rounded font-medium">{monthsToPay} Mos.</span>
                            <span className="ph-currency text-[22px] font-extrabold text-blue-900">{fmtPhp(dpMonthly)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* RTO rows inside table */}
                    {mode === "RTO" && (
                      <>
                        <tr className="py-0.5 border-b">
                          <td className={td}>Rent To Own Rate: <span className="text-xs text-muted-foreground">(incl. assoc. dues)</span></td>
                          <td className={`${td} text-right font-semibold text-[18px] text-blue-900 ph-currency`}>{fmtPhp(rtoRate)}</td>
                        </tr>
                        <tr className="py-0.5 border-b">
                          <td className="p-0" colSpan={2}>
                            <div className="flex items-stretch justify-between rounded-md overflow-hidden bg-blue-700">
                              <div className="flex-1 min-w-0 p-1 text-[13px] text-white rto-total-label">
                                <div className="font-semibold">TOTAL Down Payment + Rent to Own</div>
                                <div className="text-[11px] text-blue-100">per month</div>
                              </div>
                              <div className="flex items-center px-3 shrink-0 rto-total-amt">
                                <span className="ph-currency text-[22px] font-extrabold text-white">{fmtPhp(rtoTotalMonthly)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Cash-out to Move-in */}
                        <tr>
                          <td colSpan={2} className="p-0">
                            <div className="mt-1 rounded-lg border overflow-hidden rto-cashout-wrap">
                              <div className="px-2 py-0.5 bg-slate-200 font-medium leading-tight rto-cashout-header">CASH OUT TO MOVE-IN (One-time)</div>
                              <div className="px-3 py-0.5 flex items-center justify-between text-sm leading-tight rto-cashout-row">
                                <span>1 Month Advance Rent</span>
                                <span className="ph-currency">{fmtPhp(rtoRate * rtoAdvanceRentMonths)}</span>
                              </div>
                              <div className="px-3 py-0.5 flex items-center justify-between text-sm leading-tight rto-cashout-row">
                                <span>2 Months Security Deposit</span>
                                <span className="ph-currency">{fmtPhp(rtoRate * rtoSecurityDepositMonths)}</span>
                              </div>
                              <div className="px-3 py-0.5 flex items-center justify-between text-sm leading-tight rto-cashout-row">
                                <span>Utility Bill Deposit</span>
                                <span className="ph-currency">{fmtPhp(RTO_UTILITY_DEPOSIT_PHP)}</span>
                              </div>
                              <div className="px-3 py-0.5 flex items-center justify-between text-sm leading-tight rto-cashout-row">
                                <span>Down Payment (Advance {rtoAdvanceDpMonths} mos)</span>
                                <span className="ph-currency">{fmtPhp(dpMonthly * rtoAdvanceDpMonths)}</span>
                              </div>
                              <div className="px-3 py-1 flex items-center justify-between bg-blue-50 rto-cashout-total">
                                <span className="font-semibold text-[16px]">Total Cash-Out</span>
                                <b className="ph-currency text-blue-900 text-[17px] font-extrabold">{fmtPhp(rtoCashOutMoveIn)}</b>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Due upon Turnover */}
                        <tr>
                          <td colSpan={2} className="p-0">
                            <div className="mt-1 rounded-lg border overflow-hidden rto-turnover-wrap">
                              <div className="px-3 py-0.5 bg-slate-200 font-medium leading-tight rto-turnover-header">DUE UPON TURNOVER (after {monthsToPay} months)</div>
                              <div className="px-3 py-0.5 flex items-center justify-between text-sm leading-tight rto-turnover-row">
                                <span>Closing Fees <span className="text-xs text-muted-foreground">({closingFeePct}%)</span></span>
                                <b className="ph-currency">{fmtPhp(closingFee)}</b>
                              </div>
                              <div className="px-3 py-0.5 flex items-center justify-between text-sm leading-tight rto-turnover-row">
                                <span>Turnover Fees (estimate)</span>
                                <b className="ph-currency">{fmtPhp(turnoverFees)}</b>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </>
                    )}

                    {/* Standard closing + balance rows (only show Closing Fee here if NOT in RTO) */}
                    {mode !== "RTO" && (
                      <>
                        <tr className="border-b">
                          <td className={td}>
                            Closing Fee <span className="text-xs text-muted-foreground">({closingFeePct}%)</span>:
                          </td>
                          <td className={`${td} text-right ph-currency`}>{fmtPhp(closingFee)}</td>
                        </tr>
                        <tr>
                          <td className="px-3 pb-2 text-[11px] text-muted-foreground leading-tight" colSpan={2}>
                            *Covers Title fees &amp; other government fees • *Payable upon turnover • *Can be included in bank loan
                          </td>
                        </tr>
                      </>
                    )}

                    <tr className="border-t bg-gray-50 font-semibold">
                      <td className={`${td} rto-balance-cell`}>Balance Bank Financing:</td>
                      <td className={`${td} text-right text-blue-900 text-[16px] font-bold ph-currency rto-balance-cell`}>{fmtPhp(bankBalance)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Bank Financing */}
                <div className="mt-2 border-t pt-1.5 rto-bankfin-wrap">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 rto-bankfin-headrow">
                    <p className="px-2 font-semibold text-blue-900">Bank Financing</p>
                    <p className="px-2 sm:px-0 text-[11px] text-muted-foreground leading-tight">*Subject to bank’s prevailing rate at time of loan</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 rto-bankfin-grid">
                    <div className="rounded-lg border px-2 py-1.5 rto-bankfin-card">
                      <div className="text-xs text-muted-foreground">20 years @ {rate20yr}%</div>
                      <div className="text-right text-[16px] font-bold text-blue-900 ph-currency">{fmtPhp(monthly20)}</div>
                    </div>
                    <div className="rounded-lg border px-2 py-1.5 rto-bankfin-card">
                      <div className="text-xs text-muted-foreground">15 years @ {rate15yr}%</div>
                      <div className="text-right text-[16px] font-bold text-blue-900 ph-currency">{fmtPhp(monthly15)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <button onClick={() => router.back()} className="px-4 py-2 border rounded-lg">← Back</button>
              <button onClick={downloadPNG} className="px-4 py-2 bg-blue-600 text-white rounded-lg">PNG</button>
              <button onClick={downloadPDF} className="px-4 py-2 bg-green-600 text-white rounded-lg">PDF</button>
              <button onClick={downloadExcel} className="px-4 py-2 bg-yellow-500 text-white rounded-lg">Excel</button>
            </div>
          </div>
        ) : (
          !loading && !loadError && <p className="text-gray-600 mt-8">Select a unit to see the computation.</p>
        )}
      </section>

      {/* Mobile FAB */}
      {mounted && (
        <button
          onClick={() => setIsAdjustOpen(true)}
          className="md:hidden fixed bottom-5 right-5 z-50 rounded-full shadow-lg bg-blue-600 text-white px-4 py-3"
          aria-label="Open adjustments"
        >
          Adjust
        </button>
      )}

      {/* Mobile sheet */}
      {isAdjustOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsAdjustOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 max-h-[85vh] bg-white rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b rounded-t-2xl">
              <div className="font-semibold">Adjustments</div>
              <button onClick={() => setIsAdjustOpen(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Done</button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "discount", label: "Special Discount %", value: discountPct, step: 0.1, onChange: setDiscountPct },
                  { key: "down", label: "Downpayment %", value: downPct, step: 0.1, onChange: setDownPct },
                  { key: "months", label: "Months to Pay", value: monthsToPay, step: 1, onChange: (n: number) => setMonthsToPay(Math.max(1, Math.floor(n))) },
                  { key: "res", label: "Reservation Fee", value: reservationFee, step: 1000, onChange: (n: number) => setReservationFee(Math.max(0, Math.floor(n))) },
                  { key: "closing", label: "Closing Fee %", value: closingFeePct, step: 0.1, onChange: setClosingFeePct },
                ].map(({ key, label, value, step, onChange }) => (
                  <label key={key} className="block text-xs">
                    {label}
                    <input
                      type="number"
                      step={step as number}
                      value={Number.isFinite(value as number) ? (value as number) : 0}
                      onChange={(e) => (onChange as any)(Number(e.target.value || 0))}
                      onFocus={(e) => e.currentTarget.select()}
                      className="mt-1 w-full px-2 py-2 border rounded"
                    />
                  </label>
                ))}
              </div>

              <div className="pt-1">
                <h3 className="font-semibold mb-2 text-blue-900 text-sm">Bank Rates</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs">
                    15 years %
                    <input
                      type="number"
                      step={0.1}
                      value={rate15yr}
                      onChange={(e) => setRate15yr(Number(e.target.value || 0))}
                      onFocus={(e) => e.currentTarget.select()}
                      className="mt-1 w-full px-2 py-2 border rounded"
                    />
                  </label>
                  <label className="block text-xs">
                    20 years %
                    <input
                      type="number"
                      step={0.1}
                      value={rate20yr}
                      onChange={(e) => setRate20yr(Number(e.target.value || 0))}
                      onFocus={(e) => e.currentTarget.select()}
                      className="mt-1 w-full px-2 py-2 border rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ---- utilities ----
const safeFileStem = (s: string) => (s || "computation").replace(/[^\w\-]+/g, "_");
