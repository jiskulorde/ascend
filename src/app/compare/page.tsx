"use client";

import { useEffect, useState } from "react";
import { getSelectedUnits, saveSelectedUnits } from "@/lib/selectedUnits";

type Unit = {
  id: string;
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

export default function CompareUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    const selected = getSelectedUnits();
    // Fetch all properties from your API
    fetch("/api/availability")
      .then(res => res.json())
      .then(json => {
        const allUnits: Unit[] = json.data.map((p: any) => ({
          id: `${p.Property}-${p["Building Unit"]}`,
          Property: p.Property,
          BuildingUnit: p["Building Unit"],
          Tower: p.Tower,
          Floor: p.Floor,
          Status: p.Status,
          Type: p.Type,
          GrossAreaSQM: Number(p["Gross Area(SQM)"] || 0),
          Amenities: p.Amenities,
          Facing: p.Facing,
          RFODate: p["RFO Date"],
          ListPrice: parseFloat((p["List Price"] || "0").replace(/[^0-9.-]+/g, "")) || 0,
          PerSQM: parseFloat((p["per SQM"] || "0").replace(/[^0-9.-]+/g, "")) || 0,
        }));
        const filtered = allUnits.filter(u => selected.includes(u.id));
        setUnits(filtered);
      });
  }, []);

  const removeUnit = (id: string) => {
    const updated = units.filter(u => u.id !== id);
    setUnits(updated);
    const stored = getSelectedUnits().filter(u => u !== id);
    saveSelectedUnits(stored);
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6 text-blue-900">Compare Units</h1>
      {units.length === 0 ? (
        <p className="text-gray-500">No units selected.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-md bg-white p-4">
          <table className="w-full text-left border-collapse">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="px-4 py-2">Property</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Remove</th>
              </tr>
            </thead>
            <tbody>
              {units.map(u => (
                <tr key={u.id} className="border-b hover:bg-blue-50 transition">
                  <td className="px-4 py-2 font-semibold">{u.Property}</td>
                  <td className="px-4 py-2">{u.BuildingUnit}</td>
                  <td className="px-4 py-2">{u.Type}</td>
                  <td className={`px-4 py-2 font-bold ${u.Status === "Avail." ? "text-green-500" : "text-red-500"}`}>
                    {u.Status}
                  </td>
                  <td className="px-4 py-2">₱{u.ListPrice.toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <button
                      className="px-2 py-1 text-red-600 hover:text-red-800"
                      onClick={() => removeUnit(u.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
