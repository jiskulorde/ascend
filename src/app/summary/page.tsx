"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Range } from "react-range";
import { makeUnitId } from "@/lib/unit-id";

/** Matches your enriched /api/availability shape */
type UnitRow = {
  // meta
  property_code: string;
  property_name: string;
  city: string;
  address: string;
  tower_code: string;
  tower_name?: string;

  // original fields
  Property: string;
  BuildingUnit: string;
  Tower: string;
  Floor: string;          // NOTE: sometimes "12" or "AGP-00A-12"
  Status: string;         // e.g. "Avail.", "OnHold"
  Type: string;           // e.g. "1BR"
  GrossAreaSQM: number;
  Amenities: string;      // e.g. "Front", "Rear"
  Facing: string;
  RFODate: string;
  ListPrice: number;
  PerSQM: number;

  unit_id?: string;       // canonical id if API includes it
};

type SummaryItem = {
  property_code: string;
  property_name: string;
  city: string;
  address?: string;
  tower_code: string;
  tower_name?: string;
  type: string;
  minUnit: UnitRow;        // the chosen unit (lowest price meeting the filters)
  minPrice: number;
};

const TYPE_ORDER = ["STUDIO", "1BR", "2BR", "3BR", "4BR", "LOFT"];

/** best effort floor parsing from a variety of formats */
function parseFloorNumber(floor: string): number {
  if (!floor) return 0;
  const n = Number(floor);
  if (Number.isFinite(n)) return n;
  const m = floor.match(/(\d+)(?!.*\d)/);
  if (m) return Number(m[1]);
  return 0;
}

