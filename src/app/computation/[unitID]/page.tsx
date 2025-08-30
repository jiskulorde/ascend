"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Select from "react-select";

type PropertyRow = {
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
};

type Option = { value: string; label: string };

const makeUnitId = (p: PropertyRow) =>
  `${p.Property}_${p.Tower}_${p.Floor}_${p.BuildingUnit}`.replace(/\s+/g, "_");

export default function ComputationPage() {
  const router = useRouter();
  const params = useParams<{ unitID: string }>();
  const unitIdFromUrl = decodeURIComponent(params.unitID || "");

  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(unitIdFromUrl);

  const [discountPct, setDiscountPct] = useState<number>(0);
  const [downPct, setDownPct] = useState<number>(20);
  const [monthsToPay, setMonthsToPay] = useState<number>(36);
  const [reservationFee, setReservationFee] = useState<number>(20000);
  const [closingFeePct, setClosingFeePct] = useState<number>(10.5);

  const [rate15yr, setRate15yr] = useState<number>(6);
  const [rate20yr, setRate20yr] = useState<number>(6);

  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/availability");
      const json = await res.json();
      const data = Array.isArray(json.data) ? json.data : [];
      setRows(
        data.map((p: any) => ({
          Property: p.Property || "",
          BuildingUnit: p["Building Unit"] || "",
          Tower: p.Tower || "",
          Floor: p.Floor || "",
          Status: p.Status || "",
          Type: p.Type || "",
          GrossAreaSQM: Number(p["Gross Area(SQM)"] || 0),
          Amenities: p.Amenities || "",
          Facing: p.Facing || "",
          RFODate: p["RFO Date"] || "",
          ListPrice:
            parseFloat((p["List Price"] || "0").replace(/[^0-9.-]+/g, "")) ||
            0,
          PerSQM:
            parseFloat((p["per SQM"] || "0").replace(/[^0-9.-]+/g, "")) || 0,
        }))
      );
    }
    fetchData();
  }, []);

  const selectedUnit = useMemo(
    () => rows.find((p) => makeUnitId(p) === selectedUnitId),
    [rows, selectedUnitId]
  );

  // Keep selectedUnitId synced with URL when rows load
  useEffect(() => {
    if (rows.length > 0 && unitIdFromUrl) {
      const exists = rows.some((p) => makeUnitId(p) === unitIdFromUrl);
      if (exists) {
        setSelectedUnitId(unitIdFromUrl);
      }
    }
  }, [rows, unitIdFromUrl]);

  const unitOptions: Option[] = useMemo(
    () =>
      rows.map((p) => {
        const id = makeUnitId(p);
        return {
          value: id,
          label: `${p.Property} • ${p.BuildingUnit} • ₱${p.ListPrice.toLocaleString()}`,
        };
      }),
    [rows]
  );

  const selectedOption = useMemo(
    () => unitOptions.find((opt) => opt.value === selectedUnitId) || null,
    [unitOptions, selectedUnitId]
  );

  const fmtPhp = (n: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(n);

  const TCP = (selectedUnit?.ListPrice || 0) * (1 - discountPct / 100);
  const dpAmount = (TCP * downPct) / 100;
  const netDp = Math.max(0, dpAmount - reservationFee);
  const dpMonthly = monthsToPay > 0 ? netDp / monthsToPay : 0;
  const closingFee = (TCP * closingFeePct) / 100;
  const bankBalance = Math.max(0, TCP - dpAmount);

  const amort = (principal: number, annual: number, years: number) => {
    const r = annual / 100 / 12;
    const n = years * 12;
    return r === 0
      ? principal / n
      : principal * (r / (1 - Math.pow(1 + r, -n)));
  };
  const monthly15 = amort(bankBalance, rate15yr, 15);
  const monthly20 = amort(bankBalance, rate20yr, 20);

  const validityText = (() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `VALID UNTIL: ${last.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })} (subject to unit availability)`;
  })();

  const getSafeFileStem = (stem: string) =>
    (stem || "computation").replace(/[^\w\-]+/g, "_");

  const downloadPNG = async () => {
    if (!sheetRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(sheetRef.current, { scale: 2 });
    const link = document.createElement("a");
    link.download = `${getSafeFileStem(selectedUnitId)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadPDF = async () => {
    if (!sheetRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const canvas = await html2canvas(sheetRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgProps = (pdf as any).getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${getSafeFileStem(selectedUnitId)}.pdf`);
  };

  const downloadExcel = async () => {
    const XLSX = await import("xlsx");
    const data = [
      ["Project", selectedUnit?.Property || ""],
      ["Unit", selectedUnit?.BuildingUnit || ""],
      ["Type", selectedUnit?.Type || ""],
      ["Floor", selectedUnit?.Floor || ""],
      ["Area (SQM)", selectedUnit?.GrossAreaSQM || 0],
      ["Facing", selectedUnit?.Facing || ""],
      ["RFO Date", selectedUnit?.RFODate || ""],
      [],
      ["List Price", selectedUnit?.ListPrice || 0],
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
    XLSX.writeFile(wb, `${getSafeFileStem(selectedUnitId)}.xlsx`);
  };

  const adjustmentInputs: {
    key: string;
    label: string;
    value: number;
    onChange: (n: number) => void;
    step?: number;
  }[] = [
    {
      key: "discount",
      label: "Special Discount %",
      value: discountPct,
      onChange: setDiscountPct,
      step: 0.1,
    },
    {
      key: "down",
      label: "Downpayment %",
      value: downPct,
      onChange: setDownPct,
      step: 0.1,
    },
    {
      key: "months",
      label: "Months to Pay",
      value: monthsToPay,
      onChange: (n) => setMonthsToPay(Math.max(1, Math.floor(n))),
    },
    {
      key: "resfee",
      label: "Reservation Fee",
      value: reservationFee,
      onChange: (n) => setReservationFee(Math.max(0, Math.floor(n))),
    },
    {
      key: "closing",
      label: "Closing Fee %",
      value: closingFeePct,
      onChange: setClosingFeePct,
      step: 0.1,
    },
  ];

  return (
    <main className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-72 p-4 bg-white shadow-xl rounded-2xl sticky top-4 m-4 h-fit">
        <h3 className="font-semibold mb-3 text-blue-900 text-sm">Adjustments</h3>
        <div className="space-y-3 text-sm">
          {adjustmentInputs.map(({ key, label, value, onChange, step }) => (
            <label key={key} className="block text-xs">
              {label}
              <input
                type="number"
                step={step ?? 1}
                value={Number.isFinite(value) ? value : 0}
                onChange={(e) => onChange(Number(e.target.value || 0))}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1 w-full px-2 py-1 border rounded"
              />
            </label>
          ))}
        </div>
        <h3 className="font-semibold mt-6 mb-3 text-blue-900 text-sm">
          Bank Rates
        </h3>
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
      </aside>

      {/* Main content */}
      <section className="flex-1 flex flex-col items-center p-4 overflow-auto">
        {/* Always show search */}
        <div className="bg-white rounded-xl p-4 shadow-sm border max-w-lg w-full mb-4">
          <p className="font-semibold mb-2 text-blue-900">
            Select a unit to compute
          </p>
          <Select
            options={unitOptions}
            value={selectedOption}
            onChange={(opt) => {
              const id = (opt as Option)?.value;
              if (id) {
                setSelectedUnitId(id);
                router.replace(`/computation/${encodeURIComponent(id)}`);
              }
            }}
            placeholder="Search unit…"
          />
        </div>

        {selectedUnit && (
          <div className="w-full max-w-3xl flex flex-col items-center space-y-4">
            <div
              ref={sheetRef}
              className="bg-white rounded-xl shadow-md w-full border overflow-hidden"
            >
              {/* Header */}
              <div className="bg-blue-900 text-white p-6 rounded-t-xl">
                <h1 className="text-2xl font-bold">{selectedUnit.Property}</h1>
                <p>{selectedUnit.Tower}</p>
                <p className="mt-2 text-red-300 font-semibold">{validityText}</p>
              </div>

              {/* Info Table */}
              <div className="p-4 border-b text-sm grid sm:grid-cols-3 gap-2">
                <div>
                  Turnover date:{" "}
                  <span className="font-semibold text-blue-900">
                    {selectedUnit.RFODate}
                  </span>
                </div>
                <div>
                  Building | Unit type:{" "}
                  <span className="font-semibold text-blue-900">
                    {selectedUnit.BuildingUnit} | {selectedUnit.Type}
                  </span>
                </div>
                <div>
                  Total area:{" "}
                  <span className="font-semibold text-blue-900">
                    {selectedUnit.GrossAreaSQM}
                  </span>
                </div>
              </div>

              {/* Computation Table */}
              <div className="p-4">
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    <tr className="bg-gray-50">
                      <td className="p-2">List Price:</td>
                      <td className="p-2 text-right font-semibold text-blue-900">
                        {fmtPhp(selectedUnit.ListPrice)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2">Special Discount:</td>
                      <td className="p-2 text-right text-red-600 font-semibold">
                        {discountPct}%
                      </td>
                    </tr>
                    <tr className="bg-gray-50 font-bold text-blue-900">
                      <td className="p-2">Total Contract Price:</td>
                      <td className="p-2 text-right">{fmtPhp(TCP)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">Reservation Fee:</td>
                      <td className="p-2 text-right">
                        {fmtPhp(reservationFee)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="p-2">
                        Net Downpayment ({downPct}%):
                      </td>
                      <td className="p-2 text-right">{fmtPhp(dpAmount)}</td>
                    </tr>
                    <tr className="bg-yellow-100 font-bold text-yellow-900">
                      <td className="p-2">Net Downpayment Payable in:</td>
                      <td className="p-2 text-right">
                        {monthsToPay} Mos. ({fmtPhp(dpMonthly)})
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2">
                        Closing Fee ({closingFeePct}%):
                      </td>
                      <td className="p-2 text-right">{fmtPhp(closingFee)}</td>
                    </tr>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="p-2">Balance Bank Financing:</td>
                      <td className="p-2 text-right text-blue-900">
                        {fmtPhp(bankBalance)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Bank Financing */}
                <div className="mt-4 border-t pt-2">
                  <p className="font-semibold text-blue-900">
                    Bank Financing (indicative)
                  </p>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr>
                        <td className="p-2">20 yrs @ {rate20yr}%</td>
                        <td className="p-2 text-right font-semibold text-blue-900">
                          {fmtPhp(monthly20)}
                        </td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="p-2">15 yrs @ {rate15yr}%</td>
                        <td className="p-2 text-right font-semibold text-blue-900">
                          {fmtPhp(monthly15)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={downloadPNG}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Download PNG
              </button>
              <button
                onClick={downloadPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Download PDF
              </button>
              <button
                onClick={downloadExcel}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg"
              >
                Download Excel
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
