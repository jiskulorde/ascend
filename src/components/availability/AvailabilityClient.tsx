// src/components/availability/AvailabilityClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { Range } from "react-range";
import Link from "next/link";

type UnitRow = {
  property_code: string;
  property_name: string;
  city: string;
  address: string;
  tower_code: string;
  tower_name: string;

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

  unit_id: string;
};

type Option = { value: string; label: string };

const PAGE_OPTIONS = [12, 24, 36, 48] as const;

const CARD_GRID_CLASS_BY_N: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

const SORT_OPTIONS: Option[] = [
  { value: "priceAsc", label: "Price: Low → High" },
  { value: "priceDesc", label: "Price: High → Low" },
  { value: "sqmAsc", label: "Area: Small → Big" },
  { value: "sqmDesc", label: "Area: Big → Small" },
  { value: "rfoAsc", label: "RFO: Old → New" },
  { value: "rfoDesc", label: "RFO: New → Old" },
];

const COLUMN_OPTIONS: Option[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: `${n}`,
}));

const PAGE_SELECT_OPTIONS: Option[] = PAGE_OPTIONS.map((n) => ({
  value: String(n),
  label: `${n} / page`,
}));

function fmtPhp(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCompactPhp(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000) return `₱${Math.round(n / 1_000)}K`;
  return `₱${Math.round(n)}`;
}

function getUnitNumber(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "—";

  const match = text.match(/(\d+[A-Za-z]?)\s*$/);
  return match?.[1] || text;
}

function getFloorNumber(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "—";

  const direct = Number(text);
  if (Number.isFinite(direct)) return `${direct}F`;

  const match = text.match(/(\d+)(?!.*\d)/);
  return match ? `${match[1]}F` : text;
}