function fmtPhp(n: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PropertySummaryPage() {
  // data
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters / controls
  const [minFloor, setMinFloor] = useState<number>(0);
  const [includeOnHold, setIncludeOnHold] = useState<boolean>(false);
  const [selectedCity, setSelectedCity] = useState<string>("");           // smart
  const [selectedType, setSelectedType] = useState<string>("");           // smart
  const [selectedAmenities, setSelectedAmenities] = useState<string>(""); // smart
  const [sizeRange, setSizeRange] = useState<[number, number]>([0, 0]);   // smart (sqm)
  const [q, setQ] = useState<string>("");                                 // quick search

  // quick compute (global assumptions for sample)
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [downPct, setDownPct] = useState<number>(20);
  const [monthsToPay, setMonthsToPay] = useState<number>(36);
  const [reservationFee, setReservationFee] = useState<number>(20000);
  const [closingFeePct, setClosingFeePct] = useState<number>(10.5);
  const [rate15yr, setRate15yr] = useState<number>(6);
  const [rate20yr, setRate20yr] = useState<number>(6);

  // which card is expanded for inline sample computation
  const [openComputeKey, setOpenComputeKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${origin}/api/availability`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
        }
        const json = await res.json();
        const data: UnitRow[] = Array.isArray(json.data) ? json.data : [];
        setRows(data);
      } catch (e: any) {
        setError(e?.message || "Failed to fetch availability");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- SMART FILTER SOURCE SETS ---------------------------------------------

  /** Applies only the "always-on" filters + other selected filters (except the one we’re building options for). */
  const matchesBase = (r: UnitRow) => {
    const st = r.Status.toLowerCase();
    const statusOk = includeOnHold ? (st.startsWith("avail") || st.includes("hold")) : st.startsWith("avail");
    if (!statusOk) return false;

    if (parseFloorNumber(r.Floor) < minFloor) return false;

    const ql = q.trim().toLowerCase();
    if (
      ql &&
      !r.property_name.toLowerCase().includes(ql) &&
      !(r.tower_name || "").toLowerCase().includes(ql) &&
      !(r.tower_code || "").toLowerCase().includes(ql)
    ) {
      return false;
    }
    return true;
  };

  const availableCities = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (!matchesBase(r)) return false;
      if (selectedType && r.Type !== selectedType) return false;
      if (selectedAmenities && r.Amenities !== selectedAmenities) return false;
      return true;
    });
    return Array.from(new Set(filtered.map((r) => r.city).filter(Boolean))).sort();
  }, [rows, includeOnHold, minFloor, q, selectedType, selectedAmenities]);

  const availableTypes = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (!matchesBase(r)) return false;
      if (selectedCity && r.city !== selectedCity) return false;
      if (selectedAmenities && r.Amenities !== selectedAmenities) return false;
      return true;
    });
    return Array.from(new Set(filtered.map((r) => r.Type).filter(Boolean))).sort(
      (a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b)
    );
  }, [rows, includeOnHold, minFloor, q, selectedCity, selectedAmenities]);

  const availableAmenities = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (!matchesBase(r)) return false;
      if (selectedCity && r.city !== selectedCity) return false;
      if (selectedType && r.Type !== selectedType) return false;
      return true;
    });
    return Array.from(new Set(filtered.map((r) => r.Amenities).filter(Boolean))).sort();
  }, [rows, includeOnHold, minFloor, q, selectedCity, selectedType]);

  // Size bounds depend on the remaining inventory (excluding size itself).
  const sizeBounds = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (!matchesBase(r)) return false;
      if (selectedCity && r.city !== selectedCity) return false;
      if (selectedType && r.Type !== selectedType) return false;
      if (selectedAmenities && r.Amenities !== selectedAmenities) return false;
      return true;
    });
    if (filtered.length === 0) return { min: 0, max: 0 };
    const mins = Math.min(...filtered.map((r) => r.GrossAreaSQM || 0));
    const maxs = Math.max(...filtered.map((r) => r.GrossAreaSQM || 0));
    return { min: Math.floor(mins), max: Math.ceil(maxs) };
  }, [rows, includeOnHold, minFloor, q, selectedCity, selectedType, selectedAmenities]);

  const hasValidSizeBounds = sizeBounds.max > sizeBounds.min;

  // Initialize / clamp sizeRange to the current bounds
  useEffect(() => {
    setSizeRange(([lo, hi]) => {
      if (!hasValidSizeBounds) return [0, 0];
      const nlo = Math.max(sizeBounds.min, Math.min(lo || sizeBounds.min, sizeBounds.max));
      const nhi = Math.max(sizeBounds.min, Math.min(hi || sizeBounds.max, sizeBounds.max));
      if (nlo > nhi) return [sizeBounds.min, sizeBounds.max];
      return [nlo, nhi];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeBounds.min, sizeBounds.max, hasValidSizeBounds]);

  // Auto-clear a selection if it’s no longer valid under other filters
  useEffect(() => {
    if (selectedCity && !availableCities.includes(selectedCity)) setSelectedCity("");
  }, [availableCities, selectedCity]);
  useEffect(() => {
    if (selectedType && !availableTypes.includes(selectedType)) setSelectedType("");
  }, [availableTypes, selectedType]);
  useEffect(() => {
    if (selectedAmenities && !availableAmenities.includes(selectedAmenities)) setSelectedAmenities("");
  }, [availableAmenities, selectedAmenities]);

  // ---- Final candidate set (applies ALL filters including size) -------------
  const candidateRows = useMemo(() => {
    return rows.filter((r) => {
      if (!matchesBase(r)) return false;

      if (selectedCity && r.city !== selectedCity) return false;
      if (selectedType && r.Type !== selectedType) return false;
      if (selectedAmenities && r.Amenities !== selectedAmenities) return false;

      if (hasValidSizeBounds) {
        const sqm = r.GrossAreaSQM || 0;
        if (sqm < sizeRange[0] || sqm > sizeRange[1]) return false;
      }

      return true;
    });
  }, [
    rows,
    includeOnHold,
    minFloor,
    q,
    selectedCity,
    selectedType,
    selectedAmenities,
    sizeRange,
    hasValidSizeBounds,
  ]);

  // group to lowest price per property → tower → type
  const summary: SummaryItem[] = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, SummaryItem>>>();

    for (const u of candidateRows) {
      const p = u.property_code;
      const t = u.tower_code;
      const ty = u.Type;
      if (!p || !t || !ty) continue;

      const existingTowerMap = map.get(p) || new Map();
      map.set(p, existingTowerMap);

      const existingTypeMap = existingTowerMap.get(t) || new Map();
      existingTowerMap.set(t, existingTypeMap);

      const unitId =
        u.unit_id ||
        makeUnitId({
          property_code: u.property_code,
          tower_code: u.tower_code,
          building_unit: u.BuildingUnit,
        });

      const candidate: SummaryItem = {
        property_code: u.property_code,
        property_name: u.property_name,
        city: u.city,
        address: u.address,
        tower_code: u.tower_code,
        tower_name: u.tower_name,
        type: u.Type,
        minUnit: { ...u, unit_id: unitId },
        minPrice: u.ListPrice,
      };

      const prev = existingTypeMap.get(ty);
      if (!prev || candidate.minPrice < prev.minPrice) {
        existingTypeMap.set(ty, candidate);
      }
    }

    const out: SummaryItem[] = [];
    for (const [, tMap] of map.entries()) {
      for (const [, yMap] of tMap.entries()) {
        out.push(
          ...Array.from(yMap.values()).sort(
            (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
          )
        );
      }
    }

    out.sort((a, b) => {
      if (a.property_name !== b.property_name) return a.property_name.localeCompare(b.property_name);
      const at = a.tower_name || a.tower_code;
      const bt = b.tower_name || b.tower_code;
      if (at !== bt) return at.localeCompare(bt);
      return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    });

    return out;
  }, [candidateRows]);

  // group summary items by property for nice UI
  const byProperty = useMemo(() => {
    const m = new Map<
      string,
      { header: { name: string; city: string; address?: string; code: string }; rows: SummaryItem[] }
    >();
    for (const s of summary) {
      const key = s.property_code;
      const g =
        m.get(key) || {
          header: { name: s.property_name, city: s.city, address: s.address, code: s.property_code },
          rows: [],
        };
      g.rows.push(s);
      m.set(key, g);
    }
    for (const g of m.values()) {
      g.rows.sort((a, b) => {
        const at = a.tower_name || a.tower_code;
        const bt = b.tower_name || b.tower_code;
        if (at !== bt) return at.localeCompare(bt);
        return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      });
    }
    return Array.from(m.values()).sort((a, b) => a.header.name.localeCompare(b.header.name));
  }, [summary]);

  // sample computation (uses global assumptions)
  const computeSample = (price: number) => {
    const TCP = price * (1 - discountPct / 100);
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

    return { TCP, dpAmount, netDp, dpMonthly, closingFee, bankBalance, monthly15, monthly20 };
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 space-y-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-semibold">Property Summary (Lowest Prices)</h1>
          <p className="text-sm text-muted-foreground">
            Shows the lowest <b>available</b> price per <b>Property → Tower → Unit Type</b>, filtered to
            high floors (default: {minFloor}F+). Quick sample computation included for each lowest unit.
          </p>
        </header>

        {/* Controls */}
        <div className="card p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <label className="block text-xs">
              Search project/tower
              <input
                className="input mt-1"
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Allegra, Amina, Soraya…"
              />
            </label>

            {/* SMART: City */}
            <label className="block text-xs">
              City
              <select
                className="input mt-1"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <option value="">All</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {/* SMART: Unit Type */}
            <label className="block text-xs">
              Unit Type
              <select
                className="input mt-1"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">All</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            {/* SMART: Amenities */}
            <label className="block text-xs">
              Amenities
              <select
                className="input mt-1"
                value={selectedAmenities}
                onChange={(e) => setSelectedAmenities(e.target.value)}
              >
                <option value="">All</option>
                {availableAmenities.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            {/* SMART: Size range */}
            <label className="block text-xs md:col-span-2">
              Size (sqm): {hasValidSizeBounds ? `${sizeRange[0]} – ${sizeRange[1]}` : "—"}
              <div className="mt-2">
                {hasValidSizeBounds ? (
                  <Range
                    step={1}
                    min={sizeBounds.min}
                    max={sizeBounds.max}
                    values={[
                      Math.max(sizeBounds.min, Math.min(sizeRange[0], sizeBounds.max)),
                      Math.max(sizeBounds.min, Math.min(sizeRange[1], sizeBounds.max)),
                    ]}
                    onChange={(vals) => {
                      const lo = Math.max(sizeBounds.min, Math.min(vals[0], vals[1]));
                      const hi = Math.min(sizeBounds.max, Math.max(vals[0], vals[1]));
                      setSizeRange([lo, hi]);
                    }}
                    renderTrack={({ props, children }) => {
                      const { key, ...rest } = (props as any) || {};
                      return (
                        <div key={key} {...rest} className="h-2 rounded-full bg-muted">
                          {children}
                        </div>
                      );
                    }}
                    renderThumb={({ props }) => {
                      const { key, ...rest } = (props as any) || {};
                      return (
                        <div
                          key={key}
                          {...rest}
                          className="h-4 w-4 rounded-full bg-[color:var(--primary)] shadow"
                          aria-label="sqm handle"
                        />
                      );
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-muted opacity-40" />
                    <span className="text-xs text-muted-foreground">
                      Size filter unavailable for current selection
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <input
                    className="input w-24"
                    type="number"
                    value={hasValidSizeBounds ? sizeRange[0] : 0}
                    min={hasValidSizeBounds ? sizeBounds.min : 0}
                    max={hasValidSizeBounds ? sizeRange[1] : 0}
                    disabled={!hasValidSizeBounds}
                    onChange={(e) =>
                      setSizeRange([
                        Math.max(
                          sizeBounds.min,
                          Math.min(Number(e.target.value || 0), hasValidSizeBounds ? sizeRange[1] : sizeBounds.max)
                        ),
                        sizeRange[1],
                      ])
                    }
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <input
                    className="input w-24"
                    type="number"
                    value={hasValidSizeBounds ? sizeRange[1] : 0}
                    min={hasValidSizeBounds ? sizeRange[0] : 0}
                    max={hasValidSizeBounds ? sizeBounds.max : 0}
                    disabled={!hasValidSizeBounds}
                    onChange={(e) =>
                      setSizeRange([
                        sizeRange[0],
                        Math.max(
                          hasValidSizeBounds ? sizeRange[0] : 0,
                          Math.min(Number(e.target.value || 0), sizeBounds.max)
                        ),
                      ])
                    }
                  />
                </div>
              </div>
            </label>

            {/* Min floor + OnHold */}
            <label className="block text-xs md:col-span-2">
              Min Floor
              <div className="flex items-center gap-2 mt-1">
                <input
                  className="flex-1"
                  type="range"
                  min={0}
                  max={50}
                  value={minFloor}
                  onChange={(e) => setMinFloor(Number(e.target.value))}
                />
                <input
                  className="w-16 input"
                  type="number"
                  min={0}
                  max={50}
                  value={minFloor}
                  onChange={(e) =>
                    setMinFloor(Math.max(0, Math.min(50, Number(e.target.value || 0))))
                  }
                />
              </div>
            </label>

            <label className="block text-xs">
              <span className="invisible">toggle</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeOnHold}
                  onChange={(e) => setIncludeOnHold(e.target.checked)}
                />
                Include “On Hold”
              </div>
            </label>
          </div>

          {/* Quick assumptions row (collapsible feel on mobile via grid) */}
          <div className="mt-4 border-t pt-3">
            <div className="text-sm font-medium mb-2">Quick sample computation assumptions</div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
              <label className="block text-xs">
                Discount %
                <input
                  className="input mt-1"
                  type="number"
                  step={0.1}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value || 0))}
                />
              </label>
              <label className="block text-xs">
                DP %
                <input
                  className="input mt-1"
                  type="number"
                  step={0.1}
                  value={downPct}
                  onChange={(e) => setDownPct(Number(e.target.value || 0))}
                />
              </label>
              <label className="block text-xs">
                Months
                <input
                  className="input mt-1"
                  type="number"
                  step={1}
                  value={monthsToPay}
                  onChange={(e) =>
                    setMonthsToPay(Math.max(1, Math.floor(Number(e.target.value || 0))))
                  }
                />
              </label>
              <label className="block text-xs">
                Reservation
                <input
                  className="input mt-1"
                  type="number"
                  step={1000}
                  value={reservationFee}
                  onChange={(e) =>
                    setReservationFee(Math.max(0, Math.floor(Number(e.target.value || 0))))
                  }
                />
              </label>
              <label className="block text-xs">
                Closing %
                <input
                  className="input mt-1"
                  type="number"
                  step={0.1}
                  value={closingFeePct}
                  onChange={(e) => setClosingFeePct(Number(e.target.value || 0))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs">
                  15 yrs %
                  <input
                    className="input mt-1"
                    type="number"
                    step={0.1}
                    value={rate15yr}
                    onChange={(e) => setRate15yr(Number(e.target.value || 0))}
                  />
                </label>
                <label className="block text-xs">
                  20 yrs %
                  <input
                    className="input mt-1"
                    type="number"
                    step={0.1}
                    value={rate20yr}
                    onChange={(e) => setRate20yr(Number(e.target.value || 0))}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading && <div className="card p-8">Loading…</div>}
        {error && <div className="card p-8 text-red-600">{error}</div>}

        {!loading && !error && byProperty.length === 0 && (
          <div className="card p-8 text-muted-foreground">
            No results match your filters. Try adjusting the size range, lowering the minimum floor, or clearing filters.
          </div>
        )}

        {!loading && !error && byProperty.length > 0 && (
          <div className="space-y-6">
            {byProperty.map((group) => {
              // tower -> items
              const towers = new Map<string, SummaryItem[]>();
              for (const r of group.rows) {
                const key = r.tower_name || r.tower_code;
                const arr = towers.get(key) || [];
                arr.push(r);
                towers.set(key, arr);
              }
              const towerEntries = Array.from(towers.entries()).sort((a, b) =>
                a[0].localeCompare(b[0])
              );

              return (
                <section key={group.header.code} className="card p-0 overflow-hidden">
                  <div className="bg-[#0f172a] text-white px-4 py-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                      <div>
                        <div className="text-lg font-semibold">{group.header.name}</div>
                        <div className="text-xs opacity-90">
                          {group.header.city}
                          {group.header.address ? ` • ${group.header.address}` : ""}
                        </div>
                      </div>
                      <div className="text-xs opacity-90">
                        Showing lowest prices per tower &amp; type (≥ {minFloor}F)
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {towerEntries.map(([towerName, items]) => (
                        <div key={towerName} className="rounded-xl border bg-white">
                          <div className="px-4 py-3 border-b bg-slate-50 rounded-t-xl font-medium">
                            {towerName}
                          </div>

                          <div className="divide-y">
                            {items.map((s) => {
                              const k = `${s.property_code}__${s.tower_code}__${s.type}`;
                              const isOpen = openComputeKey === k;
                              const u = s.minUnit;
                              const id =
                                u.unit_id ||
                                makeUnitId({
                                  property_code: u.property_code,
                                  tower_code: u.tower_code,
                                  building_unit: u.BuildingUnit,
                                });
                              const c = computeSample(s.minPrice);

                              return (
                                <div key={k} className="px-4 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm text-muted-foreground">{s.type}</div>
                                      <div className="text-lg font-semibold">{fmtPhp(s.minPrice)}</div>
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {u.BuildingUnit} • {u.GrossAreaSQM} sqm • RFO{" "}
                                        {u.RFODate || "TBA"}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      <Link
                                        className="btn btn-outline btn-sm"
                                        href={`/computation/${encodeURIComponent(id)}`}
                                      >
                                        Full computation
                                      </Link>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setOpenComputeKey(isOpen ? null : k)}
                                      >
                                        {isOpen ? "Hide sample" : "Quick sample"}
                                      </button>
                                    </div>
                                  </div>

                                  {isOpen && (
                                    <div className="mt-3 rounded-lg border p-3 text-sm bg-slate-50">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <div className="text-xs text-muted-foreground">
                                            TCP (disc {discountPct}%)
                                          </div>
                                          <div className="font-semibold">{fmtPhp(c.TCP)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">
                                            DP {downPct}%
                                          </div>
                                          <div className="font-semibold">{fmtPhp(c.dpAmount)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">
                                            Reservation
                                          </div>
                                          <div className="font-semibold">
                                            {fmtPhp(reservationFee)}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">
                                            Net DP / {monthsToPay} mos
                                          </div>
                                          <div className="font-semibold">{fmtPhp(c.dpMonthly)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">
                                            Closing Fee {closingFeePct}%
                                          </div>
                                          <div className="font-semibold">
                                            {fmtPhp(c.closingFee)}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">Balance</div>
                                          <div className="font-semibold">
                                            {fmtPhp(c.bankBalance)}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">
                                            15 yrs @ {rate15yr}%
                                          </div>
                                          <div className="font-semibold">
                                            {fmtPhp(c.monthly15)}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">
                                            20 yrs @ {rate20yr}%
                                          </div>
                                          <div className="font-semibold">
                                            {fmtPhp(c.monthly20)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
