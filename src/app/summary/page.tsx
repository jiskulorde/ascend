"use client";

import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Range } from "react-range";
import Link from "next/link";

type UnitRow = {
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
type FloorBand = "low" | "high";

/** ---------- helpers ---------- */
const parseNumber = (raw: string) =>
  parseFloat((raw || "").toString().replace(/[^\d.-]/g, "")) || 0;

const getFloorNum = (floor: string) => {
  const digits = (floor || "").match(/\d+/g)?.join("") ?? "";
  return digits ? parseInt(digits, 10) : 0;
};

const toFloorBand = (floorNum: number): FloorBand =>
  floorNum <= 12 ? "low" : "high";

const currencyPH = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

// 🔑 Shared stable unitId generator (same as in [unitID]/page.tsx)
const makeUnitId = (p: UnitRow) =>
  `${p.Property}_${p.Tower}_${p.Floor}_${p.BuildingUnit}`.replace(/\s+/g, "_");

/** ---------- component ---------- */
export default function SummaryPage() {
  const [units, setUnits] = useState<UnitRow[]>([]);

  // filters
  const [propertyFilter, setPropertyFilter] = useState<Option[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<Option[] | null>(null);
  const [towerFilter, setTowerFilter] = useState<Option[] | null>(null);
  const [amenitiesFilter, setAmenitiesFilter] = useState<Option[] | null>(null);
  const [floorFilter, setFloorFilter] = useState<FloorBand | null>(null);
  const [sizeRange, setSizeRange] = useState<[number, number]>([30, 150]);

  useEffect(() => {
    const fetchUnits = async () => {
      const res = await fetch("/api/availability");
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        const normalized: UnitRow[] = json.data.map((p: any) => ({
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
          ListPrice: parseNumber(p["List Price"]),
          PerSQM: parseNumber(p["per SQM"]),
        }));
        setUnits(normalized);
      }
    };
    fetchUnits();
  }, []);

  /** options */
  const propertyOptions: Option[] = useMemo(
    () =>
      Array.from(new Set(units.map((u) => u.Property)))
        .sort()
        .map((v) => ({ value: v, label: v })),
    [units]
  );
  const typeOptions: Option[] = useMemo(
    () =>
      Array.from(new Set(units.map((u) => u.Type)))
        .sort()
        .map((v) => ({ value: v, label: v })),
    [units]
  );
  const towerOptions: Option[] = useMemo(
    () =>
      Array.from(new Set(units.map((u) => u.Tower)))
        .sort()
        .map((v) => ({ value: v, label: v })),
    [units]
  );
  const amenitiesOptions: Option[] = useMemo(
    () =>
      Array.from(
        new Set(
          units.flatMap((u) =>
            (u.Amenities || "")
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          )
        )
      )
        .sort()
        .map((v) => ({ value: v, label: v })),
    [units]
  );

  /** filtered rows (pre-group) */
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (propertyFilter?.length && !propertyFilter.some((f) => f.value === u.Property)) return false;
      if (typeFilter?.length && !typeFilter.some((f) => f.value === u.Type)) return false;
      if (towerFilter?.length && !towerFilter.some((f) => f.value === u.Tower)) return false;

      if (amenitiesFilter?.length) {
        const amenStr = (u.Amenities || "").toLowerCase();
        if (!amenitiesFilter.some((f) => amenStr.includes(f.value.toLowerCase()))) return false;
      }

      if (floorFilter) {
        const floorNum = getFloorNum(u.Floor);
        if (floorFilter === "low" && floorNum > 12) return false;
        if (floorFilter === "high" && floorNum <= 12) return false;
      }

      if (u.GrossAreaSQM < sizeRange[0] || u.GrossAreaSQM > sizeRange[1]) return false;
      return true;
    });
  }, [units, propertyFilter, typeFilter, towerFilter, amenitiesFilter, floorFilter, sizeRange]);

  /** Group by Property, Tower, FloorBand → pick lowest price */
  const groupedLowest = useMemo(() => {
    const map = new Map<string, UnitRow>();
    for (const u of filteredUnits) {
      const band = toFloorBand(getFloorNum(u.Floor));
      const key = `${u.Property}__${u.Tower}__${band}`;
      const current = map.get(key);
      if (!current || u.ListPrice < current.ListPrice) {
        map.set(key, u);
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.Property !== b.Property) return a.Property.localeCompare(b.Property);
      if (a.Tower !== b.Tower) return a.Tower.localeCompare(b.Tower);
      return a.ListPrice - b.ListPrice;
    });
  }, [filteredUnits]);

  /** Best unit per property (for mobile cards) */
  const propertyBest = useMemo(() => {
    const best = new Map<string, UnitRow>();
    for (const u of filteredUnits) {
      const cur = best.get(u.Property);
      if (!cur || u.ListPrice < cur.ListPrice) {
        best.set(u.Property, u);
      }
    }
    return Array.from(best.values()).sort((a, b) => a.Property.localeCompare(b.Property));
  }, [filteredUnits]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Property Summary (Lowest Prices)</h1>

      {/* TABLE — desktop */}
      <div className="hidden md:block">
        <div className="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white">
          <table className="min-w-full text-sm text-slate-900">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-4 py-3 border-b font-semibold">Property</th>
                <th className="px-4 py-3 border-b font-semibold">Tower</th>
                <th className="px-4 py-3 border-b font-semibold">Building Unit</th>
                <th className="px-4 py-3 border-b font-semibold">Floor Band</th>
                <th className="px-4 py-3 border-b font-semibold">Type</th>
                <th className="px-4 py-3 border-b font-semibold">Area (sqm)</th>
                <th className="px-4 py-3 border-b font-semibold">Lowest Price</th>
                <th className="px-4 py-3 border-b font-semibold">Status</th>
                <th className="px-4 py-3 border-b font-semibold">Compute</th>
              </tr>
            </thead>
            <tbody>
              {groupedLowest.map((u, i) => {
                const band = toFloorBand(getFloorNum(u.Floor));
                return (
                  <tr key={`${u.Property}-${u.Tower}-${band}-${i}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 border-b">{u.Property}</td>
                    <td className="px-4 py-3 border-b">{u.Tower}</td>
                    <td className="px-4 py-3 border-b">{u.BuildingUnit}</td>
                    <td className="px-4 py-3 border-b">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${
                          band === "low"
                            ? "text-slate-800 ring-slate-300"
                            : "text-blue-800 ring-blue-200"
                        }`}
                      >
                        {band === "low" ? "Low (≤12)" : "High (>12)"}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b">{u.Type}</td>
                    <td className="px-4 py-3 border-b">{u.GrossAreaSQM}</td>
                    <td className="px-4 py-3 border-b font-semibold text-blue-900">
                      {currencyPH(u.ListPrice)}
                    </td>
                    <td className="px-4 py-3 border-b">{u.Status}</td>
                    <td className="px-4 py-3 border-b">
                      <Link href={`/computation/${makeUnitId(u)}`}>
                        <button className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700">
                          Compute
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {groupedLowest.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-600">
                    No matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CARDS — mobile */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {propertyBest.map((u) => (
          <div
            key={`${u.Property}-card`}
            className="bg-white rounded-2xl shadow ring-1 ring-slate-200 p-4"
          >
            <h2 className="text-lg font-bold text-slate-900">{u.Property}</h2>
            <p className="text-sm text-slate-600">
              {u.Tower} • {u.BuildingUnit} • Floor {u.Floor}
            </p>
            <p className="text-blue-900 font-bold mt-2">{currencyPH(u.ListPrice)}</p>
            <p className="text-sm text-slate-700">
              Type: {u.Type} • {u.GrossAreaSQM} sqm
            </p>
            <div className="mt-3">
              <Link href={`/computation/${makeUnitId(u)}`}>
                <button className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700">
                  Compute
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
