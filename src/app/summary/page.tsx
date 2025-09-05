"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  Amenities: string;
  Facing: string;
  RFODate: string;
  ListPrice: number;
  PerSQM: number;

  unit_id?: string; // canonical id if API includes it
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
  // If pure number like "12"
  const n = Number(floor);
  if (Number.isFinite(n)) return n;

  // Try to get the *last* number in the string e.g. "AGP-00A-12" -> 12
  const m = floor.match(/(\d+)(?!.*\d)/);
  if (m) return Number(m[1]);

  // handle PH, GF etc as 0
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
  const [minFloor, setMinFloor] = useState<number>(12);
  const [includeOnHold, setIncludeOnHold] = useState<boolean>(false);
  const [selectedCity, setSelectedCity] = useState<string>("");      // optional filter
  const [selectedType, setSelectedType] = useState<string>("");      // optional filter
  const [q, setQ] = useState<string>("");                            // quick search by project/tower

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

  const allCities = useMemo(() => {
    return Array.from(new Set(rows.map(r => r.city).filter(Boolean))).sort();
  }, [rows]);

  const allTypes = useMemo(() => {
    return Array.from(new Set(rows.map(r => r.Type).filter(Boolean))).sort(
      (a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b)
    );
  }, [rows]);

  // filter rows for candidates
  const candidateRows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter(r => {
      // status
      const statusOk = includeOnHold
        ? (r.Status.toLowerCase().startsWith("avail") || r.Status.toLowerCase().includes("hold"))
        : r.Status.toLowerCase().startsWith("avail");

      // floor
      const floorNo = parseFloorNumber(r.Floor);
      const floorOk = floorNo >= minFloor;

      // city/type filters (if selected)
      const cityOk = selectedCity ? r.city === selectedCity : true;
      const typeOk = selectedType ? r.Type === selectedType : true;

      // quick search on property/tower
      const qOk = !ql
        || r.property_name.toLowerCase().includes(ql)
        || (r.tower_name || "").toLowerCase().includes(ql)
        || (r.tower_code || "").toLowerCase().includes(ql);

      return statusOk && floorOk && cityOk && typeOk && qOk;
    });
  }, [rows, includeOnHold, minFloor, selectedCity, selectedType, q]);

  // group to lowest price per property → tower → type
  const summary: SummaryItem[] = useMemo(() => {
    // Map: property_code -> tower_code -> type -> min item
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

      const unitId = u.unit_id || makeUnitId({
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

    // flatten to array sorted by property, tower, type order
    const out: SummaryItem[] = [];
    const props = Array.from(map.values());
    for (const [pCode, tMap] of map.entries()) {
      for (const [tCode, yMap] of tMap.entries()) {
        const items = Array.from(yMap.values()).sort(
          (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
        );
        out.push(...items);
      }
    }

    // Sort: Property name asc → Tower code asc → Type order
    out.sort((a, b) => {
      if (a.property_name !== b.property_name) return a.property_name.localeCompare(b.property_name);
      if ((a.tower_name || a.tower_code) !== (b.tower_name || b.tower_code)) {
        return (a.tower_name || a.tower_code).localeCompare(b.tower_name || b.tower_code);
      }
      return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    });

    return out;
  }, [candidateRows]);

  // group summary items by property for nice UI
  const byProperty = useMemo(() => {
    const m = new Map<string, { header: { name: string; city: string; address?: string; code: string }, rows: SummaryItem[] }>();
    for (const s of summary) {
      const key = s.property_code;
      const g = m.get(key) || {
        header: { name: s.property_name, city: s.city, address: s.address, code: s.property_code },
        rows: [],
      };
      g.rows.push(s);
      m.set(key, g);
    }
    // sort rows inside each property by tower → type
    for (const g of m.values()) {
      g.rows.sort((a, b) => {
        const at = a.tower_name || a.tower_code;
        const bt = b.tower_name || b.tower_code;
        if (at !== bt) return at.localeCompare(bt);
        return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      });
    }
    // return ordered by property name
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
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-semibold">Property Summary (Lowest Prices)</h1>
          <p className="text-sm text-muted-foreground">
            Shows the lowest <b>available</b> price per <b>Property → Tower → Unit Type</b>, filtered to
            high floors (default: {minFloor}F+). Quick sample computation included for each lowest unit.
          </p>
        </header>

        {/* Controls */}
        <div className="card p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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

            <label className="block text-xs">
              City
              <select
                className="input mt-1"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <option value="">All</option>
                {allCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label className="block text-xs">
              Unit Type
              <select
                className="input mt-1"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">All</option>
                {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label className="block text-xs">
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
                  onChange={(e) => setMinFloor(Math.max(0, Math.min(50, Number(e.target.value || 0))))}
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
                <input className="input mt-1" type="number" step={0.1} value={discountPct} onChange={(e)=>setDiscountPct(Number(e.target.value || 0))} />
              </label>
              <label className="block text-xs">
                DP %
                <input className="input mt-1" type="number" step={0.1} value={downPct} onChange={(e)=>setDownPct(Number(e.target.value || 0))} />
              </label>
              <label className="block text-xs">
                Months
                <input className="input mt-1" type="number" step={1} value={monthsToPay} onChange={(e)=>setMonthsToPay(Math.max(1, Math.floor(Number(e.target.value || 0))))} />
              </label>
              <label className="block text-xs">
                Reservation
                <input className="input mt-1" type="number" step={1000} value={reservationFee} onChange={(e)=>setReservationFee(Math.max(0, Math.floor(Number(e.target.value || 0))))} />
              </label>
              <label className="block text-xs">
                Closing %
                <input className="input mt-1" type="number" step={0.1} value={closingFeePct} onChange={(e)=>setClosingFeePct(Number(e.target.value || 0))} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs">
                  15 yrs %
                  <input className="input mt-1" type="number" step={0.1} value={rate15yr} onChange={(e)=>setRate15yr(Number(e.target.value || 0))} />
                </label>
                <label className="block text-xs">
                  20 yrs %
                  <input className="input mt-1" type="number" step={0.1} value={rate20yr} onChange={(e)=>setRate20yr(Number(e.target.value || 0))} />
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
            No results match your filters. Try lowering the minimum floor or clearing filters.
          </div>
        )}

        {!loading && !error && byProperty.length > 0 && (
          <div className="space-y-6">
            {byProperty.map(group => {
              // make a map tower -> items for rendering cards
              const towers = new Map<string, SummaryItem[]>();
              for (const r of group.rows) {
                const key = r.tower_name || r.tower_code;
                const arr = towers.get(key) || [];
                arr.push(r);
                towers.set(key, arr);
              }
              const towerEntries = Array.from(towers.entries()).sort((a,b)=>a[0].localeCompare(b[0]));

              return (
                <section key={group.header.code} className="card p-0 overflow-hidden">
                  <div className="bg-[#0f172a] text-white px-4 py-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                      <div>
                        <div className="text-lg font-semibold">{group.header.name}</div>
                        <div className="text-xs opacity-90">
                          {group.header.city}{group.header.address ? ` • ${group.header.address}` : ""}
                        </div>
                      </div>
                      <div className="text-xs opacity-90">Showing lowest prices per tower &amp; type (≥ {minFloor}F)</div>
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
                              const id = u.unit_id || makeUnitId({
                                property_code: u.property_code,
                                tower_code: u.tower_code,
                                building_unit: u.BuildingUnit
                              });
                              const c = computeSample(s.minPrice);

                              return (
                                <div key={k} className="px-4 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm text-muted-foreground">{s.type}</div>
                                      <div className="text-lg font-semibold">{fmtPhp(s.minPrice)}</div>
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        {u.BuildingUnit} • {u.GrossAreaSQM} sqm • RFO {u.RFODate || "TBA"}
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
                                          <div className="text-xs text-muted-foreground">TCP (disc {discountPct}%)</div>
                                          <div className="font-semibold">{fmtPhp(c.TCP)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">DP {downPct}%</div>
                                          <div className="font-semibold">{fmtPhp(c.dpAmount)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">Reservation</div>
                                          <div className="font-semibold">{fmtPhp(reservationFee)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">Net DP / {monthsToPay} mos</div>
                                          <div className="font-semibold">{fmtPhp(c.dpMonthly)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">Closing Fee {closingFeePct}%</div>
                                          <div className="font-semibold">{fmtPhp(c.closingFee)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">Balance</div>
                                          <div className="font-semibold">{fmtPhp(c.bankBalance)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">15 yrs @ {rate15yr}%</div>
                                          <div className="font-semibold">{fmtPhp(c.monthly15)}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-muted-foreground">20 yrs @ {rate20yr}%</div>
                                          <div className="font-semibold">{fmtPhp(c.monthly20)}</div>
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
