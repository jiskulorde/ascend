"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";

type UnitRow = {
  property_name: string;
  city: string;
  address: string;
  tower_code: string;
  tower_name: string;
  BuildingUnit: string;
  Type: string;
  GrossAreaSQM: number;
  ListPrice: number;
  unit_id: string;
};

type Option = { value: string; label: string };

export default function ComputationHubPage() {
  const router = useRouter();
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/availability", { cache: "no-store" });
        const json = await res.json();
        if (!json?.success) throw new Error("Failed to load availability");
        setRows(json.data || []);
      } catch (e: any) {
        setError(e.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const options: Option[] = useMemo(
    () =>
      rows.map((u) => ({
        value: u.unit_id,
        label: `${u.property_name} • ${u.tower_name || u.tower_code} • ${u.BuildingUnit} • ₱${u.ListPrice.toLocaleString()}`,
      })),
    [rows]
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Computation</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Pick a unit to open its computation sheet.
        </p>

        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <Select
            options={options}
            placeholder="Search unit…"
            onChange={(opt) => {
              const id = (opt as Option)?.value;
              if (id) router.push(`/computation/${encodeURIComponent(id)}`);
            }}
          />
        </div>

        {loading && <div className="card p-6 mt-6">Loading…</div>}
        {error && <div className="card p-6 mt-6 text-red-600">{error}</div>}
      </div>
    </main>
  );
}
