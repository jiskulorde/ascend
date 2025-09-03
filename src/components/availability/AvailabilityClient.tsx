"use client";

import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Range } from "react-range";
import Link from "next/link";

type UnitRow = {
  // meta
  property_code: string;
  property_name: string;
  city: string;
  address: string;
  tower_code: string;
  tower_name: string;

  // original fields
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

  unit_id: string; // canonical from API
};

type Option = { value: string; label: string };

const PAGE_OPTIONS = [12, 24, 36, 48];

export default function AvailabilityClient() {
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<{ date: string; time: string; fileName: string } | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Option[]>([]);
  const [selectedType, setSelectedType] = useState<Option[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<Option[]>([]);
  const [selectedFacing, setSelectedFacing] = useState<Option[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Option[]>([]);
  const [selectedCity, setSelectedCity] = useState<Option[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10_000_000]);

  // Sort + pagination
  const [sortOption, setSortOption] = useState<string>("priceAsc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_OPTIONS[0]);

  // Selected units
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Options
  const STATUS_OPTIONS: Option[] = [
    { value: "Avail.", label: "Available" },
    { value: "OnHold", label: "On Hold" },
  ];
  const TYPE_OPTIONS: Option[] = ["STUDIO", "1BR", "2BR", "3BR", "4BR", "LOFT"].map((t) => ({ value: t, label: t }));
  const AMENITIES_OPTIONS: Option[] = ["Front", "Rear"].map((t) => ({ value: t, label: t }));
  const FACING_OPTIONS: Option[] = ["North", "South", "East", "West", "Northeast", "Northwest", "Southeast", "Southwest"].map((t)=>({value:t,label:t}));

  const [uniqueProperties, setUniqueProperties] = useState<string[]>([]);
  const [uniqueCities, setUniqueCities] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0);

  // Load enriched data
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/availability", { cache: "no-store" });
        const json = await res.json();
        if (!json?.success) throw new Error("Failed to fetch availability");
        const data: UnitRow[] = json.data || [];
        setRows(data);

        const props = Array.from(new Set(data.map((r) => r.property_name))).sort();
        const cities = Array.from(new Set(data.map((r) => r.city).filter(Boolean))).sort();
        setUniqueProperties(props);
        setUniqueCities(cities);

        const max = Math.max(0, ...data.map((r) => r.ListPrice));
        setMaxPrice(max || 10_000_000);
        setPriceRange([0, max || 10_000_000]);

        if (json.latestLog) setLastUpdated(json.latestLog);

        const stored = localStorage.getItem("selectedUnits");
        if (stored) setSelectedUnits(new Set(JSON.parse(stored)));
      } catch (e: any) {
        setError(e.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("selectedUnits", JSON.stringify(Array.from(selectedUnits)));
  }, [selectedUnits]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    const matches = (r: UnitRow) => {
      const matchesSearch =
        !searchTerm ||
        r.property_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.BuildingUnit.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.tower_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.tower_code.toLowerCase().includes(searchTerm.toLowerCase());

      const statusMatch   = selectedStatus.length ? selectedStatus.some(s => s.value === r.Status) : true;
      const typeMatch     = selectedType.length ? selectedType.some(t => t.value === r.Type) : true;
      const amenMatch     = selectedAmenities.length ? selectedAmenities.some(a => a.value === r.Amenities) : true;
      const facingMatch   = selectedFacing.length ? selectedFacing.some(f => f.value === r.Facing) : true;
      const propertyMatch = selectedProperty.length ? selectedProperty.some(pr => pr.label === r.property_name) : true;
      const cityMatch     = selectedCity.length ? selectedCity.some(c => c.label === r.city) : true;
      const priceMatch    = r.ListPrice >= priceRange[0] && r.ListPrice <= priceRange[1];
      const selectedMatch = showOnlySelected ? selectedUnits.has(r.unit_id) : true;

      return matchesSearch && statusMatch && typeMatch && amenMatch && facingMatch && propertyMatch && cityMatch && priceMatch && selectedMatch;
    };
    const arr = rows.filter(matches);
    arr.sort((a, b) => {
      switch (sortOption) {
        case "priceDesc": return b.ListPrice - a.ListPrice;
        case "priceAsc":  return a.ListPrice - b.ListPrice;
        case "sqmDesc":   return b.GrossAreaSQM - a.GrossAreaSQM;
        case "sqmAsc":    return a.GrossAreaSQM - b.GrossAreaSQM;
        case "rfoDesc":   return new Date(b.RFODate).getTime() - new Date(a.RFODate).getTime();
        case "rfoAsc":    return new Date(a.RFODate).getTime() - new Date(b.RFODate).getTime();
        default:          return 0;
      }
    });
    return arr;
  }, [rows, searchTerm, selectedStatus, selectedType, selectedAmenities, selectedFacing, selectedProperty, selectedCity, priceRange, showOnlySelected, sortOption, selectedUnits]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageItems = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const toggleUnit = (unit_id: string) => {
    const next = new Set(selectedUnits);
    next.has(unit_id) ? next.delete(unit_id) : next.add(unit_id);
    setSelectedUnits(next);
  };

  const sortOptions = [
    { value: "priceAsc", label: "Price: Low → High" },
    { value: "priceDesc", label: "Price: High → Low" },
    { value: "sqmAsc", label: "Area: Small → Big" },
    { value: "sqmDesc", label: "Area: Big → Small" },
    { value: "rfoAsc", label: "RFO: Old → New" },
    { value: "rfoDesc", label: "RFO: New → Old" },
  ];

  const selectStyles = {
    control: (p: any) => ({ ...p, borderRadius: 12, borderColor: "var(--color-border)", boxShadow: "none", minHeight: 40 }),
    menu: (p: any) => ({ ...p, borderRadius: 12, overflow: "hidden" }),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto max-w-7xl px-4 md:px-6 pt-6 pb-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Availability</h1>
        <p className="text-sm text-muted-foreground">
          Browse by project, tower and city. Filter inventory and select units to compare or compute.
          {lastUpdated && <> Last updated: <b>{lastUpdated.date}</b> • {lastUpdated.time}</>}
        </p>
      </header>

      <div className="mx-auto max-w-7xl px-4 md:px-6 pb-10 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Filters */}
        <aside className="lg:sticky lg:top-20 h-max">
          <div className="card p-4 space-y-4">
            <input
              type="text"
              placeholder="Search Project / Unit / Tower"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="input"
            />

            <Select
              isMulti
              options={uniqueProperties.map((n) => ({ value: n, label: n }))}
              value={selectedProperty}
              onChange={(v) => { setSelectedProperty(v as Option[]); setCurrentPage(1); }}
              placeholder="Project"
              styles={selectStyles}
            />

            <Select
              isMulti
              options={uniqueCities.map((c) => ({ value: c, label: c }))}
              value={selectedCity}
              onChange={(v) => { setSelectedCity(v as Option[]); setCurrentPage(1); }}
              placeholder="City"
              styles={selectStyles}
            />

            <Select isMulti options={STATUS_OPTIONS} value={selectedStatus} onChange={(v)=>{setSelectedStatus(v as Option[]); setCurrentPage(1);}} placeholder="Status" styles={selectStyles}/>
            <Select isMulti options={TYPE_OPTIONS}   value={selectedType}   onChange={(v)=>{setSelectedType(v as Option[]); setCurrentPage(1);}} placeholder="Type" styles={selectStyles}/>
            <Select isMulti options={AMENITIES_OPTIONS} value={selectedAmenities} onChange={(v)=>{setSelectedAmenities(v as Option[]); setCurrentPage(1);}} placeholder="Amenities" styles={selectStyles}/>
            <Select isMulti options={FACING_OPTIONS} value={selectedFacing} onChange={(v)=>{setSelectedFacing(v as Option[]); setCurrentPage(1);}} placeholder="Facing" styles={selectStyles}/>

            <div className="pt-2">
              <div className="text-sm font-medium mb-2">
                Price: ₱{priceRange[0].toLocaleString()} – ₱{priceRange[1].toLocaleString()}
              </div>
              <Range
                step={50_000}
                min={0}
                max={maxPrice || 10_000_000}
                values={priceRange}
                onChange={(v) => { setPriceRange(v as [number, number]); setCurrentPage(1); }}
                renderTrack={({ props, children }) => <div {...props} className="h-2 rounded-full bg-muted">{children}</div>}
                renderThumb={({ props }) => {
                  const { key, ...rest } = props as any;
                  return <div key={key} {...rest} className="h-4 w-4 rounded-full bg-[color:var(--primary)] shadow" aria-label="Price handle" />;
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select
                options={sortOptions}
                value={sortOptions.find((o) => o.value === sortOption)}
                onChange={(o)=> setSortOption(o?.value || "priceAsc")}
                placeholder="Sort by"
                styles={selectStyles}
              />
              <select
                className="input"
                value={rowsPerPage}
                onChange={(e)=>{ setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                {PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showOnlySelected} onChange={(e)=> setShowOnlySelected(e.target.checked)} />
              Show only selected
            </label>

            <div className="rounded-lg border border-border p-3">
              <div className="text-sm mb-2">
                <b>{selectedUnits.size}</b> unit{selectedUnits.size !== 1 ? "s" : ""} selected
              </div>
              {selectedUnits.size > 1 && (
                <Link href="/compare" className="btn btn-primary btn-block">Compare</Link>
              )}
              {selectedUnits.size === 1 && (() => {
                const id = Array.from(selectedUnits)[0]; // canonical
                return (
                  <Link href={`/computation/${encodeURIComponent(id)}`} className="btn btn-outline btn-block">
                    Computation
                  </Link>
                );
              })()}
            </div>
          </div>
        </aside>

        {/* Results */}
        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>{filtered.length.toLocaleString()} results</div>
            <button
              className="px-2 py-1 rounded-lg hover:bg-muted"
              onClick={() => {
                setSearchTerm("");
                setSelectedStatus([]);
                setSelectedType([]);
                setSelectedAmenities([]);
                setSelectedFacing([]);
                setSelectedProperty([]);
                setSelectedCity([]);
                setPriceRange([0, maxPrice || 10_000_000]);
                setCurrentPage(1);
              }}
            >
              Reset filters
            </button>
          </div>

          {loading && <div className="card p-8">Loading…</div>}
          {error && <div className="card p-8 text-red-600">{error}</div>}

          {!loading && !error && (
            <>
              {pageItems.length === 0 ? (
                <div className="card p-8 text-center text-muted-foreground">No units match your filters.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pageItems.map((r) => {
                    const isSelected = selectedUnits.has(r.unit_id);
                    const statusColor =
                      r.Status.toLowerCase().startsWith("avail") ? "text-emerald-700 bg-emerald-50" :
                      r.Status.toLowerCase().includes("hold") ? "text-amber-700 bg-amber-50" :
                      "text-slate-700 bg-slate-100";

                    return (
                      <div key={r.unit_id} className="card overflow-hidden group">
                        <div className="aspect-[16/10] bg-muted/50 grid place-items-center">
                          <div className="rounded-md border border-border bg-white/70 px-3 py-1 text-xs shadow-sm">
                            {r.property_name} • {r.tower_name || r.tower_code}
                          </div>
                        </div>

                        <div className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm text-muted-foreground">{r.city}</div>
                              <div className="font-medium">
                                {r.BuildingUnit} • {r.Type} • {r.GrossAreaSQM} sqm
                              </div>
                              {r.address && <div className="text-xs text-muted-foreground mt-0.5">{r.address}</div>}
                            </div>
                            <button
                              onClick={() => toggleUnit(r.unit_id)}
                              className={`rounded-full px-3 py-1 text-xs border ${isSelected ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] border-transparent" : "hover:bg-muted"}`}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] ${statusColor}`}>{r.Status}</span>
                            {r.tower_name && <span className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-[11px]">{r.tower_name}</span>}
                            {r.Facing && <span className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-[11px]">Facing {r.Facing}</span>}
                            {r.RFODate && <span className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-[11px]">RFO {r.RFODate}</span>}
                          </div>

                          <div className="pt-1 flex items-end justify-between">
                            <div className="text-lg font-semibold">₱{r.ListPrice.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">₱{r.PerSQM.toLocaleString()} / sqm</div>
                          </div>

                          <div className="pt-2">
                            <Link href={`/computation/${encodeURIComponent(r.unit_id)}`} className="btn btn-ghost btn-sm">
                              Open computation
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-outline px-3 py-1" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                  <button className="btn btn-outline px-3 py-1" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
