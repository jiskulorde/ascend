"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Property = {
  Property: string;
  Tower: string;
  Floor: string;
  Status: string;
  Type: string;
  GrossAreaSQM: number;
  ListPrice: number;
};

export default function ClientPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/availability");
        const json = await res.json();
        const rows = Array.isArray(json.data) ? json.data : [];
        const normalized: Property[] = rows.map((p: any) => ({
          Property: p.Property || "",
          Tower: p.Tower || "",
          Floor: p.Floor || "",
          Status: p.Status || "",
          Type: p.Type || "",
          GrossAreaSQM: Number(p["Gross Area(SQM)"] || 0),
          ListPrice: parseFloat((p["List Price"] || "0").replace(/[^0-9.-]+/g, "")) || 0,
        }));
        setProperties(normalized);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-gray-100 text-gray-900 p-8">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-10">Available Units</h1>

      {loading && <p className="text-center text-gray-500">⏳ Loading...</p>}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((p, i) => (
            <div
              key={i}
              className="bg-white shadow-lg rounded-xl p-4 hover:shadow-2xl transition"
            >
              <div className="mb-2">
                <h2 className="text-xl font-semibold">{p.Property}</h2>
                <p className={`font-medium ${
                  p.Status.toLowerCase() === "available" ? "text-green-500" : "text-red-500"
                }`}>{p.Status}</p>
              </div>
              <p className="text-gray-700">{p.Type} · {p.GrossAreaSQM} sqm</p>
              <p className="text-gray-700">Tower {p.Tower} · Floor {p.Floor}</p>
              <p className="text-gray-800 font-semibold mt-2">₱{p.ListPrice.toLocaleString()}</p>
              <button className="mt-4 w-full py-2 rounded-lg bg-gradient-to-r from-gray-200 to-white text-gray-800 font-semibold shadow hover:from-gray-100 hover:to-gray-50 transition">
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
