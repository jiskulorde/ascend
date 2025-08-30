"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  `${p.Property.trim()}-${p.BuildingUnit.trim()}`;

export default function ComputationSelection() {
  const router = useRouter();
  const [rows, setRows] = useState<PropertyRow[]>([]);

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
            parseFloat((p["List Price"] || "0").replace(/[^0-9.-]+/g, "")) || 0,
          PerSQM:
            parseFloat((p["per SQM"] || "0").replace(/[^0-9.-]+/g, "")) || 0,
        }))
      );
    }
    fetchData();
  }, []);

  const unitOptions: Option[] = rows.map((p) => {
    const id = makeUnitId(p);
    return {
      value: id,
      label: `${p.Property} • ${p.BuildingUnit} • ₱${p.ListPrice.toLocaleString()}`,
    };
  });

  return (
    <main className="min-h-screen flex justify-center items-center p-4 bg-gray-50">
      <div className="bg-white rounded-xl p-6 shadow-md w-full max-w-lg">
        <h2 className="text-blue-900 font-semibold mb-4 text-lg">
          Select a Unit to Compute
        </h2>
        <Select
          options={unitOptions}
          placeholder="Search unit…"
          onChange={(opt) => {
            const id = (opt as Option)?.value;
            if (id) router.push(`/computation/${encodeURIComponent(id)}`);
          }}
        />
      </div>
    </main>
  );
}
