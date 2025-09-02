"use client";

import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Range } from "react-range";
import Link from "next/link";

type Property = {
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

const PAGE_OPTIONS = [12, 24, 36, 48];

export default function AvailabilityClient() {
  const [properties, setProperties] = useState<Property[]>([]);
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
  const TYPE_OPTIONS: Option[] = ["STUDIO","1BR","2BR","3BR","4BR","LOFT"].map((t) => ({ value: t, label: t }));
  const AMENITIES_OPTIONS: Option[] = ["Front","Rear"].map((t) => ({ value: t, label: t }));
  const FACING_OPTIONS: Option[] = ["North","South","East","West","Northeast","Northwest","Southeast","Southwest"].map((t)=>({value:t,label:t}));

  const [uniqueProperties, setUniqueProperties] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0);

  // Load data
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/availability");
        if (!res.ok) throw new Error("Failed to fetch availability");

        const json = await res.json();
        const rows = Array.isArray(json.data) ? json.data : [];
        const normalized: Property[] = rows.map((p: any) => ({
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
          ListPrice: parseFloat((p["List Price"] || "0").replace(/[^0-9.-]+/g, "")) || 0,
          PerSQM: parseFloat((p["per SQM"] || "0").replace(/[^0-9.-]+/g, "")) || 0,
        }));

        setProperties(normalized);
        setUniqueProperties(Array.from(new Set(normalized.map(p => p.Property))).sort());
        const max = Math.max(0, ...normalized.map(p => p.ListPrice));
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
    const matches = (p: Property) => {
      const matchesSearch =
        !searchTerm ||
        p.Property.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.BuildingUnit.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.Tower.toLowerCase().includes(searchTerm.toLowerCase());

      const statusMatch   = selectedStatus.length ? selectedStatus.some(s => s.value === p.Status) : true;
      const typeMatch     = selectedType.length ? selectedType.some(t => t.value === p.Type) : true;
      const amenMatch     = selectedAmenities.length ? selectedAmenities.some(a => a.value === p.Amenities) : true;
      const facingMatch   = selectedFacing.length ? selectedFacing.some(f => f.value === p.Facing) : true;
      const propertyMatch = selectedProperty.length ? selectedProperty.some(pr => pr.value === p.Property) : true;
      const priceMatch    = p.ListPrice >= priceRange[0] && p.ListPrice <= priceRange[1];
      const selectedMatch = showOnlySelected ? selectedUnits.has(`${p.Property}-${p.BuildingUnit}`) : true;

      return matchesSearch && statusMatch && typeMatch && amenMatch && facingMatch && propertyMatch && priceMatch && selectedMatch;
    };
    const arr = properties.filter(matches);
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
  }, [properties, searchTerm, selectedStatus, selectedType, selectedAmenities, selectedFacing, selectedProperty, priceRange, showOnlySelected, sortOption, selectedUnits]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageItems = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const toggleUnitSelection = (unitId: string) => {
    const next = new Set(selectedUnits);
    next.has(unitId) ? next.delete(unitId) : next.add(unitId);
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

  const selectStylesLight = {
    control: (p: any) => ({ ...p, borderRadius: 12, borderColor: "var(--color-border)", boxShadow: "none", minHeight: 40 }),
    menu: (p: any) => ({ ...p, borderRadius: 12, overflow: "hidden" }),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto max-w-7xl px-4 md:px-6 pt-6 pb-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Availability</h1>
        <p className="text-sm text-muted-foreground">
          Filter inventory and select units to compare or compute.
          {lastUpdated && (
            <>
              {" "}Last updated: <b>{lastUpdated.date}</b> • {lastUpdated.time}
            </>
          )}
        </p>
      </header>

      <div className="mx-auto max-w-7xl px-4 md:px-6 pb-10 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Filters */}
        <aside className="lg:sticky lg:top-20 h-max">
          <div className="card p-4 space-y-4">
            <input
              type="text"
              placeholder="Search Property / Unit / Tower"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="input"
            />

            <Select
              isMulti
              options={uniqueProperties.map(p => ({ value: p, label: p }))}
              value={selectedProperty}
              onChange={(val) => { setSelectedProperty(val as Option[]); setCurrentPage(1); }}
              placeholder="Project"
              styles={selectStylesLight}
            />
            <Select isMulti options={STATUS_OPTIONS} value={selectedStatus} onChange={(v)=>{setSelectedStatus(v as Option[]); setCurrentPage(1);}} placeholder="Status" styles={selectStylesLight}/>
            <Select isMulti options={TYPE_OPTIONS} value={selectedType} onChange={(v)=>{setSelectedType(v as Option[]); setCurrentPage(1);}} placeholder="Type" styles={selectStylesLight}/>
            <Select isMulti options={AMENITIES_OPTIONS} value={selectedAmenities} onChange={(v)=>{setSelectedAmenities(v as Option[]); setCurrentPage(1);}} placeholder="Amenities" styles={selectStylesLight}/>
            <Select isMulti options={FACING_OPTIONS} value={selectedFacing} onChange={(v)=>{setSelectedFacing(v as Option[]); setCurrentPage(1);}} placeholder="Facing" styles={selectStylesLight}/>

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
  renderTrack={({ props, children }) => (
    <div {...props} className="h-2 rounded-full bg-muted">{children}</div>
  )}
  renderThumb={({ props }) => {
    const { key, ...rest } = props as any; // ⬅️ pull key out
    return (
      <div
        key={key}            // ⬅️ apply key directly
        {...rest}            // ⬅️ spread the rest
        className="h-4 w-4 rounded-full bg-[color:var(--primary)] shadow"
        aria-label="Price range handle"
      />
    );
  }}
/>

            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select
                options={sortOptions}
                value={sortOptions.find(o => o.value === sortOption)}
                onChange={(o)=> setSortOption(o?.value || "priceAsc")}
                placeholder="Sort by"
                styles={selectStylesLight}
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
              <input
                type="checkbox"
                checked={showOnlySelected}
                onChange={(e)=> setShowOnlySelected(e.target.checked)}
              />
              Show only selected
            </label>

            {/* Actions */}
            <div className="rounded-lg border border-border p-3">
              <div className="text-sm mb-2">
                <b>{selectedUnits.size}</b> unit{selectedUnits.size !== 1 ? "s" : ""} selected
              </div>
              {selectedUnits.size > 1 && (
                <Link href="/compare" className="btn btn-primary btn-block mb-2">Compare</Link>
              )}
              {selectedUnits.size === 1 && (() => {
                const id = Array.from(selectedUnits)[0];
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
          {/* Summary bar */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>{filtered.length.toLocaleString()} results</div>
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 rounded-lg hover:bg-muted"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedStatus([]); setSelectedType([]); setSelectedAmenities([]); setSelectedFacing([]); setSelectedProperty([]);
                  setPriceRange([0, maxPrice || 10_000_000]);
                }}
              >
                Reset filters
              </button>
            </div>
          </div>

          {/* Grid of cards (Airbnb-style) */}
          {loading && <p className="muted">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}

          {!loading && !error && (
            <>
              {pageItems.length === 0 ? (
                <div className="card p-8 text-center text-muted-foreground">No units match your filters.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pageItems.map((p) => {
                    const unitId = `${p.Property}-${p.BuildingUnit}`;
                    const isSelected = selectedUnits.has(unitId);
                    const statusColor =
                      p.Status.toLowerCase().startsWith("avail") ? "text-emerald-700 bg-emerald-50" :
                      p.Status.toLowerCase().includes("hold") ? "text-amber-700 bg-amber-50" :
                      "text-slate-700 bg-slate-100";

                    return (
                      <div key={unitId} className="card overflow-hidden group">
                        {/* image placeholder */}
                        <div className="aspect-[16/10] bg-muted/50 grid place-items-center">
                          <div className="rounded-md border border-border bg-white/70 px-3 py-1 text-xs shadow-sm">
                            {p.Property} • Tower {p.Tower}
                          </div>
                        </div>

                        <div className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm text-muted-foreground">{p.Property}</div>
                              <div className="font-medium">{p.BuildingUnit} • {p.Type} • {p.GrossAreaSQM} sqm</div>
                            </div>
                            <button
                              onClick={() => toggleUnitSelection(unitId)}
                              className={`rounded-full px-3 py-1 text-xs border ${isSelected ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] border-transparent" : "hover:bg-muted"}`}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] ${statusColor}`}>{p.Status}</span>
                            {p.Facing && <span className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-[11px]">Facing {p.Facing}</span>}
                            {p.Amenities && <span className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-[11px]">{p.Amenities}</span>}
                            {p.RFODate && <span className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-[11px]">RFO {p.RFODate}</span>}
                          </div>

                          <div className="pt-1 flex items-end justify-between">
                            <div className="text-lg font-semibold">₱{p.ListPrice.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">₱{p.PerSQM.toLocaleString()} / sqm</div>
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
                  <button
                    className="btn btn-outline px-3 py-1"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>
                  <button
                    className="btn btn-outline px-3 py-1"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