function statusTone(status: string) {
  const value = String(status || "").toLowerCase();

  if (value.startsWith("avail")) {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (value.includes("hold")) {
    return "border-amber-100 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function typeSort(a: string, b: string) {
  const order = ["STUDIO", "1BR", "2BR", "3BR", "4BR", "LOFT"];
  const ai = order.indexOf(a.toUpperCase());
  const bi = order.indexOf(b.toUpperCase());

  if (ai >= 0 && bi >= 0) return ai - bi;
  if (ai >= 0) return -1;
  if (bi >= 0) return 1;

  return a.localeCompare(b);
}

export default function AvailabilityClient() {
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<{ date: string; time: string; fileName: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Option[]>([]);
  const [selectedType, setSelectedType] = useState<Option[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<Option[]>([]);
  const [selectedFacing, setSelectedFacing] = useState<Option[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Option[]>([]);
  const [selectedCity, setSelectedCity] = useState<Option[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10_000_000]);
  const [sizeRange, setSizeRange] = useState<[number, number]>([0, 500]);

  const [sortOption, setSortOption] = useState<string>("priceAsc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(PAGE_OPTIONS[0]);

  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  const [view, setView] = useState<"cards" | "table">("cards");
  const [gridCols, setGridCols] = useState<number>(3);

  const [showFilters, setShowFilters] = useState(false);

  const [maxPrice, setMaxPrice] = useState(0);
  const [minSqm, setMinSqm] = useState(0);
  const [maxSqm, setMaxSqm] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);

      try {
        const res = await fetch("/api/availability", { cache: "no-store" });
        const json = await res.json();

        if (!json?.success) throw new Error("Failed to fetch availability");

        const data: UnitRow[] = json.data || [];
        setRows(data);

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

  const searchMatches = (r: UnitRow) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;

    const searchable = [
      r.property_name,
      r.property_code,
      r.BuildingUnit,
      getUnitNumber(r.BuildingUnit),
      r.tower_name,
      r.tower_code,
      r.city,
      r.address,
      r.Type,
      r.Facing,
      r.Amenities,
      r.RFODate,
      r.ListPrice,
      r.PerSQM,
      r.GrossAreaSQM,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(q);
  };

  const rowsAfter = (exclude: "property" | "city" | "status" | "type" | "amenities" | "facing") => {
    return rows.filter((r) => {
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

      return (
        searchMatches(r) &&
        priceOk &&
        sqmOk &&
        onlySelOk &&
        propertyOk &&
        cityOk &&
        statusOk &&
        typeOk &&
        amenOk &&
        facingOk
      );
    });
  };

  const toOptions = (vals: string[]) => vals.sort().map((v) => ({ value: v, label: v }));

  const availablePropertyOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("property").map((r) => r.property_name).filter(Boolean)));
    return toOptions(vals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchTerm, priceRange, sizeRange, selectedCity, selectedStatus, selectedType, selectedAmenities, selectedFacing, showOnlySelected]);

  const availableCityOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("city").map((r) => r.city).filter(Boolean)));
    return toOptions(vals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedStatus, selectedType, selectedAmenities, selectedFacing, showOnlySelected]);

  const availableStatusOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("status").map((r) => r.Status).filter(Boolean)));
    return toOptions(vals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedCity, selectedType, selectedAmenities, selectedFacing, showOnlySelected]);

  const availableTypeOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("type").map((r) => r.Type).filter(Boolean)));
    vals.sort(typeSort);
    return toOptions(vals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedCity, selectedStatus, selectedAmenities, selectedFacing, showOnlySelected]);

  const availableAmenityOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("amenities").map((r) => r.Amenities).filter(Boolean)));
    return toOptions(vals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedCity, selectedStatus, selectedType, selectedFacing, showOnlySelected]);

  const availableFacingOpts = useMemo(() => {
    const vals = Array.from(new Set(rowsAfter("facing").map((r) => r.Facing).filter(Boolean)));
    return toOptions(vals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchTerm, priceRange, sizeRange, selectedProperty, selectedCity, selectedStatus, selectedType, selectedAmenities, showOnlySelected]);

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
    selectedProperty,
    selectedCity,
    selectedStatus,
    selectedType,
    selectedAmenities,
    selectedFacing,
  ]);

  const filtered = useMemo(() => {
    const arr = rows.filter((r) => {
      const statusMatch = selectedStatus.length ? selectedStatus.some((s) => s.value === r.Status) : true;
      const typeMatch = selectedType.length ? selectedType.some((t) => t.value === r.Type) : true;
      const amenMatch = selectedAmenities.length ? selectedAmenities.some((a) => a.value === r.Amenities) : true;
      const facingMatch = selectedFacing.length ? selectedFacing.some((f) => f.value === r.Facing) : true;
      const propertyMatch = selectedProperty.length ? selectedProperty.some((pr) => pr.label === r.property_name) : true;
      const cityMatch = selectedCity.length ? selectedCity.some((c) => c.label === r.city) : true;
      const priceMatch = r.ListPrice >= priceRange[0] && r.ListPrice <= priceRange[1];
      const sqmMatch = r.GrossAreaSQM >= sizeRange[0] && r.GrossAreaSQM <= sizeRange[1];
      const selectedMatch = showOnlySelected ? selectedUnits.has(r.unit_id) : true;

      return (
        searchMatches(r) &&
        statusMatch &&
        typeMatch &&
        amenMatch &&
        facingMatch &&
        propertyMatch &&
        cityMatch &&
        priceMatch &&
        sqmMatch &&
        selectedMatch
      );
    });

    arr.sort((a, b) => {
      switch (sortOption) {
        case "priceDesc":
          return b.ListPrice - a.ListPrice;
        case "priceAsc":
          return a.ListPrice - b.ListPrice;
        case "sqmDesc":
          return b.GrossAreaSQM - a.GrossAreaSQM;
        case "sqmAsc":
          return a.GrossAreaSQM - b.GrossAreaSQM;
        case "rfoDesc":
          return new Date(b.RFODate).getTime() - new Date(a.RFODate).getTime();
        case "rfoAsc":
          return new Date(a.RFODate).getTime() - new Date(b.RFODate).getTime();
        default:
          return 0;
      }
    });

    return arr;
  }, [
    rows,
    searchTerm,
    selectedStatus,
    selectedType,
    selectedAmenities,
    selectedFacing,
    selectedProperty,
    selectedCity,
    priceRange,
    sizeRange,
    showOnlySelected,
    sortOption,
    selectedUnits,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageItems = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const selectedUnit = selectedUnits.size === 1 ? Array.from(selectedUnits)[0] : null;

  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (searchTerm.trim()) count += 1;
    count += selectedStatus.length;
    count += selectedType.length;
    count += selectedAmenities.length;
    count += selectedFacing.length;
    count += selectedProperty.length;
    count += selectedCity.length;

    if (priceRange[0] !== 0 || priceRange[1] !== maxPrice) count += 1;
    if (sizeRange[0] !== minSqm || sizeRange[1] !== maxSqm) count += 1;
    if (showOnlySelected) count += 1;

    return count;
  }, [
    searchTerm,
    selectedStatus,
    selectedType,
    selectedAmenities,
    selectedFacing,
    selectedProperty,
    selectedCity,
    priceRange,
    sizeRange,
    maxPrice,
    minSqm,
    maxSqm,
    showOnlySelected,
  ]);

  const toggleUnit = (unit_id: string) => {
    const next = new Set(selectedUnits);
    next.has(unit_id) ? next.delete(unit_id) : next.add(unit_id);
    setSelectedUnits(next);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedStatus([]);
    setSelectedType([]);
    setSelectedAmenities([]);
    setSelectedFacing([]);
    setSelectedProperty([]);
    setSelectedCity([]);
    setPriceRange([0, maxPrice || 10_000_000]);
    setSizeRange([minSqm, maxSqm || 500]);
    setShowOnlySelected(false);
    setCurrentPage(1);
  };

  const selectStyles = {
    control: (p: any, state: any) => ({
      ...p,
      minHeight: 38,
      borderRadius: 14,
      borderColor: state.isFocused ? "#1f3f93" : "#d8e0ec",
      backgroundColor: "#ffffff",
      boxShadow: state.isFocused ? "0 0 0 3px rgba(31,63,147,0.10)" : "0 1px 2px rgba(15,23,42,0.04)",
      cursor: "pointer",
      transition: "all 150ms ease",
      "&:hover": { borderColor: "#b7c4d8" },
    }),
    valueContainer: (p: any) => ({
      ...p,
      padding: "1px 10px",
    }),
    placeholder: (p: any) => ({
      ...p,
      color: "#94a3b8",
      fontSize: 13,
      fontWeight: 500,
    }),
    singleValue: (p: any) => ({
      ...p,
      color: "#0f172a",
      fontSize: 13,
      fontWeight: 600,
    }),
    input: (p: any) => ({
      ...p,
      color: "#0f172a",
      fontSize: 13,
    }),
    dropdownIndicator: (p: any, state: any) => ({
      ...p,
      color: state.isFocused ? "#1f3f93" : "#94a3b8",
      paddingRight: 8,
      "&:hover": { color: "#1f3f93" },
    }),
    clearIndicator: (p: any) => ({
      ...p,
      color: "#94a3b8",
      padding: 6,
      "&:hover": { color: "#334155" },
    }),
    indicatorSeparator: () => ({
      display: "none",
    }),
    menuPortal: (p: any) => ({
      ...p,
      zIndex: 9999,
    }),
    menu: (p: any) => ({
      ...p,
      borderRadius: 18,
      overflow: "hidden",
      zIndex: 80,
      padding: 6,
      border: "1px solid #e2e8f0",
      boxShadow: "0 22px 55px rgba(15,23,42,0.18)",
      backgroundColor: "#ffffff",
    }),
    menuList: (p: any) => ({
      ...p,
      padding: 0,
    }),
    option: (p: any, state: any) => ({
      ...p,
      borderRadius: 12,
      marginBottom: 3,
      backgroundColor: state.isSelected ? "#eef4ff" : state.isFocused ? "#f8fafc" : "#ffffff",
      color: state.isSelected ? "#1f3f93" : "#0f172a",
      fontSize: 13,
      fontWeight: state.isSelected ? 700 : 500,
      cursor: "pointer",
      ":active": { backgroundColor: "#e8f0ff" },
    }),
    multiValue: (p: any) => ({
      ...p,
      borderRadius: 999,
      backgroundColor: "#eef4ff",
      border: "1px solid #d9e6ff",
    }),
    multiValueLabel: (p: any) => ({
      ...p,
      color: "#1f3f93",
      fontWeight: 700,
      fontSize: 11,
      paddingLeft: 8,
    }),
    multiValueRemove: (p: any) => ({
      ...p,
      borderRadius: 999,
      color: "#1f3f93",
      ":hover": {
        backgroundColor: "#dbe8ff",
        color: "#102a63",
      },
    }),
  };

  function FiltersBlock(ctx: "desktop" | "mobile") {
    return (
      <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-950">Filters</div>
            <div className="text-xs text-muted-foreground">
              {activeFilterCount ? `${activeFilterCount} active` : "No active filters"}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={resetFilters}
            >
              Reset
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          <Select
            isMulti
            instanceId={`avail-project-${ctx}`}
            options={availablePropertyOpts}
            value={selectedProperty}
            onChange={(v) => {
              setSelectedProperty(Array.from(v as readonly Option[]));
              setCurrentPage(1);
            }}
            placeholder="Project"
            styles={selectStyles}
            menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
          />

          <Select
            isMulti
            instanceId={`avail-city-${ctx}`}
            options={availableCityOpts}
            value={selectedCity}
            onChange={(v) => {
              setSelectedCity(Array.from(v as readonly Option[]));
              setCurrentPage(1);
            }}
            placeholder="City"
            styles={selectStyles}
            menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
          />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            <Select
              isMulti
              instanceId={`avail-status-${ctx}`}
              options={availableStatusOpts}
              value={selectedStatus}
              onChange={(v) => {
                setSelectedStatus(Array.from(v as readonly Option[]));
                setCurrentPage(1);
              }}
              placeholder="Status"
              styles={selectStyles}
              menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
            />

            <Select
              isMulti
              instanceId={`avail-type-${ctx}`}
              options={availableTypeOpts}
              value={selectedType}
              onChange={(v) => {
                setSelectedType(Array.from(v as readonly Option[]));
                setCurrentPage(1);
              }}
              placeholder="Type"
              styles={selectStyles}
              menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
            />
          </div>

          <Select
            isMulti
            instanceId={`avail-amenities-${ctx}`}
            options={availableAmenityOpts}
            value={selectedAmenities}
            onChange={(v) => {
              setSelectedAmenities(Array.from(v as readonly Option[]));
              setCurrentPage(1);
            }}
            placeholder="Amenities"
            styles={selectStyles}
            menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
          />

          <Select
            isMulti
            instanceId={`avail-facing-${ctx}`}
            options={availableFacingOpts}
            value={selectedFacing}
            onChange={(v) => {
              setSelectedFacing(Array.from(v as readonly Option[]));
              setCurrentPage(1);
            }}
            placeholder="Facing"
            styles={selectStyles}
            menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
          />
        </div>

        <div className="mt-3 space-y-2.5">
          <RangeBox label="Price" value={`${fmtCompactPhp(priceRange[0])} – ${fmtCompactPhp(priceRange[1])}`}>
            <Range
              step={50_000}
              min={0}
              max={maxPrice || 10_000_000}
              values={priceRange}
              onChange={(v) => {
                setPriceRange(v as [number, number]);
                setCurrentPage(1);
              }}
              renderTrack={({ props, children }) => {
                const { key, ...rest } = props as any;
                return (
                  <div key={key} {...rest} className="h-1.5 rounded-full bg-slate-200">
                    {children}
                  </div>
                );
              }}
              renderThumb={({ props }) => {
                const { key, ...rest } = props as any;
                return (
                  <div
                    key={key}
                    {...rest}
                    className="h-4 w-4 rounded-full border-2 border-white bg-[#1f3f93] shadow-md"
                    aria-label="Price handle"
                  />
                );
              }}
            />
          </RangeBox>

          <RangeBox label="Size" value={`${sizeRange[0]} – ${sizeRange[1]} sqm`}>
            {maxSqm > minSqm ? (
              <Range
                step={1}
                min={minSqm}
                max={maxSqm || 500}
                values={sizeRange}
                onChange={(v) => {
                  setSizeRange(v as [number, number]);
                  setCurrentPage(1);
                }}
                renderTrack={({ props, children }) => {
                  const { key, ...rest } = props as any;
                  return (
                    <div key={key} {...rest} className="h-1.5 rounded-full bg-slate-200">
                      {children}
                    </div>
                  );
                }}
                renderThumb={({ props }) => {
                  const { key, ...rest } = props as any;
                  return (
                    <div
                      key={key}
                      {...rest}
                      className="h-4 w-4 rounded-full border-2 border-white bg-[#1f3f93] shadow-md"
                      aria-label="Size handle"
                    />
                  );
                }}
              />
            ) : (
              <div className="text-xs text-muted-foreground">Size range unavailable.</div>
            )}
          </RangeBox>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Select
            instanceId={`avail-sort-${ctx}`}
            options={SORT_OPTIONS}
            value={SORT_OPTIONS.find((o) => o.value === sortOption)}
            onChange={(o) => {
              setSortOption((o as Option)?.value || "priceAsc");
              setCurrentPage(1);
            }}
            placeholder="Sort"
            styles={selectStyles}
            isSearchable={false}
            menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
          />

          <Select
            instanceId={`avail-page-${ctx}`}
            options={PAGE_SELECT_OPTIONS}
            value={PAGE_SELECT_OPTIONS.find((o) => o.value === String(rowsPerPage))}
            onChange={(o) => {
              setRowsPerPage(Number((o as Option)?.value || PAGE_OPTIONS[0]));
              setCurrentPage(1);
            }}
            placeholder="Rows"
            styles={selectStyles}
            isSearchable={false}
            menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
          />
        </div>

        <label className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm">
          <span className="font-medium text-slate-700">Show selected only</span>
          <input
            type="checkbox"
            checked={showOnlySelected}
            onChange={(e) => {
              setShowOnlySelected(e.target.checked);
              setCurrentPage(1);
            }}
          />
        </label>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-sm text-slate-700">
            <b className="text-slate-950">{selectedUnits.size}</b> unit{selectedUnits.size !== 1 ? "s" : ""} selected
          </div>

          {selectedUnits.size > 1 && (
            <Link
              href="/compare"
              className="mt-2 flex h-10 items-center justify-center rounded-2xl bg-[#1f3f93] text-sm font-semibold text-white hover:bg-[#17337d]"
            >
              Compare selected
            </Link>
          )}

          {selectedUnit && (
            <Link
              href={`/computation/${encodeURIComponent(selectedUnit)}`}
              className="mt-2 flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Open computation
            </Link>
          )}
        </div>

        <button
          className="mt-3 h-10 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white lg:hidden"
          onClick={() => setShowFilters(false)}
        >
          Done
        </button>
      </div>
    );
  }

  function CompactUnitCard({ r }: { r: UnitRow }) {
    const isSelected = selectedUnits.has(r.unit_id);

    return (
      <article
        className={`overflow-hidden rounded-[22px] border bg-white shadow-sm transition ${
          isSelected ? "border-[#1f3f93] ring-2 ring-blue-100" : "border-slate-200"
        }`}
      >
        <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex max-w-[72%] items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm">
              <span className="truncate">{r.property_name}</span>
              <span className="mx-1 text-slate-300">•</span>
              <span className="truncate">{r.tower_name || r.tower_code || r.Tower}</span>
            </span>

            <button
              onClick={() => toggleUnit(r.unit_id)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                isSelected
                  ? "bg-[#1f3f93] text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {isSelected ? "Selected" : "Select"}
            </button>
          </div>

          <div className="text-sm text-slate-600">{r.city || "No city"}</div>
          <h3 className="mt-1 text-[15px] font-bold leading-snug text-slate-950">
            {r.BuildingUnit} • {r.Type || "—"} • {r.GrossAreaSQM} sqm
          </h3>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{r.address || "—"}</p>
        </div>

        <div className="px-3 pb-3 pt-2.5">
          <div className="flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(r.Status)}`}>
              {r.Status || "—"}
            </span>
            {r.Amenities && (
              <span className="inline-flex items-center rounded-full bg-[#eef2ff] px-2 py-1 text-[10px] font-medium text-[#43527a]">
                {r.Amenities}
              </span>
            )}
            {r.Facing && (
              <span className="inline-flex items-center rounded-full bg-[#eef2ff] px-2 py-1 text-[10px] font-medium text-[#43527a]">
                Facing {r.Facing}
              </span>
            )}
            {r.RFODate && (
              <span className="inline-flex items-center rounded-full bg-[#eef2ff] px-2 py-1 text-[10px] font-medium text-[#43527a]">
                RFO {r.RFODate}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500">List Price</div>
              <div className="text-[18px] font-extrabold leading-tight text-slate-950">{fmtPhp(r.ListPrice)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">Price / sqm</div>
              <div className="text-[13px] font-bold text-slate-600">{fmtPhp(r.PerSQM)} / sqm</div>
            </div>
          </div>

          <Link
            href={`/computation/${encodeURIComponent(r.unit_id)}`}
            className="mt-3 flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Open computation
          </Link>
        </div>
      </article>
    );
  }

  function MobileTableRow({ r }: { r: UnitRow }) {
    const isSelected = selectedUnits.has(r.unit_id);
    const unitNo = getUnitNumber(r.BuildingUnit);

    return (
      <div
        className={`grid grid-cols-[1.25fr_.7fr_.9fr_.78fr_20px] gap-1 border-b border-slate-100 px-2 py-1.5 ${
          isSelected ? "bg-blue-50/60" : "bg-white"
        }`}
      >
        <button className="min-w-0 text-left" onClick={() => toggleUnit(r.unit_id)}>
          <div className="truncate text-[12px] font-bold leading-tight text-slate-950">{unitNo}</div>
          <div className="truncate text-[9px] leading-tight text-slate-500">{r.property_name}</div>
          <div className="truncate text-[9px] leading-tight text-slate-400">{r.tower_name || r.tower_code}</div>
        </button>

        <div className="min-w-0">
          <div className="truncate text-[10px] font-semibold text-slate-800">{r.Type || "—"}</div>
          <div className="truncate text-[9px] text-slate-500">{r.GrossAreaSQM} sqm</div>
          <div className="truncate text-[9px] text-slate-400">{getFloorNumber(r.Floor)}</div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-bold leading-tight text-slate-950">{fmtCompactPhp(r.ListPrice)}</div>
          <div className={`mt-0.5 inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${statusTone(r.Status)}`}>
            {r.Status || "—"}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-bold leading-tight text-emerald-700">{fmtCompactPhp(r.PerSQM)}</div>
          <div className="text-[8px] leading-tight text-slate-400">/sqm</div>
          <div className="truncate text-[8px] text-slate-500">{r.Facing || "—"}</div>
        </div>

        <Link
          href={`/computation/${encodeURIComponent(r.unit_id)}`}
          className="flex items-center justify-end text-sm font-bold text-[#1f3f93]"
          title="Compute"
        >
          +
        </Link>
      </div>
    );
  }

  function DesktopCard({ r }: { r: UnitRow }) {
    const isSelected = selectedUnits.has(r.unit_id);

    return (
      <article
        className={`overflow-hidden rounded-[24px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
          isSelected ? "border-[#1f3f93] ring-2 ring-blue-100" : "border-slate-200"
        }`}
      >
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 pb-4 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="inline-flex max-w-[72%] items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm">
              <span className="truncate">{r.property_name}</span>
              <span className="mx-1.5 text-slate-300">•</span>
              <span className="truncate">{r.tower_name || r.tower_code || r.Tower}</span>
            </span>

            <button
              onClick={() => toggleUnit(r.unit_id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                isSelected
                  ? "bg-[#1f3f93] text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {isSelected ? "Selected" : "Select"}
            </button>
          </div>

          <div className="text-[12px] text-slate-600">{r.city || "No city"}</div>

          <h3 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight text-slate-950">
            {r.BuildingUnit}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-slate-800">
            <span>{r.Type || "—"}</span>
            <span className="text-slate-300">•</span>
            <span>{r.GrossAreaSQM} sqm</span>
            <span className="text-slate-300">•</span>
            <span>{getFloorNumber(r.Floor)}</span>
          </div>

          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-500">{r.address || "—"}</p>
        </div>

        <div className="px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(r.Status)}`}>
              {r.Status || "—"}
            </span>
            {r.Amenities && (
              <span className="inline-flex items-center rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-medium text-[#43527a]">
                {r.Amenities}
              </span>
            )}
            {r.Facing && (
              <span className="inline-flex items-center rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-medium text-[#43527a]">
                Facing {r.Facing}
              </span>
            )}
            {r.RFODate && (
              <span className="inline-flex items-center rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-medium text-[#43527a]">
                RFO {r.RFODate}
              </span>
            )}
          </div>

          <div className="mt-4 flex items-end justify-between gap-4 rounded-[20px] border border-slate-100 bg-slate-50/80 px-4 py-3">
            <div>
              <div className="text-xs text-slate-500">List Price</div>
              <div className="text-[20px] font-semibold leading-none tracking-tight text-slate-800">{fmtPhp(r.ListPrice)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Price / sqm</div>
              <div className="text-[13px] font-semibold text-slate-600">{fmtPhp(r.PerSQM)}</div>
            </div>
          </div>

          <Link
            href={`/computation/${encodeURIComponent(r.unit_id)}`}
            className="mt-4 flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Open computation
          </Link>
        </div>
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-foreground">
      <header className="mx-auto max-w-[1440px] px-3 pb-2 pt-3 md:px-6 md:pb-4 md:pt-6 2xl:max-w-[1680px]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-3xl">Availability</h1>
            <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-muted-foreground md:mt-1 md:text-sm">
              Browse by project, tower and city. Filter inventory and select units to compare or compute.
              {lastUpdated && (
                <>
                  {" "}
                  Last updated: <b>{lastUpdated.date}</b> • {lastUpdated.time}
                </>
              )}
            </p>
          </div>

          <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:block">
            <div className="text-xs text-muted-foreground">Available Inventory</div>
            <div className="text-lg font-bold">{filtered.length.toLocaleString()} results</div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-3 px-3 pb-10 md:px-6 lg:grid-cols-[320px_1fr] lg:gap-5 2xl:max-w-[1680px] 2xl:grid-cols-[360px_1fr]">
        <aside className="hidden overflow-auto lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)]">
          {FiltersBlock("desktop")}
        </aside>

        <section className="space-y-3">
          <div className="rounded-[22px] border border-slate-200 bg-white p-2.5 shadow-sm md:p-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(360px,1fr)_auto] md:items-end">
              <label className="block rounded-[18px] border border-amber-300/80 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-2 ring-1 ring-amber-100">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-800 md:text-xs">Search</span>
                  <span className="hidden rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 md:inline">
                    Quick find
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Search project, unit #, tower, type, facing..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 w-full rounded-xl border border-amber-300 bg-white px-3 text-xs font-medium text-slate-900 outline-none transition placeholder:text-slate-500 hover:border-amber-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 md:h-10 md:text-sm"
                />
              </label>

              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 md:flex md:justify-end">
                <div className="inline-flex h-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    className={`rounded-xl px-3 text-xs font-semibold transition md:text-sm ${
                      view === "cards"
                        ? "bg-[#1f3f93] text-white shadow-sm"
                        : "text-slate-700 hover:bg-white"
                    }`}
                    onClick={() => setView("cards")}
                  >
                    Cards
                  </button>
                  <button
                    className={`rounded-xl px-3 text-xs font-semibold transition md:text-sm ${
                      view === "table"
                        ? "bg-[#1f3f93] text-white shadow-sm"
                        : "text-slate-700 hover:bg-white"
                    }`}
                    onClick={() => setView("table")}
                  >
                    Table
                  </button>
                </div>

                <div className="hidden items-center gap-2 md:inline-flex">
                  {view === "cards" && (
                    <>
                      <span className="text-sm text-muted-foreground">Columns</span>
                      <div className="w-[76px]">
                        <Select
                          instanceId="avail-toolbar-columns"
                          options={COLUMN_OPTIONS}
                          value={COLUMN_OPTIONS.find((o) => o.value === String(gridCols))}
                          onChange={(o) => setGridCols(Math.min(6, Math.max(1, Number((o as Option)?.value || 3))))}
                          styles={selectStyles}
                          menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
                          isSearchable={false}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="min-w-0 md:w-[220px]">
                  <Select
                    instanceId="avail-toolbar-sort"
                    options={SORT_OPTIONS}
                    value={SORT_OPTIONS.find((o) => o.value === sortOption)}
                    onChange={(o) => {
                      setSortOption((o as Option)?.value || "priceAsc");
                      setCurrentPage(1);
                    }}
                    styles={selectStyles}
                    menuPortalTarget={typeof window !== "undefined" ? document.body : undefined}
                    isSearchable={false}
                  />
                </div>

                <button
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 lg:hidden"
                  onClick={() => setShowFilters(true)}
                >
                  {activeFilterCount ? `Filters (${activeFilterCount})` : "Filters"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
            <div>{filtered.length.toLocaleString()} results</div>
            <button className="rounded-xl px-2 py-1 font-medium hover:bg-white" onClick={resetFilters}>
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
                <>
                  <div className="space-y-2 lg:hidden">
                    {pageItems.map((r) => (
                      <CompactUnitCard key={r.unit_id} r={r} />
                    ))}
                  </div>

                  <div className={`hidden lg:grid ${CARD_GRID_CLASS_BY_N[gridCols]} gap-4`}>
                    {pageItems.map((r) => (
                      <DesktopCard key={r.unit_id} r={r} />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:hidden">
                    <div className="grid grid-cols-[1fr_.62fr_.84fr_.75fr_20px] gap-1 bg-[#1f3f93] px-2 py-2 text-[8px] font-bold uppercase tracking-wide text-white">
                      <span>Unit</span>
                      <span>Type</span>
                      <span className="text-right">Price</span>
                      <span className="text-right">₱/sqm</span>
                      <span className="text-right">+</span>
                    </div>

                    {pageItems.map((r) => (
                      <MobileTableRow key={r.unit_id} r={r} />
                    ))}
                  </div>

                  <div className="hidden overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm lg:block">
                    <table className="w-full table-fixed text-sm">
                      <thead className="bg-[#1f3f93] text-[11px] uppercase tracking-wide text-white">
                        <tr>
                          <th className="w-[4%] px-3 py-3 text-left">Sel</th>
                          <th className="w-[13%] px-3 py-3 text-left">Unit</th>
                          <th className="w-[19%] px-3 py-3 text-left">Project • Tower</th>
                          <th className="w-[8%] px-3 py-3 text-left">Type</th>
                          <th className="w-[8%] px-3 py-3 text-right">Area</th>
                          <th className="w-[9%] px-3 py-3 text-left">Facing</th>
                          <th className="w-[9%] px-3 py-3 text-left">Status</th>
                          <th className="w-[12%] px-3 py-3 text-right">List Price</th>
                          <th className="w-[10%] px-3 py-3 text-right">₱/sqm</th>
                          <th className="w-[8%] px-3 py-3 text-right">Action</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {pageItems.map((r) => {
                          const isSelected = selectedUnits.has(r.unit_id);
                          const unitNo = getUnitNumber(r.BuildingUnit);

                          return (
                            <tr key={r.unit_id} className={isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"}>
                              <td className="px-3 py-3">
                                <input type="checkbox" checked={isSelected} onChange={() => toggleUnit(r.unit_id)} />
                              </td>
                              <td className="px-3 py-3">
                                <div className="text-base font-bold text-slate-950">{unitNo}</div>
                                <div className="truncate text-xs text-slate-500">{r.BuildingUnit}</div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="truncate font-semibold">{r.property_name}</div>
                                <div className="truncate text-xs text-muted-foreground">{r.tower_name || r.tower_code}</div>
                              </td>
                              <td className="px-3 py-3 font-medium">{r.Type}</td>
                              <td className="px-3 py-3 text-right">{r.GrossAreaSQM.toLocaleString()} sqm</td>
                              <td className="px-3 py-3">{r.Facing || "—"}</td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(r.Status)}`}>
                                  {r.Status}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right font-bold">{fmtPhp(r.ListPrice)}</td>
                              <td className="px-3 py-3 text-right font-bold text-emerald-700">{fmtPhp(r.PerSQM)}</td>
                              <td className="px-3 py-3 text-right">
                                <Link
                                  href={`/computation/${encodeURIComponent(r.unit_id)}`}
                                  className="font-bold text-[#1f3f93] hover:text-[#132b66]"
                                >
                                  Compute
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>
                  <button
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
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

      {showFilters && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[28px] border-b bg-white px-4 py-3">
              <div>
                <div className="font-bold">Filters</div>
                <div className="text-xs text-muted-foreground">Refine your inventory view</div>
              </div>
              <button
                className="rounded-2xl border px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
                onClick={() => setShowFilters(false)}
              >
                Done
              </button>
            </div>

            <div className="p-4">{FiltersBlock("mobile")}</div>
          </div>
        </div>
      )}
    </main>
  );
}

function RangeBox({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <div className="text-[11px] font-medium text-slate-500">{value}</div>
      </div>
      {children}
    </div>
  );
}