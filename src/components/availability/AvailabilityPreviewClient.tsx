// src/components/availability/AvailabilityPreviewClient.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

type PreviewRow = {
  property_name: string;
  city: string;
  tower_name: string;
  Type: string;
  Floor: string;
  GrossAreaSQM: number;
  Facing: string;
  RFODate: string;
  Status: string;
  ListPrice: number;
  Amenities: string;
};

type PreviewResponse = {
  success: boolean;
  data: PreviewRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  maxPages: number;
  hasMore: boolean;
  totalMatching: number;
  lastUpdated: { date: string; time: string } | null;
  filters: { projects: string[]; cities: string[]; types: string[] };
};

function fmtPhp(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

// Public, read-only preview of current inventory — shown at /availability to
// anonymous visitors. Deliberately simpler than AvailabilityClient (the
// authenticated seller experience): no Save to Shortlist, no Compare, no
// advanced filters, and only the 1–3 pages / 12-per-page the server allows
// (see src/app/api/availability/preview/route.ts, which enforces this
// regardless of anything sent from here).
export default function AvailabilityPreviewClient() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatching, setTotalMatching] = useState(0);
  const [filters, setFilters] = useState<PreviewResponse["filters"]>({
    projects: [],
    cities: [],
    types: [],
  });

  const [project, setProject] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams({ page: String(page) });
        if (project) qs.set("project", project);
        if (city) qs.set("city", city);
        if (type) qs.set("type", type);

        const res = await fetch(`/api/availability/preview?${qs.toString()}`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });

        if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`);

        const json: PreviewResponse = await res.json();
        if (cancelled) return;

        setRows(json.data || []);
        setTotalPages(json.totalPages || 1);
        setTotalMatching(json.totalMatching || 0);
        setFilters(json.filters || { projects: [], cities: [], types: [] });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load availability preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, project, city, type]);

  // Reset to page 1 whenever a filter changes so we never sit on a page
  // number that no longer has any matching rows.
  useEffect(() => {
    setPage(1);
  }, [project, city, type]);

  const signInHref = `/auth/login?next=${encodeURIComponent("/availability")}`;

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-amber-900">
            <Lock size={16} className="mt-0.5 shrink-0" />
            <p className="text-sm">
              You’re viewing a limited public preview — up to 36 available units. Sign in for
              full inventory, computations, comparisons, and client tools.
            </p>
          </div>
          <Link href={signInHref} className="btn btn-primary whitespace-nowrap">
            Sign in
          </Link>
        </div>

        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">Availability Preview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalMatching > 0
                ? `Showing ${rows.length} of ${totalMatching} available unit${
                    totalMatching === 1 ? "" : "s"
                  } matching your filters.`
                : "Browse a sample of current availability."}
            </p>
          </div>
        </header>

        <div className="card p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Project</span>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">All projects</option>
              {filters.projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">City</span>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">All cities</option>
              {filters.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">Unit Type</span>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All types</option>
              {filters.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <div className="card p-6 text-sm text-muted-foreground">Loading…</div>}

        {error && (
          <div className="card p-4 border border-red-200 bg-red-50 text-sm text-red-800">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted-foreground">
            No available units match those filters.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((u, i) => (
              <div key={i} className="card overflow-hidden flex flex-col">
                <div className="bg-[#0f172a] text-white px-4 py-3">
                  <div className="font-semibold truncate">{u.property_name}</div>
                  <div className="text-xs opacity-90 truncate">
                    {u.tower_name} • {u.city}
                  </div>
                </div>
                <div className="p-4 text-sm space-y-2 flex-1 flex flex-col">
                  <div className="text-lg font-bold ph-currency">{fmtPhp(u.ListPrice)}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.Type || "—"} • {u.GrossAreaSQM ? `${u.GrossAreaSQM} sqm` : "—"} • Floor{" "}
                    {u.Floor || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.Facing ? `${u.Facing} facing` : "Facing n/a"}
                    {u.RFODate ? ` • RFO ${u.RFODate}` : ""}
                  </div>
                  <div className="mt-auto pt-2 border-t">
                    <Link
                      href={`/auth/login?next=${encodeURIComponent("/availability")}`}
                      className="btn btn-outline btn-block text-xs"
                    >
                      Sign in to compute & compare
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}

        {totalMatching > 36 && (
          <p className="text-center text-xs text-muted-foreground">
            {totalMatching - 36} more available unit{totalMatching - 36 === 1 ? "" : "s"} —{" "}
            <Link href={`/auth/login?next=${encodeURIComponent("/availability")}`} className="underline">
              sign in to see full inventory
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
