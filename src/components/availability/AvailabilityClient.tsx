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

const PAGE_OPTIONS = [12, 24, 36, 48] as const;

// Tailwind needs to see all possible grid classes at compile time
const GRID_CLASS_BY_N: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

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
  const [sizeRange, setSizeRange] = useState<[number, number]>([0, 500]); // SQM

  // Sort + pagination
  const [sortOption, setSortOption] = useState<string>("priceAsc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(PAGE_OPTIONS[0]);

  // Selected units
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // View controls
  const [view, setView] = useState<"cards" | "table">("cards");
  const [gridCols, setGridCols] = useState<number>(3); // user-controlled cols for card view

  // Mobile filters drawer
  const [showFilters, setShowFilters] = useState(false);

  // Ranges derived from data
  const [maxPrice, setMaxPrice] = useState(0);
  const [minSqm, setMinSqm] = useState(0);
  const [maxSqm, setMaxSqm] = useState(0);

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

        // price & sqm ranges
        const prices = data.map((r) => r.ListPrice).filter((n) => Number.isFinite(n));
        const sqms = data.map((r) => r.GrossAreaSQM).filter((n) => Number.isFinite(n));
        const pMax = prices.length ? Math.max(...prices) : 10_000_000;
        const sMin = sqms.length ? Math.floor(Math.min(...sqms)) : 0;
        const sMax = sqms.length ? Math.ceil(Math.max(...sqms)) : 500;

        setMaxPrice(pMax);
        setPriceRange([0, pMax]);
        setMinSqm(sMin);
        setMaxSqm(sMax);
        setSizeRange([sMin, sMax]);

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

  // ---------- SMART FACETS ----------
  const rowsAfter = (exclude: "property" | "city" | "status" | "type" | "amenities" | "facing") => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.property_name.toLowerCase().includes(q) ||
        r.BuildingUnit.toLowerCase().includes(q) ||
        (r.tower_name || "").toLowerCase().includes(q) ||
        (r.tower_code || "").toLowerCase().includes(q);

      const priceOk = r.ListPrice >= priceRange[0] && r.ListPrice <= priceRange[1];
      const sqmOk = r.GrossAreaSQM >= sizeRange[0] && r.GrossAreaSQM <= sizeRange[1];
      const onlySelOk = showOnlySelected ? selectedUnits.has(r.unit_id) : true;

      const propertyOk =
        exclude === "property" || selectedProperty.length === 0
          ? true
          : selectedProperty.some((pr) => pr.label === r.property_name);

      const cityOk =
        exclude === "city" || selectedCity.length === 0
          ? true
          : selectedCity.some((c) => c.label === r.city);

      const statusOk =
        exclude === "status" || selectedStatus.length === 0
          ? true
          : selectedStatus.some((s) => s.value === r.Status);

      const typeOk =
        exclude === "type" || selectedType.length === 0
          ? true
          : selectedType.some((t) => t.value === r.Type);

      const amenOk =
        exclude === "amenities" || selectedAmenities.length === 0
          ? true
          : selectedAmenities.some((a) => a.value === r.Amenities);

      const facingOk =
        exclude === "facing" || selectedFacing.length === 0
          ? true
          : selectedFacing.some((f) => f.value === r.Facing);

      return matchesSearch && priceOk && sqmOk && onlySelOk && propertyOk && cityOk && statusOk && typeOk && amenOk && facingOk;
    });
  };

  const toOptions = (vals: string[]) => vals.sort().map((v) => ({ value: v, label: v }));

  const availablePropertyOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("property").map((r) => r.property_name).filter(Boolean)));
    return toOptions(vals);
  }, [rows, searchTerm, priceRange, sizeRange, selectedCity, selectedStatus, selectedType, selectedAmenities, selectedFacing, showOnlySelected]);

  const availableCityOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("city").map((r) => r.city).filter(Boolean)));
    return toOptions(vals);
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedStatus, selectedType, selectedAmenities, selectedFacing, showOnlySelected]);

  const availableStatusOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("status").map((r) => r.Status).filter(Boolean)));
    return toOptions(vals);
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedCity, selectedType, selectedAmenities, selectedFacing, showOnlySelected]);

  const availableTypeOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("type").map((r) => r.Type).filter(Boolean)));
    const order = ["STUDIO", "1BR", "2BR", "3BR", "4BR", "LOFT"];
    vals.sort((a, b) => {
      const ia = order.indexOf(a.toUpperCase());
      const ib = order.indexOf(b.toUpperCase());
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
    return toOptions(vals);
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedCity, selectedStatus, selectedAmenities, selectedFacing, showOnlySelected]);

  const availableAmenityOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("amenities").map((r) => r.Amenities).filter(Boolean)));
    return toOptions(vals);
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedCity, selectedStatus, selectedType, selectedFacing, showOnlySelected]);

  const availableFacingOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("facing").map((r) => r.Facing).filter(Boolean)));
    return toOptions(vals);
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedCity, selectedStatus, selectedType, selectedAmenities, showOnlySelected]);

  // Auto-prune selections that became invalid
  useEffect(() => {
    const prune = (selected: Option[], avail: Option[], setter: (v: Option[]) => void) => {
      const availSet = new Set(avail.map((o) => o.value));
      const next = selected.filter((s) => availSet.has(s.value));
      if (next.length !== selected.length) setter(next);
    };
    prune(selectedProperty, availablePropertyOpts, setSelectedProperty);
    prune(selectedCity, availableCityOpts, setSelectedCity);
    prune(selectedStatus, availableStatusOpts, setSelectedStatus);
    prune(selectedType, availableTypeOpts, setSelectedType);
    prune(selectedAmenities, availableAmenityOpts, setSelectedAmenities);
    prune(selectedFacing, availableFacingOpts, setSelectedFacing);
  }, [
    availablePropertyOpts,
    availableCityOpts,
    availableStatusOpts,
    availableTypeOpts,
    availableAmenityOpts,
    availableFacingOpts,
  ]);

  // ---------- Filtered + sorted result set ----------
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const arr = rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.property_name.toLowerCase().includes(q) ||
        r.BuildingUnit.toLowerCase().includes(q) ||
        (r.tower_name || "").toLowerCase().includes(q) ||
        (r.tower_code || "").toLowerCase().includes(q);

      const statusMatch = selectedStatus.length ? selectedStatus.some((s) => s.value === r.Status) : true;
      const typeMatch = selectedType.length ? selectedType.some((t) => t.value === r.Type) : true;
      const amenMatch = selectedAmenities.length ? selectedAmenities.some((a) => a.value === r.Amenities) : true;
      const facingMatch = selectedFacing.length ? selectedFacing.some((f) => f.value === r.Facing) : true;
      const propertyMatch = selectedProperty.length ? selectedProperty.some((pr) => pr.label === r.property_name) : true;
      const cityMatch = selectedCity.length ? selectedCity.some((c) => c.label === r.city) : true;
      const priceMatch = r.ListPrice >= priceRange[0] && r.ListPrice <= priceRange[1];
      const sqmMatch = r.GrossAreaSQM >= sizeRange[0] && r.GrossAreaSQM <= sizeRange[1];
      const selectedMatch = showOnlySelected ? selectedUnits.has(r.unit_id) : true;

      return matchesSearch && statusMatch && typeMatch && amenMatch && facingMatch && propertyMatch && cityMatch && priceMatch && sqmMatch && selectedMatch;
    });

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
  }, [
    rows, searchTerm, selectedStatus, selectedType, selectedAmenities, selectedFacing,
    selectedProperty, selectedCity, priceRange, sizeRange, showOnlySelected, sortOption, selectedUnits
  ]);

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
    menu: (p: any) => ({ ...p, borderRadius: 12, overflow: "hidden", zIndex: 30 }),
  };

  // --------- Filters block (with stable instanceIds) ----------
  function FiltersBlock(ctx: "desktop" | "mobile") {
    return (
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
          instanceId={`avail-project-${ctx}`}
          options={availablePropertyOpts}
          value={selectedProperty}
          onChange={(v) => { setSelectedProperty(v as Option[]); setCurrentPage(1); }}
          placeholder="Project"
          styles={selectStyles}
        />

        <Select
          isMulti
          instanceId={`avail-city-${ctx}`}
          options={availableCityOpts}
          value={selectedCity}
          onChange={(v) => { setSelectedCity(v as Option[]); setCurrentPage(1); }}
          placeholder="City"
          styles={selectStyles}
        />

        <Select
          isMulti
          instanceId={`avail-status-${ctx}`}
          options={availableStatusOpts}
          value={selectedStatus}
          onChange={(v) => { setSelectedStatus(v as Option[]); setCurrentPage(1); }}
          placeholder="Status"
          styles={selectStyles}
        />

        <Select
          isMulti
          instanceId={`avail-type-${ctx}`}
          options={availableTypeOpts}
          value={selectedType}
          onChange={(v) => { setSelectedType(v as Option[]); setCurrentPage(1); }}
          placeholder="Type"
          styles={selectStyles}
        />

        <Select
          isMulti
          instanceId={`avail-amenities-${ctx}`}
          options={availableAmenityOpts}
          value={selectedAmenities}
          onChange={(v) => { setSelectedAmenities(v as Option[]); setCurrentPage(1); }}
          placeholder="Amenities"
          styles={selectStyles}
        />

        <Select
          isMulti
          instanceId={`avail-facing-${ctx}`}
          options={availableFacingOpts}
          value={selectedFacing}
          onChange={(v) => { setSelectedFacing(v as Option[]); setCurrentPage(1); }}
          placeholder="Facing"
          styles={selectStyles}
        />

        {/* Price range */}
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

        {/* SQM range */}
        <div className="pt-2">
          <div className="text-sm font-medium mb-2">
            Size: {sizeRange[0].toLocaleString()} – {sizeRange[1].toLocaleString()} sqm
          </div>
          <Range
            step={1}
            min={minSqm}
            max={maxSqm || 500}
            values={sizeRange}
            onChange={(v) => { setSizeRange(v as [number, number]); setCurrentPage(1); }}
            renderTrack={({ props, children }) => <div {...props} className="h-2 rounded-full bg-muted">{children}</div>}
            renderThumb={({ props }) => {
              const { key, ...rest } = props as any;
              return <div key={key} {...rest} className="h-4 w-4 rounded-full bg-[color:var(--primary)] shadow" aria-label="Size handle" />;
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select
            instanceId={`avail-sort-${ctx}`}
            options={[
              { value: "priceAsc", label: "Price: Low → High" },
              { value: "priceDesc", label: "Price: High → Low" },
              { value: "sqmAsc", label: "Area: Small → Big" },
              { value: "sqmDesc", label: "Area: Big → Small" },
              { value: "rfoAsc", label: "RFO: Old → New" },
              { value: "rfoDesc", label: "RFO: New → Old" },
            ]}
            value={[
              { value: "priceAsc", label: "Price: Low → High" },
              { value: "priceDesc", label: "Price: High → Low" },
              { value: "sqmAsc", label: "Area: Small → Big" },
              { value: "sqmDesc", label: "Area: Big → Small" },
              { value: "rfoAsc", label: "RFO: Old → New" },
              { value: "rfoDesc", label: "RFO: New → Old" },
            ].find((o) => o.value === sortOption)}
            onChange={(o) => setSortOption((o as Option)?.value || "priceAsc")}
            placeholder="Sort by"
            styles={selectStyles}
          />
          <select
            className="input"
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
          >
            {PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showOnlySelected} onChange={(e) => setShowOnlySelected(e.target.checked)} />
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
            const id = Array.from(selectedUnits)[0];
            return (
              <Link href={`/computation/${encodeURIComponent(id)}`} className="btn btn-outline btn-block">
                Computation
              </Link>
            );
          })()}
        </div>

        <button
          className="btn btn-ghost w-full lg:hidden"
          onClick={() => setShowFilters(false)}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto max-w-[1440px] 2xl:max-w-[1680px] px-4 md:px-6 pt-6 pb-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Availability</h1>
        <p className="text-sm text-muted-foreground">
          Browse by project, tower and city. Filter inventory and select units to compare or compute.
          {lastUpdated && <> Last updated: <b>{lastUpdated.date}</b> • {lastUpdated.time}</>}
        </p>
      </header>

      {/* Toolbar (view + columns + filters on mobile) */}
      <div className="mx-auto max-w-[1440px] 2xl:max-w-[1680px] px-4 md:px-6 mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border overflow-hidden">
          <button
            className={`px-3 py-1.5 text-sm ${view === "cards" ? "bg-blue-600 text-white" : "hover:bg-muted"}`}
            onClick={() => setView("cards")}
          >
            Cards
          </button>
        <button
            className={`px-3 py-1.5 text-sm ${view === "table" ? "bg-blue-600 text-white" : "hover:bg-muted"}`}
            onClick={() => setView("table")}
          >
            Table
          </button>
        </div>

        {view === "cards" && (
          <div className="inline-flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Columns</span>
            <select
              value={gridCols}
              onChange={(e) => setGridCols(Math.min(6, Math.max(1, Number(e.target.value))))}
              className="input w-[90px]"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-auto lg:hidden">
          <button className="btn btn-outline" onClick={() => setShowFilters(true)}>Filters</button>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] 2xl:max-w-[1680px] px-4 md:px-6 pb-10 grid grid-cols-1 lg:grid-cols-[380px_1fr] 2xl:grid-cols-[420px_1fr] gap-6">
        {/* Filters – sticky scroll area on desktop */}
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] overflow-auto">
          {FiltersBlock("desktop")}
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
                setSizeRange([minSqm, maxSqm || 500]);
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
              ) : view === "cards" ? (
                // --------- CARD VIEW ----------
                <div className={`grid ${GRID_CLASS_BY_N[gridCols]} gap-4`}>
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
              ) : (
                // --------- TABLE VIEW ----------
                <div className="card overflow-auto">
                  <table className="min-w-[920px] w-full text-sm">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left p-3">Select</th>
                        <th className="text-left p-3">Project • Tower</th>
                        <th className="text-left p-3">Unit</th>
                        <th className="text-left p-3">Type</th>
                        <th className="text-right p-3">Area (sqm)</th>
                        <th className="text-left p-3">Facing</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-right p-3">List Price</th>
                        <th className="text-right p-3">₱/sqm</th>
                        <th className="text-left p-3">City</th>
                        <th className="text-left p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((r) => {
                        const isSelected = selectedUnits.has(r.unit_id);
                        return (
                          <tr key={r.unit_id} className="border-t">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleUnit(r.unit_id)}
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-medium">{r.property_name}</div>
                              <div className="text-xs text-muted-foreground">{r.tower_name || r.tower_code}</div>
                            </td>
                            <td className="p-3">{r.BuildingUnit}</td>
                            <td className="p-3">{r.Type}</td>
                            <td className="p-3 text-right">{r.GrossAreaSQM.toLocaleString()}</td>
                            <td className="p-3">{r.Facing || "—"}</td>
                            <td className="p-3">{r.Status}</td>
                            <td className="p-3 text-right">₱{r.ListPrice.toLocaleString()}</td>
                            <td className="p-3 text-right">₱{r.PerSQM.toLocaleString()}</td>
                            <td className="p-3">{r.city}</td>
                            <td className="p-3">
                              <Link href={`/computation/${encodeURIComponent(r.unit_id)}`} className="btn btn-ghost btn-sm">
                                Compute
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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

      {/* Mobile / tablet filter drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="absolute left-0 right-0 bottom-0 max-h=[88vh] bg-white rounded-t-2xl shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b rounded-t-2xl px-4 py-3 flex items-center justify-between">
              <div className="font-semibold">Filters</div>
              <button className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50" onClick={() => setShowFilters(false)}>Done</button>
            </div>
            <div className="p-4">
              {FiltersBlock("mobile")}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
