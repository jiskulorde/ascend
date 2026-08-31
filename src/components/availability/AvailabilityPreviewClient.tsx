// src/components/availability/AvailabilityPreviewClient.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, TrendingDown, Scale, Calculator } from "lucide-react";
import SignInPromptDialog from "@/components/availability/SignInPromptDialog";

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

const FEATURES: { title: string; desc: string; icon: typeof Building2 }[] = [
  { title: "Full Inventory", desc: "Every available unit, not just a preview.", icon: Building2 },
  { title: "Lowest Price Summary", desc: "Instantly find the lowest-priced options.", icon: TrendingDown },
  { title: "Compare Units", desc: "Line up units side-by-side.", icon: Scale },
  { title: "Payment Computation", desc: "Downpayment, financing, and RTO math.", icon: Calculator },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2";

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
// authenticated seller/buyer experience): no Save to Shortlist, no Compare,
// no advanced filters, and only the 1–3 pages / 12-per-page the server
// allows (see src/app/api/availability/preview/route.ts, which enforces
// this server-side regardless of anything sent from here).
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

  const [promptOpen, setPromptOpen] = useState(false);

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
  const previewCap = 36;
  const hasMoreBeyondCap = totalMatching > previewCap;

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-6">
        {/* ---------------- Hero ---------------- */}
        <section className="card p-6 md:p-8 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--primary)]">
              Public preview
            </p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">
              Available Homes Preview
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Explore selected available DMCI Homes units. Sign in to unlock the full inventory,
              advanced filters, lowest-price Summary, Compare, and payment computations.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={signInHref} className={`btn btn-primary w-full sm:w-auto ${focusRing}`}>
              Sign In
            </Link>
            <Link href={signInHref} className={`btn btn-outline w-full sm:w-auto ${focusRing}`}>
              Create Account
            </Link>
          </div>
        </section>

        {/* ---------------- Filters ---------------- */}
        <section className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Filter available units</h2>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Project</span>
              <select
                className={`h-10 w-full rounded-lg border border-input bg-background px-2 text-sm ${focusRing}`}
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
                className={`h-10 w-full rounded-lg border border-input bg-background px-2 text-sm ${focusRing}`}
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
                className={`h-10 w-full rounded-lg border border-input bg-background px-2 text-sm ${focusRing}`}
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
        </section>

        {/* ---------------- Results header / preview-limit messaging ---------------- */}
        <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {totalMatching > 0
              ? `Showing ${rows.length} of ${totalMatching.toLocaleString()} available unit${
                  totalMatching === 1 ? "" : "s"
                } matching your filters.`
              : "Browse a sample of current availability."}
          </p>
          <p className="text-xs text-muted-foreground">
            Showing a limited inventory preview — up to {previewCap} units.
          </p>
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

        {/* ---------------- Inventory cards ---------------- */}
        {!loading && rows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((u, i) => (
              <div key={i} className="card overflow-hidden flex flex-col">
                <div className="bg-[#0f172a] text-white px-4 py-3">
                  <div className="font-semibold truncate">{u.property_name}</div>
                  <div className="text-xs opacity-90 truncate">
                    {u.tower_name ? `${u.tower_name} • ` : ""}
                    {u.city}
                  </div>
                </div>

                <div className="p-4 text-sm flex-1 flex flex-col gap-3">
                  <div>
                    <div className="text-xl font-bold ph-currency">{fmtPhp(u.ListPrice)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {u.Type || "—"}
                      {u.GrossAreaSQM ? ` • ${u.GrossAreaSQM} sqm` : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {u.Facing && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {u.Facing} facing
                      </span>
                    )}
                    {u.RFODate && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        RFO {u.RFODate}
                      </span>
                    )}
                    {u.Amenities && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {u.Amenities}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setPromptOpen(true)}
                      className={`btn btn-primary btn-block text-xs ${focusRing}`}
                    >
                      Calculate Payment
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------------- Pagination ---------------- */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-2">
              <button
                className={`btn btn-outline btn-sm ${focusRing}`}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="px-2 text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <button
                  className={`btn btn-outline btn-sm ${focusRing}`}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              )}
            </div>

            {page >= totalPages && hasMoreBeyondCap && (
              <div className="w-full max-w-sm rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
                <p className="text-sm font-medium text-slate-800">Want to see more?</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Sign in to browse the full inventory.
                </p>
                <Link href={signInHref} className={`btn btn-primary btn-sm mt-3 ${focusRing}`}>
                  Sign In
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ---------------- Feature value ---------------- */}
        <section className="card p-5 md:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            What signing in unlocks
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {FEATURES.map(({ title, desc, icon: Icon }) => (
              <div key={title} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <Icon size={18} className="text-[color:var(--primary)]" aria-hidden="true" />
                <div className="mt-2 text-sm font-semibold text-slate-800">{title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <SignInPromptDialog open={promptOpen} onOpenChange={setPromptOpen} next="/availability" />
    </main>
  );
}
