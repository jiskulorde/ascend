"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Tabs from "@/components/Tabs";


// ---- Types ----
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

// ---- Helpers ----
const parseNumber = (raw: string) =>
  parseFloat((raw || "").toString().replace(/[^\d.-]/g, "")) || 0;

const getFloorNum = (floor: string) => {
  const digits = (floor || "").match(/\d+/g)?.join("") ?? "";
  return digits ? parseInt(digits, 10) : 0;
};

const currencyPH = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

// ---- Main Component ----
export default function AGPPage() {
  const [units, setUnits] = useState<UnitRow[]>([]);

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

  // Lowest prices for Allegra only
  const lowestByType = useMemo(() => {
    const agpUnits = units.filter((u) => u.Property.toLowerCase().includes("allegra"));
    const map = new Map<string, UnitRow>();
    for (const u of agpUnits) {
      const key = `${u.Type}__${u.Tower}`;
      const current = map.get(key);
      if (!current || u.ListPrice < current.ListPrice) {
        map.set(key, u);
      }
    }
    return Array.from(map.values());
  }, [units]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      {/* Header with logo + banner */}
      <div className="max-w-6xl mx-auto text-center mb-12">
        <Image
          src="/images/agp-logo.png"
          alt="AGP Logo"
          width={120}
          height={120}
          className="mx-auto mb-4"
        />
        <h1 className="text-4xl font-bold text-[#0a2540] mb-4">Allegra Garden Place</h1>
        <p className="text-lg text-gray-600 mb-6">
          One-stop hub for floor plans, layouts, visuals, computation, and promos.
        </p>
        <Image
          src="/images/agp-bldg.png"
          alt="AGP Main"
          width={800}
          height={400}
          className="mx-auto rounded-xl shadow"
        />
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto">
        <Tabs
  defaultValue="info"
  tabs={[
    {
      value: "info",
      label: "Info",
      content: (
        <div className="space-y-4 text-gray-700">
          <p><strong>Location:</strong> Pasig Boulevard, Pasig City</p>
          <p><strong>RFO Date:</strong> Tower A – Q4 2024, Tower B – Q3 2025</p>
          <p><strong>Developer:</strong> DMCI Homes</p>
          <Image
            src="/images/agp-map.png"
            alt="AGP Map"
            width={600}
            height={400}
            className="rounded-xl shadow mt-6"
          />
        </div>
      ),
    },
    {
      value: "visuals",
      label: "Visuals",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Image src="/images/agp-site.png" alt="AGP Site" width={600} height={400} className="rounded-xl shadow" />
          <Image src="/images/agp-floorplan.jpg" alt="Floorplan" width={600} height={400} className="rounded-xl shadow" />
          <Image src="/images/agp-unitlayout.jpg" alt="Unit Layout" width={600} height={400} className="rounded-xl shadow" />
        </div>
      ),
    },
    {
      value: "computation",
      label: "Computation",
      content: (
        <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-[#0a2540] text-white">
            <tr>
              <th className="px-4 py-2">Unit Type</th>
              <th className="px-4 py-2">Tower</th>
              <th className="px-4 py-2">Lowest Price</th>
            </tr>
          </thead>
          <tbody>
            {lowestByType.map((u, i) => (
              <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                <td className="px-4 py-2">{u.Type}</td>
                <td className="px-4 py-2">{u.Tower}</td>
                <td className="px-4 py-2">{currencyPH(u.ListPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
    {
      value: "promo",
      label: "Promo",
      content: (
        <div className="text-gray-700">
          <h2 className="text-2xl font-semibold text-[#0a2540] mb-4">Rent-to-Own Promo</h2>
          <p>Enjoy flexible payment terms under our Rent-To-Own promo for select 2BR and 3BR units. Contact us for updated terms.</p>
        </div>
      ),
    },
    {
      value: "downloads",
      label: "Downloads",
      content: (
        <ul className="list-disc list-inside text-gray-700 space-y-2">
          <li><a href="/downloads/agp-brochure.pdf" className="text-[#d4af37] hover:underline">Brochure (PDF)</a></li>
          <li><a href="/downloads/agp-factsheet.pdf" className="text-[#d4af37] hover:underline">Fact Sheet</a></li>
          <li><a href="/downloads/agp-presentation.pptx" className="text-[#d4af37] hover:underline">Presentation Deck</a></li>
        </ul>
      ),
    },
  ]}
/>

      </div>
    </div>
  );
}
