"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Select from "react-select";
import { makeUnitId, matchesLegacyOrCanonical } from "@/lib/unit-id";

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

const parseMoney = (raw: any) =>
  parseFloat(String(raw ?? "0").replace(/[^0-9.-]+/g, "")) || 0;

export default function ComputationPage() {
  const router = useRouter();
  const params = useParams();
  const unitIdFromUrl = decodeURIComponent((params?.unitID as string) || "");

  const [rows, setRows] = useState<UnitRow[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(unitIdFromUrl);

  // Inputs
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [downPct, setDownPct] = useState<number>(20);
  const [monthsToPay, setMonthsToPay] = useState<number>(36);
  const [reservationFee, setReservationFee] = useState<number>(20000);
  const [closingFeePct, setClosingFeePct] = useState<number>(10.5);
  const [rate15yr, setRate15yr] = useState<number>(6);
  const [rate20yr, setRate20yr] = useState<number>(6);

  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Load enriched availability
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/availability", { cache: "no-store" });
      const json = await res.json();
      const data: UnitRow[] = Array.isArray(json.data) ? json.data : [];
      setRows(data);
    })();
  }, []);

  // Selected unit (support canonical + legacy)
  const selectedUnit = useMemo(() => {
    return rows.find((u) =>
      matchesLegacyOrCanonical(
        { property_code: u.property_code, tower_code: u.tower_code, building_unit: u.BuildingUnit },
        selectedUnitId
      )
    );
  }, [rows, selectedUnitId]);

  // If URL contains a valid id, sync it
  useEffect(() => {
    if (!rows.length || !unitIdFromUrl) return;
    const exists = rows.some((u) =>
      matchesLegacyOrCanonical(
        { property_code: u.property_code, tower_code: u.tower_code, building_unit: u.BuildingUnit },
        unitIdFromUrl
      )
    );
    if (exists) setSelectedUnitId(unitIdFromUrl);
  }, [rows, unitIdFromUrl]);

  // Select options
  const unitOptions: Option[] = useMemo(
    () =>
      rows.map((u) => ({
        value: u.unit_id, // canonical id from API
        label: `${u.property_name} • ${u.tower_name || u.tower_code} • ${u.BuildingUnit} • ₱${u.ListPrice.toLocaleString()}`,
      })),
    [rows]
  );

  const selectedOption = useMemo(
    () => unitOptions.find((o) => o.value === selectedUnitId) || null,
    [unitOptions, selectedUnitId]
  );

  // Math
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
    return `VALID UNTIL: ${last.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} (subject to availability)`;
  })();

  const safeFileStem = (s: string) => (s || "computation").replace(/[^\w\-]+/g, "_");

  // Downloads
  const downloadPNG = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    const url = await toPng(sheetRef.current, { cacheBust: true, pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileStem(selectedUnitId)}.png`;
    a.click();
  };
  const downloadPDF = async () => {
    if (!sheetRef.current) return;
    const { toPng } = await import("html-to-image");
    const imgData = await toPng(sheetRef.current, { cacheBust: true, pixelRatio: 2 });
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const img = new Image();
    img.src = imgData;
    await new Promise((r) => (img.onload = r));
    const scale = pageWidth / img.width;
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, img.height * scale);
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

  const adjustmentInputs = [
    { key: "discount", label: "Special Discount %", value: discountPct, step: 0.1, onChange: setDiscountPct },
    { key: "down", label: "Downpayment %", value: downPct, step: 0.1, onChange: setDownPct },
    { key: "months", label: "Months to Pay", value: monthsToPay, step: 1, onChange: (n: number) => setMonthsToPay(Math.max(1, Math.floor(n))) },
    { key: "res", label: "Reservation Fee", value: reservationFee, step: 1000, onChange: (n: number) => setReservationFee(Math.max(0, Math.floor(n))) },
    { key: "closing", label: "Closing Fee %", value: closingFeePct, step: 0.1, onChange: setClosingFeePct },
  ];

  return (
    <main className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-72 p-4 bg-white shadow-xl rounded-2xl sticky top-4 m-4 h-fit">
        <button onClick={() => router.back()} className="w-full mb-4 inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
          ← Back
        </button>

        <h3 className="font-semibold mb-3 text-blue-900 text-sm">Adjustments</h3>
        <div className="space-y-3 text-sm">
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

        <h3 className="font-semibold mt-6 mb-3 text-blue-900 text-sm">Bank Rates</h3>
        <div className="space-y-3 text-sm">
          <label className="block text-xs">
            15 years %
            <input type="number" step={0.1} value={rate15yr} onChange={(e) => setRate15yr(Number(e.target.value || 0))} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full px-2 py-1 border rounded" />
          </label>
          <label className="block text-xs">
            20 years %
            <input type="number" step={0.1} value={rate20yr} onChange={(e) => setRate20yr(Number(e.target.value || 0))} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full px-2 py-1 border rounded" />
          </label>
        </div>
      </aside>

      {/* Main */}
      <section className="flex-1 flex flex-col items-center p-4 overflow-auto">
        {/* Unit picker */}
        <div className="bg-white rounded-xl p-4 shadow-sm border max-w-2xl w-full mb-4">
          <p className="font-semibold mb-2 text-blue-900">Select a unit to compute</p>
          <Select
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
        </div>

        {/* Sheet */}
        {selectedUnit ? (
          <div className="w-full max-w-3xl flex flex-col items-center space-y-4">
            <div ref={sheetRef} className="bg-white rounded-xl shadow-md w-full border overflow-hidden">
              {/* Header */}
              <div className="bg-blue-900 text-white p-6 rounded-t-xl">
                <h1 className="text-2xl font-bold">{selectedUnit.property_name}</h1>
                <p className="opacity-90">{selectedUnit.tower_name || selectedUnit.tower_code}</p>
                <p className="mt-2 text-blue-100">{selectedUnit.address || selectedUnit.city}</p>
                <p className="mt-2 text-blue-100 font-semibold">{validityText}</p>
              </div>

              {/* Info row */}
              <div className="p-4 border-b text-sm grid sm:grid-cols-3 gap-2">
                <div>Turnover date: <span className="font-semibold text-blue-900">{selectedUnit.RFODate}</span></div>
                <div>Unit: <span className="font-semibold text-blue-900">{selectedUnit.BuildingUnit} • {selectedUnit.Type}</span></div>
                <div>Area: <span className="font-semibold text-blue-900">{selectedUnit.GrossAreaSQM} sqm</span></div>
              </div>

              {/* Computation table */}
              <div className="p-4">
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    <tr className="bg-gray-50">
                      <td className="p-2">List Price:</td>
                      <td className="p-2 text-right font-semibold text-blue-900">{fmtPhp(selectedUnit.ListPrice)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Special Discount:</td>
                      <td className="p-2 text-right text-red-600 font-semibold">{discountPct}%</td>
                    </tr>
                    <tr className="bg-gray-50 font-bold text-blue-900">
                      <td className="p-2">Total Contract Price:</td>
                      <td className="p-2 text-right">{fmtPhp(TCP)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Reservation Fee:</td>
                      <td className="p-2 text-right">{fmtPhp(reservationFee)}</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="p-2">Net Downpayment ({downPct}%):</td>
                      <td className="p-2 text-right">{fmtPhp(dpAmount)}</td>
                    </tr>
                    <tr className="bg-yellow-100 font-bold text-yellow-900">
                      <td className="p-2">Net Downpayment Payable in:</td>
                      <td className="p-2 text-right">{monthsToPay} Mos. ({fmtPhp(dpMonthly)})</td>
                    </tr>
                    <tr>
                      <td className="p-2">Closing Fee ({closingFeePct}%):</td>
                      <td className="p-2 text-right">{fmtPhp(closingFee)}</td>
                    </tr>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="p-2">Balance Bank Financing:</td>
                      <td className="p-2 text-right text-blue-900">{fmtPhp(bankBalance)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Bank Financing */}
                <div className="mt-4 border-t pt-2">
                  <p className="font-semibold text-blue-900">Bank Financing (indicative)</p>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr>
                        <td className="p-2">20 yrs @ {rate20yr}%</td>
                        <td className="p-2 text-right font-semibold text-blue-900">{fmtPhp(monthly20)}</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="p-2">15 yrs @ {rate15yr}%</td>
                        <td className="p-2 text-right font-semibold text-blue-900">{fmtPhp(monthly15)}</td>
                      </tr>
                    </tbody>
                  </table>
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
          <p className="text-gray-600 mt-8">Select a unit to see the computation.</p>
        )}
      </section>
    </main>
  );
}
