"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Select from "react-select";
import { matchesLegacyOrCanonical } from "@/lib/unit-id";

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
  const [downPct, setDownPct] = useState<number>(20);
  const [monthsToPay, setMonthsToPay] = useState<number>(36);
  const [reservationFee, setReservationFee] = useState<number>(20_000);
  const [closingFeePct, setClosingFeePct] = useState<number>(10.5);
  const [rate15yr, setRate15yr] = useState<number>(6);
  const [rate20yr, setRate20yr] = useState<number>(6);

  // UI
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [floatPanel, setFloatPanel] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
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
  const [rtoUtilityDepositMonths] = useState(1);
  const [rtoAdvanceDpMonths] = useState(4);
  const [turnoverFees] = useState(25_000);

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
        } catch {/* try next candidate */}
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

  const TCP = (selectedUnit?.ListPrice || 0) * (1 - discountPct / 100);
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
    rtoRate * (rtoAdvanceRentMonths + rtoSecurityDepositMonths + rtoUtilityDepositMonths) +
    dpMonthly * rtoAdvanceDpMonths;

  // ---- capture helpers for PNG/PDF ----
  const computeCaptureSize = () => {
    const node = sheetRef.current!;
    const rect = node.getBoundingClientRect();
    // Render at a consistent width (good for mobile & desktop), but never smaller than what’s visible
    const targetW = Math.min(980, Math.max(760, rect.width));
    const targetH = rect.height * (targetW / rect.width);
    return { targetW, targetH };
  };

  // downloads
  const safeFileStem = (s: string) => (s || "computation").replace(/[^\w\-]+/g, "_");

  const downloadPNG = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    const { targetW, targetH } = computeCaptureSize();
    const url = await toPng(sheetRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      width: Math.round(targetW),
      height: Math.round(targetH),
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileStem(selectedUnitId)}.png`;
    a.click();
  };

  const downloadPDF = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");

    const { targetW, targetH } = computeCaptureSize();
    const imgData = await toPng(sheetRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      width: Math.round(targetW),
      height: Math.round(targetH),
    });

    const orientation = targetW >= targetH ? "l" : "p";
    const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Fit the whole image onto a single page (no cropping)
    const scale = Math.min(pageW / targetW, pageH / targetH);
    const drawW = targetW * scale;
    const drawH = targetH * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;

    pdf.addImage(imgData, "PNG", x, y, drawW, drawH);
    pdf.save(`${safeFileStem(selectedUnitId)}.pdf`);
  };

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
          className="flex items-center justify-between gap-2 px-4 py-2 border-b rounded-t-2xl cursor-move select-none"
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

        <div className="p-4 space-y-3 text-sm">
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

        <div className="px-4 py-3 border-t">
          <h3 className="font-semibold mb-3 text-blue-900 text-sm">Bank Rates</h3>
          <div className="space-y-3 text-sm">
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
      <section className="flex-1 flex flex-col items-center p-4 md:pl-0 overflow-auto">
        {/* Unit picker + mode */}
        <div className="bg-white rounded-xl p-4 shadow-sm border w-full max-w-[760px] sm:max-w-[860px] md:max-w-[980px] xl:max-w-[1100px] mb-4">
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

          <div className="mt-3 flex items-center gap-2">
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
          <div className="w-full max-w-[760px] sm:max-w-[860px] md:max-w-[980px] xl:max-w-[1100px] mb-3">
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
          <div className="w-full max-w-[760px] sm:max-w-[860px] md:max-w-[980px] xl:max-w-[1100px] flex flex-col items-center space-y-4">
            <div ref={sheetRef} className="bg-white rounded-xl shadow-md w-full border overflow-hidden">
              {/* Top banner for RTO */}
              {mode === "RTO" && (
                <div className="px-5 py-2 bg-red-600 text-white font-extrabold tracking-wide text-center">
                  RENT TO OWN — COMPUTATION
                </div>
              )}

              {/* Header */}
              <div className="bg-blue-900 text-white p-6">
                <h1 className="text-2xl font-bold">{selectedUnit.property_name}</h1>
                <p className="opacity-90">{selectedUnit.tower_name || selectedUnit.tower_code}</p>
                <p className="mt-1 text-blue-100">{selectedUnit.address || selectedUnit.city}</p>
              </div>

              {/* Validity */}
              <div className="px-5 py-2 border-b">
                <span className="text-[13px] font-semibold text-red-600">{validityText}</span>
              </div>

              {/* Unit meta */}
              <div className="px-5 py-3 border-b text-[13px] grid sm:grid-cols-3 gap-2 bg-[#fcfdff]">
                <div>Turnover date: <span className="font-semibold text-blue-900">{selectedUnit.RFODate || "TBA"}</span></div>
                <div>Building | Unit type: <span className="font-semibold text-blue-900">{selectedUnit.BuildingUnit} | {selectedUnit.Type}</span></div>
                <div>Total area: <span className="font-semibold text-blue-900">{selectedUnit.GrossAreaSQM} sqm</span></div>
              </div>

              {/* Table */}
              <div className="p-5">
                <table className="w-full text-[13px] border-collapse">
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2">List Price:</td>
                      <td className="p-2 text-right font-semibold text-blue-900">{fmtPhp(selectedUnit.ListPrice)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Special Discount:</td>
                      <td className="p-2 text-right text-red-600 font-semibold">{discountPct}%</td>
                    </tr>
                    <tr className="border-b bg-gray-50 font-semibold text-blue-900">
                      <td className="p-2">Total Contract Price:</td>
                      <td className="p-2 text-right">{fmtPhp(TCP)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2">Reservation Fee:</td>
                      <td className="p-2 text-right">{fmtPhp(reservationFee)}</td>
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <td className="p-2">Downpayment <span className="text-xs text-muted-foreground">({downPct}%)</span>:</td>
                      <td className="p-2 text-right">{fmtPhp(dpAmount)}</td>
                    </tr>
                    {/* Net DP highlight */}
                    <tr className="border-b">
                      <td className="p-0" colSpan={2}>
                        <div className="flex items-stretch justify-between rounded-md overflow-hidden">
                          <div className="flex-1 bg-yellow-100 p-2 text-[13px]">
                            <div className="font-semibold text-yellow-900">Net Downpayment Payable in:</div>
                            <div className="text-[11px] text-yellow-800">*will start after a month of the reservation date</div>
                          </div>
                          <div className="flex items-center gap-3 bg-yellow-100 px-3">
                            <span className="text-[12px] bg-yellow-200 px-2 py-1 rounded font-medium">{monthsToPay} Mos.</span>
                            <span className="text-2xl font-extrabold text-yellow-900">{fmtPhp(dpMonthly)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* RTO rows inside table */}
                    {mode === "RTO" && (
                      <>
                        <tr className="border-b">
                          <td className="p-2">Rent To Own Rate: <span className="text-xs text-muted-foreground">(incl. assoc. dues)</span></td>
                          <td className="p-2 text-right font-semibold text-blue-900">{fmtPhp(rtoRate)}</td>
                        </tr>
                        <tr className="border-b bg-yellow-50">
                          <td className="p-2 font-semibold">TOTAL Down Payment + Rent to Own <span className="text-xs text-muted-foreground">(per month)</span>:</td>
                          <td className="p-2 text-right text-yellow-900 font-extrabold text-xl">{fmtPhp(rtoTotalMonthly)}</td>
                        </tr>

                        {/* Cash-out to Move-in panel as a table row (valid HTML) */}
                        <tr>
                          <td colSpan={2} className="p-0">
                            <div className="mt-4 rounded-lg border overflow-hidden">
                              <div className="px-3 py-2 bg-slate-50 font-medium">CASH OUT TO MOVE-IN (One-time)</div>
                              <div className="px-3 py-2 flex items-center justify-between text-sm">
                                <span>1 Month Advance Rent</span>
                                <b>{fmtPhp(rtoRate * rtoAdvanceRentMonths)}</b>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between text-sm">
                                <span>2 Months Security Deposit</span>
                                <b>{fmtPhp(rtoRate * rtoSecurityDepositMonths)}</b>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between text-sm">
                                <span>Utility Bill Deposit</span>
                                <b>{fmtPhp(rtoRate * rtoUtilityDepositMonths)}</b>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between text-sm">
                                <span>Down Payment (Advance {rtoAdvanceDpMonths} mos)</span>
                                <b>{fmtPhp(dpMonthly * rtoAdvanceDpMonths)}</b>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between bg-yellow-50">
                                <span className="font-semibold">Total Cash-Out</span>
                                <b className="text-yellow-900">{fmtPhp(rtoCashOutMoveIn)}</b>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Due upon Turnover panel as a table row */}
                        <tr>
                          <td colSpan={2} className="p-0">
                            <div className="mt-4 rounded-lg border overflow-hidden">
                              <div className="px-3 py-2 bg-slate-50 font-medium">DUE UPON TURNOVER (after {monthsToPay} months)</div>
                              <div className="px-3 py-2 flex items-center justify-between text-sm">
                                <span>Closing Fees <span className="text-xs text-muted-foreground">({closingFeePct}%)</span></span>
                                <b>{fmtPhp(closingFee)}</b>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between text-sm">
                                <span>Turnover Fees (estimate)</span>
                                <b>{fmtPhp(turnoverFees)}</b>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </>
                    )}

                    {/* Standard closing + balance rows (shown for both modes) */}
                    <tr className="border-b">
                      <td className="p-2">Closing Fee <span className="text-xs text-muted-foreground">({closingFeePct}%)</span>:</td>
                      <td className="p-2 text-right">{fmtPhp(closingFee)}</td>
                    </tr>
                    <tr>
                      <td className="px-2 pb-3 text-[11px] text-muted-foreground" colSpan={2}>
                        *Covers Title fees &amp; other government fees • *Payable upon turnover • *Can be included in bank loan
                      </td>
                    </tr>
                    <tr className="border-t bg-gray-50 font-semibold">
                      <td className="p-2">Balance Bank Financing:</td>
                      <td className="p-2 text-right text-blue-900">{fmtPhp(bankBalance)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Bank Financing */}
                <div className="mt-4 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-blue-900">Bank Financing (indicative)</p>
                    <p className="text-[11px] text-muted-foreground">*Subject to bank’s prevailing rate at time of loan</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">20 years @ {rate20yr}%</div>
                      <div className="text-right font-semibold text-blue-900">{fmtPhp(monthly20)}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">15 years @ {rate15yr}%</div>
                      <div className="text-right font-semibold text-blue-900">{fmtPhp(monthly15)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-2">
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
              <button onClick={() => setIsAdjustOpen(false)} className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50">Done</button>
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
