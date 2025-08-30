"use client";

import { useEffect, useState } from "react";
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

const PAGE_OPTIONS = [20, 30, 40, 50, 100];

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Option[]>([]);
  const [selectedType, setSelectedType] = useState<Option[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<Option[]>([]);
  const [selectedFacing, setSelectedFacing] = useState<Option[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Option[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000000]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const [uniqueProperties, setUniqueProperties] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0);

  // Selected units for agent
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Options
  const STATUS_OPTIONS: Option[] = [
    { value: "Avail.", label: "Available" },
    { value: "OnHold", label: "On Hold" },
  ];
  const TYPE_OPTIONS: Option[] = [
    { value: "1BR", label: "1BR" },
    { value: "2BR", label: "2BR" },
    { value: "3BR", label: "3BR" },
    { value: "4BR", label: "4BR" },
    { value: "STUDIO", label: "STUDIO" },
    { value: "LOFT", label: "LOFT" },
  ];
  const AMENITIES_OPTIONS: Option[] = [
    { value: "Front", label: "Front" },
    { value: "Rear", label: "Rear" },
  ];
  const FACING_OPTIONS: Option[] = [
    { value: "North", label: "North" },
    { value: "South", label: "South" },
    { value: "East", label: "East" },
    { value: "West", label: "West" },
    { value: "Northeast", label: "Northeast" },
    { value: "Northwest", label: "Northwest" },
    { value: "Southeast", label: "Southeast" },
    { value: "Southwest", label: "Southwest" },
  ];

  // Load properties and restore selected units from localStorage
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch("/api/availability");
        if (!res.ok) throw new Error("Failed to fetch properties");

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
        setUniqueProperties(Array.from(new Set(normalized.map(p => p.Property))));
        const max = Math.max(...normalized.map(p => p.ListPrice));
        setMaxPrice(max);
        setPriceRange([0, max]);

        // Restore selected units
        const stored = localStorage.getItem("selectedUnits");
        if (stored) setSelectedUnits(new Set(JSON.parse(stored)));
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Persist selected units whenever changed
  useEffect(() => {
    localStorage.setItem("selectedUnits", JSON.stringify(Array.from(selectedUnits)));
  }, [selectedUnits]);

    const [sortOption, setSortOption] = useState<string>(""); 

  // Filtering
  const filteredProperties = properties.filter(p => {
    const matchesSearch =
      searchTerm === "" ||
      p.Property.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.BuildingUnit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Tower.toLowerCase().includes(searchTerm.toLowerCase());

    const statusMatch = selectedStatus.length ? selectedStatus.some(s => s.value === p.Status) : true;
    const typeMatch = selectedType.length ? selectedType.some(t => t.value === p.Type) : true;
    const amenitiesMatch = selectedAmenities.length ? selectedAmenities.some(a => a.value === p.Amenities) : true;
    const facingMatch = selectedFacing.length ? selectedFacing.some(f => f.value === p.Facing) : true;
    const propertyMatch = selectedProperty.length ? selectedProperty.some(pr => pr.value === p.Property) : true;
    const priceMatch = p.ListPrice >= priceRange[0] && p.ListPrice <= priceRange[1];
    const selectedMatch = showOnlySelected ? selectedUnits.has(`${p.Property}-${p.BuildingUnit}`) : true;
    return matchesSearch && statusMatch && typeMatch && amenitiesMatch && facingMatch && propertyMatch && priceMatch && selectedMatch;
  });

// Sorting (apply AFTER filtering, BEFORE pagination)
const sortedProperties = [...filteredProperties].sort((a, b) => {
  switch (sortOption) {
    case "priceDesc": return b.ListPrice - a.ListPrice;
    case "priceAsc": return a.ListPrice - b.ListPrice;
    case "sqmDesc": return b.GrossAreaSQM - a.GrossAreaSQM;
    case "sqmAsc": return a.GrossAreaSQM - b.GrossAreaSQM;
    case "rfoDesc": return new Date(b.RFODate).getTime() - new Date(a.RFODate).getTime();
    case "rfoAsc": return new Date(a.RFODate).getTime() - new Date(b.RFODate).getTime();
    default: return 0; // No sorting applied
  }
});

// Pagination (apply AFTER sorting)
const totalPages = Math.ceil(sortedProperties.length / rowsPerPage);
const paginatedProperties = sortedProperties.slice(
  (currentPage - 1) * rowsPerPage,
  currentPage * rowsPerPage
);

  const toggleUnitSelection = (unitId: string) => {
    const newSet = new Set(selectedUnits);
    if (newSet.has(unitId)) newSet.delete(unitId);
    else newSet.add(unitId);
    setSelectedUnits(newSet);
  };

const sortOptions = [
  { value: "", label: "Default" },
  { value: "priceDesc", label: "Price: High → Low" },
  { value: "priceAsc", label: "Price: Low → High" },
  { value: "sqmDesc", label: "Area: Big → Small" },
  { value: "sqmAsc", label: "Area: Small → Big" },
  { value: "rfoDesc", label: "RFO Date: Newest → Oldest" },
  { value: "rfoAsc", label: "RFO Date: Oldest → Newest" },
];

const glassySelectStyles = {
  control: (provided: any) => ({
    ...provided,
    borderRadius: "1rem",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
    color: "#f8fafc",
  }),
  menu: (provided: any) => ({
    ...provided,
    borderRadius: "1rem",
    marginTop: "6px",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "rgba(30, 64, 175, 0.7)" // deep blue selected
      : state.isFocused
      ? "rgba(250, 204, 21, 0.4)" // gold hover
      : "transparent",
    color: state.isSelected ? "#fff" : "#f1f5f9",
    cursor: "pointer",
  }),
  multiValue: (provided: any) => ({
    ...provided,
    backgroundColor: "rgba(255,255,255,0.25)",
    backdropFilter: "blur(8px)",
    borderRadius: "8px",
  }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    color: "#f1f5f9",
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: "#85909eff",
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: "#f8fafc",
  }),
};


  
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6 text-gray-900 relative">
      <h1 className="text-4xl md:text-5xl font-bold text-center text-blue-800 mb-10">
        Unit Availability
      </h1>

      {loading && <p className="text-center text-gray-500">⏳ Loading units...</p>}
      {error && <p className="text-center text-red-500">❌ {error}</p>}

      {!loading && !error && (
        <div className="flex gap-6">
          {/* Sidebar Filters */}
          <aside className="w-64 space-y-4 bg-white rounded-2xl shadow-md p-4">
            {/* Search box */}
  <input
    type="text"
    placeholder="🔍 Search units..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="w-full px-3 py-2 rounded-xl bg-white/30 backdrop-blur-md border border-white/20 shadow-sm placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
  />

  {/* Filters - glassy react-select */}
  <Select
    isMulti
    options={uniqueProperties.map(p => ({ value: p, label: p }))}
    value={selectedProperty}
    onChange={(val) => setSelectedProperty(val as Option[])}
    placeholder="Property"
    styles={glassySelectStyles}
  />
  <Select
    isMulti
    options={STATUS_OPTIONS}
    value={selectedStatus}
    onChange={(val) => setSelectedStatus(val as Option[])}
    placeholder="Status"
    styles={glassySelectStyles}
  />
  <Select
    isMulti
    options={TYPE_OPTIONS}
    value={selectedType}
    onChange={(val) => setSelectedType(val as Option[])}
    placeholder="Type"
    styles={glassySelectStyles}
  />
  <Select
    isMulti
    options={AMENITIES_OPTIONS}
    value={selectedAmenities}
    onChange={(val) => setSelectedAmenities(val as Option[])}
    placeholder="Amenities"
    styles={glassySelectStyles}
  />
  <Select
    isMulti
    options={FACING_OPTIONS}
    value={selectedFacing}
    onChange={(val) => setSelectedFacing(val as Option[])}
    placeholder="Facing"
    styles={glassySelectStyles}
  />

  {/* Price range */}
  <div className="mt-4">
    <p className="mb-2 font-semibold text-sm text-gray-800">
     <span className="text-blue-900"> Price: 
    ₱{priceRange[0].toLocaleString()} - ₱{priceRange[1].toLocaleString()}
  </span>
    </p>
    <Range
      step={50000}
      min={0}
      max={maxPrice}
      values={priceRange}
      onChange={(values) => setPriceRange(values as [number, number])}
      renderTrack={({ props, children }) => (
        <div
          {...props}
          className="h-2 bg-white/30 backdrop-blur-md rounded-full cursor-pointer border border-white/20"
        >
          {children}
        </div>
      )}
      renderThumb={({ props }) => {
        const { key, ...rest } = props;
        return (
          <div
            key={key}
            {...rest}
            className="h-5 w-5 bg-gradient-to-r from-yellow-400 to-blue-500 rounded-full shadow-lg border-2 border-white"
          />
        );
      }}
    />
  </div>
             {/* Sort By */}
<div className="mt-4">
  <label className="block text-sm font-semibold mb-1 text-gray-700">Sort By</label>
  <Select
  options={sortOptions}
  value={sortOptions.find((o) => o.value === sortOption)}
  onChange={(option) => setSortOption(option?.value || "")}
  placeholder="Select sort option"
  className="text-sm"
  styles={{
    control: (provided) => ({
      ...provided,
      borderRadius: "1rem", // rounder
      border: "1px solid rgba(255, 255, 255, 0.2)",
      backgroundColor: "rgba(255, 255, 255, 0.25)",
      backdropFilter: "blur(10px)", // glass blur
      WebkitBackdropFilter: "blur(10px)",
      boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
      padding: "2px",
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: "1rem",
      marginTop: "4px",
      backgroundColor: "rgba(255, 255, 255, 0.25)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "rgba(30, 64, 175, 0.7)" // deep blue (selected)
        : state.isFocused
        ? "rgba(250, 204, 21, 0.5)" // gold hover
        : "transparent",
      color: state.isSelected ? "#fff" : "#1e293b", // white if selected, dark if not
      cursor: "pointer",
    }),
    placeholder: (provided) => ({
      ...provided,
      color: "#7a838bff", // light text
    }),
    singleValue: (provided) => ({
      ...provided,
      color: "#7a838bff", // light text
    }),
  }}
/>
</div>

            {/* Action Buttons under filters */}
<div className="mt-6 bg-white shadow-md rounded-xl p-4 border border-gray-200">
  <p className="text-sm font-semibold mb-3">
    <span className="text-blue-900">{selectedUnits.size} unit{selectedUnits.size !== 1 ? "s" : ""} selected </span>
  </p>

  {/* Show Compare button only if 2+ selected */}
  {selectedUnits.size > 1 && (
    <Link href="/compare">
      <button
        className="w-full mb-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
      >
        Compare Units
      </button>
    </Link>
  )}

  {/* Show Computation button only if exactly 1 selected */}
{selectedUnits.size === 1 && (() => {
  const selectedUnitId = Array.from(selectedUnits)[0]; // e.g. "Sage-615"
  return (
    <Link href={`/computation/${encodeURIComponent(selectedUnitId)}`}>
      <button
        className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700"
      >
        Computation
      </button>
    </Link>
  );
})()}
</div>


          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Table */}
            <div className="overflow-x-auto rounded-2xl shadow-lg bg-white p-4">
              <table className="w-full border-collapse text-gray-900">
                <thead className="bg-blue-800 text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2">Select</th>
                    {[
                      "Property", "Building Unit", "Tower", "Floor", "Status", "Type",
                      "Gross Area (SQM)", "Amenities", "Facing", "RFO Date", "List Price", "Per SQM"
                    ].map(col => (
                      <th key={col} className="px-4 py-2">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedProperties.map((p, i) => {
                    const unitId = `${p.Property}-${p.BuildingUnit}`;
                    const isSelected = selectedUnits.has(unitId);
                    return (
                      <tr
                        key={unitId}
                        className={`cursor-pointer transition ${
                          i % 2 === 0 ? "bg-gray-50" : "bg-white"
                        } ${isSelected ? "bg-blue-50 ring-2 ring-blue-400" : ""}`}
                        onClick={() => toggleUnitSelection(unitId)}
                      >
                        <td className="px-4 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="h-4 w-4 text-blue-600"
                          />
                        </td>
                        <td className="px-4 py-2 font-semibold">{p.Property}</td>
                        <td className="px-4 py-2">{p.BuildingUnit}</td>
                        <td className="px-4 py-2">{p.Tower}</td>
                        <td className="px-4 py-2">{p.Floor}</td>
                        <td className={`px-4 py-2 font-bold ${
                          p.Status.toLowerCase() === "avail." ? "text-green-500" : "text-red-500"
                        }`}>{p.Status}</td>
                        <td className="px-4 py-2">{p.Type}</td>
                        <td className="px-4 py-2">{p.GrossAreaSQM}</td>
                        <td className="px-4 py-2">{p.Amenities}</td>
                        <td className="px-4 py-2">{p.Facing}</td>
                        <td className="px-4 py-2">{p.RFODate}</td>
                        <td className="px-4 py-2 font-semibold">₱{p.ListPrice.toLocaleString()}</td>
                        <td className="px-4 py-2 font-semibold">₱{p.PerSQM.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <div>
                Show{" "}
                <select
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 border rounded-lg"
                >
                  {PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>{" "}
                rows per page
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 border rounded-lg hover:bg-blue-100" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(pageNum => Math.abs(pageNum - currentPage) <= 2 || pageNum === 1 || pageNum === totalPages)
                  .map(pageNum => (
                    <button
                      key={pageNum}
                      className={`px-3 py-1 border rounded-lg ${
                        pageNum === currentPage ? "bg-blue-600 text-white" : "hover:bg-blue-50"
                      }`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ))}
                <button className="px-3 py-1 border rounded-lg hover:bg-blue-100" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </main>
  );
}
