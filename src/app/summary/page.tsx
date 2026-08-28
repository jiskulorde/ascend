// src/app/summary/page.tsx

"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Range } from "react-range";
import { makeUnitId } from "@/lib/unit-id";
import { RESERVATION_FEE_DEFAULT, DOWNPAYMENT_PERCENT_DEFAULT } from "@/lib/quoteDefaults";

type LastUpdated = {
  date: string;
  time: string;
  fileName?: string;
};

type UnitRow = {
  property_code: string;
  property_name: string;
  city: string;
  address: string;
  tower_code: string;
  tower_name?: string;

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

  unit_id?: string;
};

type ProjectNavItem = {
  property_code: string;
  property_name: string;
  city: string;
  address?: string;
  unitCount: number;
  lowestPrice: number;
};

type DealItem = {
  key: string;
  property_code: string;
  property_name: string;
  city: string;
  address?: string;
  tower_code: string;
  tower_name?: string;
  type: string;
  sizeKey: string;
  sizeLabel: string;
  bestUnit: UnitRow;
  bestPrice: number;
  bestPerSqm: number;
  optionCount: number;
};

type ProjectGroup = {
  header: {
    code: string;
    name: string;
    city: string;
    address?: string;
  };
  rows: DealItem[];
  towerGroups: TowerGroup[];
};

type TowerGroup = {
  towerKey: string;
  towerName: string;
  rows: DealItem[];
  lowestPrice: number;
  lowestPerSqm: number;
};

type StatusMode = "available" | "available_hold" | "hold" | "all";
type SortMode = "project" | "price" | "perSqm" | "size" | "count";
type BestByMode = "price" | "perSqm";
type FloorPreset = "all" | "low" | "mid" | "high";

type SkipFilter =
  | "property"
  | "city"
  | "type"
  | "amenities"
  | "facing"
  | "size"
  | "budget"
  | "floor";

type SelectOption = {
  value: string;
  label: string;
  shortLabel?: string;
};

const TYPE_ORDER = ["STUDIO", "1BR", "2BR", "3BR", "4BR", "LOFT"];
const DEFAULT_FLOOR_RANGE: [number, number] = [0, 80];

const BEST_BY_OPTIONS: SelectOption[] = [
  { value: "price", label: "Lowest total price", shortLabel: "Lowest price" },
  { value: "perSqm", label: "Lowest price / sqm", shortLabel: "Lowest / sqm" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "project", label: "Project A-Z", shortLabel: "Project A-Z" },
  { value: "price", label: "Lowest Price", shortLabel: "Lowest Price" },
  { value: "perSqm", label: "Lowest / sqm", shortLabel: "Lowest / sqm" },
  { value: "size", label: "Smallest Size", shortLabel: "Smallest Size" },
  { value: "count", label: "Most Options", shortLabel: "Most Options" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "available", label: "Available only", shortLabel: "Available" },
  { value: "available_hold", label: "Available + On Hold", shortLabel: "Avail + Hold" },
  { value: "hold", label: "On Hold only", shortLabel: "On Hold" },
  { value: "all", label: "All statuses", shortLabel: "All" },
];

function parseFloorNumber(floor: string): number {
  if (!floor) return 0;
  const n = Number(floor);
  if (Number.isFinite(n)) return n;
  const m = floor.match(/(\d+)(?!.*\d)/);
  if (m) return Number(m[1]);
  return 0;
}

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

function fmtNumber(n: number, decimals = 0) {
  if (!Number.isFinite(n)) return "—";

  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function getUnitNumber(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "—";

  const match = text.match(/(\d+[A-Za-z]?)\s*$/);
  return match?.[1] || text;
}

function parseLastUpdatedText(value: unknown): LastUpdated | null {
  if (typeof value !== "string") return null;

  let clean = value.trim();
  if (!clean) return null;

  if (clean.toLowerCase().startsWith("last updated:")) {
    clean = clean.slice("last updated:".length).trim();
  }

  const separator = clean.includes("•") ? "•" : clean.includes("|") ? "|" : null;
  if (!separator) return null;

  const parts = clean.split(separator).map((part) => part.trim());
  const datePart = parts[0];
  const timePart = parts[1];

  if (!datePart || !timePart) return null;

  return {
    date: datePart,
    time: timePart,
  };
}

function formatLastUpdatedFromDate(value: string | number | Date): LastUpdated | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    date: new Intl.DateTimeFormat("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date),
  };
}

function normalizeLastUpdated(json: any, response?: Response): LastUpdated | null {
  const direct =
    json?.latestLog ||
    json?.lastUpdated ||
    json?.last_update ||
    json?.lastUpdatedText ||
    json?.lastUpdatedDisplay ||
    json?.meta?.lastUpdatedText ||
    json?.data?.[0]?.lastUpdated ||
    json?.data?.[0]?.last_updated ||
    json?.data?.[0]?.updatedAt;

  const textValue = parseLastUpdatedText(direct);
  if (textValue) return textValue;

  if (direct && typeof direct === "object" && direct.date && direct.time) {
    return {
      date: String(direct.date),
      time: String(direct.time),
      fileName: direct.fileName ? String(direct.fileName) : undefined,
    };
  }

  const directDate =
    json?.lastUpdatedDate ||
    json?.dateUpdated ||
    json?.updatedDate ||
    json?.inventoryDate ||
    json?.meta?.lastUpdatedDate;

  const directTime =
    json?.lastUpdatedTime ||
    json?.timeUpdated ||
    json?.updatedTime ||
    json?.inventoryTime ||
    json?.meta?.lastUpdatedTime;

  if (directDate && directTime) {
    return {
      date: String(directDate),
      time: String(directTime),
    };
  }

  const possibleDateValue =
    direct ||
    json?.updatedAt ||
    json?.lastUpdatedAt ||
    json?.last_updated ||
    json?.last_updated_at ||
    json?.generatedAt ||
    json?.meta?.lastUpdated ||
    json?.meta?.updatedAt ||
    json?.meta?.generatedAt ||
    response?.headers.get("x-last-updated") ||
    response?.headers.get("last-modified");

  const possibleTextValue = parseLastUpdatedText(possibleDateValue);
  if (possibleTextValue) return possibleTextValue;

  if (possibleDateValue) return formatLastUpdatedFromDate(possibleDateValue);

  return null;
}

function typeSort(a: string, b: string) {
  const ai = TYPE_ORDER.indexOf(a);
  const bi = TYPE_ORDER.indexOf(b);

  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;

  return ai - bi;
}

function isAvailableStatus(status: string) {
  const st = String(status || "").toLowerCase();
  return st.startsWith("avail");
}

function isOnHoldStatus(status: string) {
  const st = String(status || "").toLowerCase();
  return st.includes("hold");
}

function sizeKeyOf(sqm: number) {
  const safe = Number(sqm || 0);
  if (!Number.isFinite(safe)) return "0";
  return Number.isInteger(safe) ? String(safe) : safe.toFixed(1);
}

function sizeLabelOf(sqm: number) {
  const key = sizeKeyOf(sqm);
  return `${key} sqm`;
}

function includesValue(values: string[], value: string) {
  if (values.length === 0) return true;
  return values.includes(value);
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function clearValues(values: string[], value: string) {
  return values.filter((v) => v !== value);
}

function keepOnlyAvailable(selected: string[], available: string[]) {
  if (selected.length === 0) return selected;

  const next = selected.filter((value) => available.includes(value));

  if (next.length === selected.length && next.every((value, index) => value === selected[index])) {
    return selected;
  }

  return next;
}

function getDealId(u: UnitRow) {
  return (
    u.unit_id ||
    makeUnitId({
      property_code: u.property_code,
      tower_code: u.tower_code,
      building_unit: u.BuildingUnit,
    })
  );
}

export default function PropertySummaryPage() {
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<LastUpdated | null>(null);

  const [statusMode, setStatusMode] = useState<StatusMode>("available");
  const [selectedProjectCodes, setSelectedProjectCodes] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedFacings, setSelectedFacings] = useState<string[]>([]);
  const [floorRange, setFloorRange] = useState<[number, number]>(DEFAULT_FLOOR_RANGE);
  const [sizeRange, setSizeRange] = useState<[number, number]>([0, 0]);
  const [sizeFilterActive, setSizeFilterActive] = useState(false);
  const [maxBudget, setMaxBudget] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [projectQ, setProjectQ] = useState<string>("");
  const [sortMode, setSortMode] = useState<SortMode>("project");
  const [bestBy, setBestBy] = useState<BestByMode>("price");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileProjectOpen, setMobileProjectOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const [discountPct, setDiscountPct] = useState<number>(0);
  const [downPct, setDownPct] = useState<number>(DOWNPAYMENT_PERCENT_DEFAULT);
  const [monthsToPay, setMonthsToPay] = useState<number>(36);
  const [reservationFee, setReservationFee] = useState<number>(RESERVATION_FEE_DEFAULT);
  const [closingFeePct, setClosingFeePct] = useState<number>(10.5);
  const [rate15yr, setRate15yr] = useState<number>(6);
  const [rate20yr, setRate20yr] = useState<number>(6);

  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
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

        if (json.latestLog) {
          setLastUpdated(json.latestLog);
        } else {
          setLastUpdated(normalizeLastUpdated(json, res));
        }
      } catch (e: any) {
        setError(e?.message || "Failed to fetch availability");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxBudgetNumber = Number(maxBudget || 0);
  const hasBudgetFilter = Number.isFinite(maxBudgetNumber) && maxBudgetNumber > 0;

  const matchesStatus = (r: UnitRow) => {
    if (statusMode === "all") return true;
    if (statusMode === "available") return isAvailableStatus(r.Status);
    if (statusMode === "hold") return isOnHoldStatus(r.Status);
    return isAvailableStatus(r.Status) || isOnHoldStatus(r.Status);
  };

  const matchesSearch = (r: UnitRow) => {
    const ql = q.trim().toLowerCase();
    if (!ql) return true;

    const searchable = [
      r.property_name,
      r.property_code,
      r.city,
      r.address,
      r.tower_name,
      r.tower_code,
      r.BuildingUnit,
      getUnitNumber(r.BuildingUnit),
      r.Floor,
      r.Type,
      r.Amenities,
      r.Facing,
      r.RFODate,
      r.ListPrice,
      r.PerSQM,
      r.GrossAreaSQM,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(ql);
  };

  const matchesFilters = (r: UnitRow, skip?: SkipFilter) => {
    if (!matchesStatus(r)) return false;
    if (!matchesSearch(r)) return false;

    if (skip !== "property" && !includesValue(selectedProjectCodes, r.property_code)) return false;
    if (skip !== "city" && !includesValue(selectedCities, r.city)) return false;
    if (skip !== "type" && !includesValue(selectedTypes, r.Type)) return false;
    if (skip !== "amenities" && !includesValue(selectedAmenities, r.Amenities)) return false;
    if (skip !== "facing" && !includesValue(selectedFacings, r.Facing)) return false;

    if (skip !== "floor") {
      const floor = parseFloorNumber(r.Floor);
      if (floor < floorRange[0] || floor > floorRange[1]) return false;
    }

    if (skip !== "budget" && hasBudgetFilter && (r.ListPrice || 0) > maxBudgetNumber) return false;

    if (skip !== "size" && sizeFilterActive) {
      const sqm = r.GrossAreaSQM || 0;
      if (sqm < sizeRange[0] || sqm > sizeRange[1]) return false;
    }

    return true;
  };

  const allProjectNavItems: ProjectNavItem[] = useMemo(() => {
    const m = new Map<string, ProjectNavItem>();

    for (const r of rows) {
      if (!r.property_code || !r.property_name) continue;

      const price =
        Number.isFinite(r.ListPrice) && r.ListPrice > 0 ? r.ListPrice : Number.POSITIVE_INFINITY;

      const existing = m.get(r.property_code);

      if (!existing) {
        m.set(r.property_code, {
          property_code: r.property_code,
          property_name: r.property_name,
          city: r.city,
          address: r.address,
          unitCount: 1,
          lowestPrice: price,
        });
      } else {
        existing.unitCount += 1;
        existing.lowestPrice = Math.min(existing.lowestPrice, price);
      }
    }

    return Array.from(m.values()).sort((a, b) => a.property_name.localeCompare(b.property_name));
  }, [rows]);

  const projectNavItems = useMemo(() => {
    const ql = projectQ.trim().toLowerCase();
    if (!ql) return allProjectNavItems;

    return allProjectNavItems.filter((p) =>
      [p.property_name, p.property_code, p.city, p.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(ql)
    );
  }, [allProjectNavItems, projectQ]);

  const availableCities = useMemo(() => {
    return Array.from(
      new Set(rows.filter((r) => matchesFilters(r, "city")).map((r) => r.city).filter(Boolean))
    ).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows,
    statusMode,
    selectedProjectCodes,
    selectedTypes,
    selectedAmenities,
    selectedFacings,
    floorRange,
    q,
    maxBudget,
    sizeRange,
    sizeFilterActive,
  ]);

  const availableTypes = useMemo(() => {
    return Array.from(
      new Set(rows.filter((r) => matchesFilters(r, "type")).map((r) => r.Type).filter(Boolean))
    ).sort(typeSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows,
    statusMode,
    selectedProjectCodes,
    selectedCities,
    selectedAmenities,
    selectedFacings,
    floorRange,
    q,
    maxBudget,
    sizeRange,
    sizeFilterActive,
  ]);

  const availableAmenities = useMemo(() => {
    return Array.from(
      new Set(rows.filter((r) => matchesFilters(r, "amenities")).map((r) => r.Amenities).filter(Boolean))
    ).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows,
    statusMode,
    selectedProjectCodes,
    selectedCities,
    selectedTypes,
    selectedFacings,
    floorRange,
    q,
    maxBudget,
    sizeRange,
    sizeFilterActive,
  ]);

  const availableFacings = useMemo(() => {
    return Array.from(
      new Set(rows.filter((r) => matchesFilters(r, "facing")).map((r) => r.Facing).filter(Boolean))
    ).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows,
    statusMode,
    selectedProjectCodes,
    selectedCities,
    selectedTypes,
    selectedAmenities,
    floorRange,
    q,
    maxBudget,
    sizeRange,
    sizeFilterActive,
  ]);

  const sizeBounds = useMemo(() => {
    const filtered = rows.filter((r) => matchesFilters(r, "size"));

    if (filtered.length === 0) return { min: 0, max: 0 };

    const sizes = filtered.map((r) => r.GrossAreaSQM || 0).filter((sqm) => sqm > 0);
    if (sizes.length === 0) return { min: 0, max: 0 };

    return {
      min: Math.floor(Math.min(...sizes)),
      max: Math.ceil(Math.max(...sizes)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows,
    statusMode,
    selectedProjectCodes,
    selectedCities,
    selectedTypes,
    selectedAmenities,
    selectedFacings,
    floorRange,
    q,
    maxBudget,
  ]);

  const hasValidSizeBounds = sizeBounds.max > sizeBounds.min;

  useEffect(() => {
    setSizeRange(([lo, hi]) => {
      if (!hasValidSizeBounds) return [0, 0];
      if (!sizeFilterActive) return [sizeBounds.min, sizeBounds.max];

      const nlo = Math.max(sizeBounds.min, Math.min(lo || sizeBounds.min, sizeBounds.max));
      const nhi = Math.max(sizeBounds.min, Math.min(hi || sizeBounds.max, sizeBounds.max));

      if (nlo > nhi) return [sizeBounds.min, sizeBounds.max];
      return [nlo, nhi];
    });
  }, [sizeBounds.min, sizeBounds.max, hasValidSizeBounds, sizeFilterActive]);

  useEffect(() => {
    setSelectedCities((prev) => keepOnlyAvailable(prev, availableCities));
  }, [availableCities]);

  useEffect(() => {
    setSelectedTypes((prev) => keepOnlyAvailable(prev, availableTypes));
  }, [availableTypes]);

  useEffect(() => {
    setSelectedAmenities((prev) => keepOnlyAvailable(prev, availableAmenities));
  }, [availableAmenities]);

  useEffect(() => {
    setSelectedFacings((prev) => keepOnlyAvailable(prev, availableFacings));
  }, [availableFacings]);

  const candidateRows = useMemo(() => rows.filter((r) => matchesFilters(r)), [
    rows,
    statusMode,
    selectedProjectCodes,
    selectedCities,
    selectedTypes,
    selectedAmenities,
    selectedFacings,
    floorRange,
    sizeRange,
    sizeFilterActive,
    maxBudget,
    q,
  ]);

  const deals: DealItem[] = useMemo(() => {
    const map = new Map<string, DealItem>();

    for (const u of candidateRows) {
      const sqm = Number(u.GrossAreaSQM || 0);
      const sizeKey = sizeKeyOf(sqm);
      const key = `${u.property_code}__${u.tower_code}__${u.Type}__${sizeKey}`;
      const unitId = getDealId(u);
      const price = Number(u.ListPrice || 0);
      const perSqm = Number(u.PerSQM || (sqm > 0 ? price / sqm : 0));
      const existing = map.get(key);

      const shouldReplace =
        !existing ||
        (bestBy === "price" && price < existing.bestPrice) ||
        (bestBy === "perSqm" && perSqm < existing.bestPerSqm);

      if (!existing) {
        map.set(key, {
          key,
          property_code: u.property_code,
          property_name: u.property_name,
          city: u.city,
          address: u.address,
          tower_code: u.tower_code,
          tower_name: u.tower_name,
          type: u.Type,
          sizeKey,
          sizeLabel: sizeLabelOf(sqm),
          bestUnit: { ...u, unit_id: unitId },
          bestPrice: price,
          bestPerSqm: perSqm,
          optionCount: 1,
        });
      } else {
        existing.optionCount += 1;
        if (shouldReplace) {
          existing.bestUnit = { ...u, unit_id: unitId };
          existing.bestPrice = price;
          existing.bestPerSqm = perSqm;
        }
      }
    }

    const out = Array.from(map.values());

    out.sort((a, b) => {
      if (sortMode === "price") return a.bestPrice - b.bestPrice;
      if (sortMode === "perSqm") return a.bestPerSqm - b.bestPerSqm;
      if (sortMode === "size") return Number(a.sizeKey) - Number(b.sizeKey);
      if (sortMode === "count") return b.optionCount - a.optionCount;

      if (a.property_name !== b.property_name) return a.property_name.localeCompare(b.property_name);
      const at = a.tower_name || a.tower_code;
      const bt = b.tower_name || b.tower_code;
      if (at !== bt) return at.localeCompare(bt);
      const typeCompare = typeSort(a.type, b.type);
      if (typeCompare !== 0) return typeCompare;
      return Number(a.sizeKey) - Number(b.sizeKey);
    });

    return out;
  }, [candidateRows, bestBy, sortMode]);

  const byProperty = useMemo<ProjectGroup[]>(() => {
    const projectMap = new Map<string, ProjectGroup>();

    for (const deal of deals) {
      const project =
        projectMap.get(deal.property_code) ||
        {
          header: {
            name: deal.property_name,
            city: deal.city,
            address: deal.address,
            code: deal.property_code,
          },
          rows: [],
          towerGroups: [],
        };

      project.rows.push(deal);
      projectMap.set(deal.property_code, project);
    }

    const groups = Array.from(projectMap.values());

    for (const group of groups) {
      const towerMap = new Map<string, TowerGroup>();

      for (const deal of group.rows) {
        const towerKey = `${deal.tower_code}`;
        const existing =
          towerMap.get(towerKey) ||
          {
            towerKey,
            towerName: deal.tower_name || deal.tower_code,
            rows: [],
            lowestPrice: Number.POSITIVE_INFINITY,
            lowestPerSqm: Number.POSITIVE_INFINITY,
          };

        existing.rows.push(deal);
        existing.lowestPrice = Math.min(existing.lowestPrice, deal.bestPrice || Number.POSITIVE_INFINITY);
        existing.lowestPerSqm = Math.min(existing.lowestPerSqm, deal.bestPerSqm || Number.POSITIVE_INFINITY);
        towerMap.set(towerKey, existing);
      }

      group.towerGroups = Array.from(towerMap.values()).sort((a, b) => {
        if (sortMode === "price") return a.lowestPrice - b.lowestPrice;
        if (sortMode === "perSqm") return a.lowestPerSqm - b.lowestPerSqm;
        if (sortMode === "count") return b.rows.length - a.rows.length;
        return a.towerName.localeCompare(b.towerName);
      });
    }

    groups.sort((a, b) => {
      if (sortMode === "price") {
        const ap = Math.min(...a.rows.map((r) => r.bestPrice || Number.POSITIVE_INFINITY));
        const bp = Math.min(...b.rows.map((r) => r.bestPrice || Number.POSITIVE_INFINITY));
        return ap - bp;
      }

      if (sortMode === "perSqm") {
        const ap = Math.min(...a.rows.map((r) => r.bestPerSqm || Number.POSITIVE_INFINITY));
        const bp = Math.min(...b.rows.map((r) => r.bestPerSqm || Number.POSITIVE_INFINITY));
        return ap - bp;
      }

      if (sortMode === "count") return b.rows.length - a.rows.length;

      return a.header.name.localeCompare(b.header.name);
    });

    return groups;
  }, [deals, sortMode]);

  const stats = useMemo(() => {
    const projectCount = new Set(candidateRows.map((r) => r.property_code).filter(Boolean)).size;
    const towerCount = new Set(candidateRows.map((r) => `${r.property_code}-${r.tower_code}`).filter(Boolean)).size;
    const lowest = candidateRows.reduce((min, r) => {
      const price = r.ListPrice || Number.POSITIVE_INFINITY;
      return Math.min(min, price);
    }, Number.POSITIVE_INFINITY);
    const lowestPerSqm = candidateRows.reduce((min, r) => {
      const sqm = r.GrossAreaSQM || 0;
      const perSqm = r.PerSQM || (sqm > 0 ? r.ListPrice / sqm : Number.POSITIVE_INFINITY);
      return Math.min(min, perSqm);
    }, Number.POSITIVE_INFINITY);

    return {
      projectCount,
      towerCount,
      matchingUnits: candidateRows.length,
      lowest,
      lowestPerSqm,
      dealRows: deals.length,
    };
  }, [candidateRows, deals]);

  const selectedProjectNames = useMemo(() => {
    if (selectedProjectCodes.length === 0) return "All Projects";
    const names = selectedProjectCodes
      .map((code) => allProjectNavItems.find((p) => p.property_code === code)?.property_name || code)
      .filter(Boolean);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [selectedProjectCodes, allProjectNavItems]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    count += selectedProjectCodes.length;
    count += selectedCities.length;
    count += selectedTypes.length;
    count += selectedAmenities.length;
    count += selectedFacings.length;
    if (q.trim()) count += 1;
    if (statusMode !== "available") count += 1;
    if (floorRange[0] !== DEFAULT_FLOOR_RANGE[0] || floorRange[1] !== DEFAULT_FLOOR_RANGE[1]) count += 1;
    if (sizeFilterActive) count += 1;
    if (hasBudgetFilter) count += 1;
    return count;
  }, [
    selectedProjectCodes,
    selectedCities,
    selectedTypes,
    selectedAmenities,
    selectedFacings,
    q,
    statusMode,
    floorRange,
    sizeFilterActive,
    hasBudgetFilter,
  ]);

  const resetFilters = () => {
    setSelectedProjectCodes([]);
    setSelectedCities([]);
    setSelectedTypes([]);
    setSelectedAmenities([]);
    setSelectedFacings([]);
    setStatusMode("available");
    setFloorRange(DEFAULT_FLOOR_RANGE);
    setSizeFilterActive(false);
    setSizeRange([0, 0]);
    setMaxBudget("");
    setQ("");
    setProjectQ("");
    setSortMode("project");
    setBestBy("price");
    setOpenRowKey(null);
    setOpenComputeKey(null);
  };

  const setFloorPreset = (preset: FloorPreset) => {
    if (preset === "low") setFloorRange([0, 10]);
    if (preset === "mid") setFloorRange([11, 20]);
    if (preset === "high") setFloorRange([21, 80]);
    if (preset === "all") setFloorRange(DEFAULT_FLOOR_RANGE);
  };

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
    <main className="min-h-screen bg-[#f6f7fb] text-[11px] sm:text-xs md:text-sm">
      <div className="mx-auto max-w-[1680px] px-1.5 py-2 sm:px-3 md:px-6 md:py-6">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[300px_1fr] lg:gap-5 items-start">
          <aside className="card p-0 overflow-hidden lg:sticky lg:top-24">
            <div className="bg-[#0f172a] text-white px-2.5 py-2 sm:px-4 sm:py-4">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div>
                  <div className="text-[9px] sm:text-xs uppercase tracking-wide opacity-70">Inventory Navigation</div>
                  <div className="text-xs sm:text-lg font-semibold">All Projects</div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-0.5 sm:mt-1">
                    Multi-select projects • {allProjectNavItems.length} total
                  </div>
                </div>
                <button
                  className="lg:hidden rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-medium hover:bg-white/20"
                  onClick={() => setMobileProjectOpen((prev) => !prev)}
                >
                  {mobileProjectOpen ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className={`${mobileProjectOpen ? "block" : "hidden"} lg:block`}>
              <div className="p-2 sm:p-3 border-b bg-white space-y-1.5 sm:space-y-3">
                <input
                  className="input h-9 rounded-2xl text-[11px] sm:h-10 sm:text-sm"
                  type="text"
                  value={projectQ}
                  onChange={(e) => setProjectQ(e.target.value)}
                  placeholder="Search project list..."
                />

                <button
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-[11px] sm:text-sm transition ${
                    selectedProjectCodes.length === 0
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    setSelectedProjectCodes([]);
                    setOpenRowKey(null);
                    setOpenComputeKey(null);
                  }}
                >
                  <div className="font-semibold">View All Projects</div>
                  <div className="hidden sm:block text-xs text-muted-foreground">Clear project selection only</div>
                </button>

                {selectedProjectCodes.length > 0 && (
                  <button
                    className="w-full rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-left text-[11px] text-red-700 hover:bg-red-100 sm:text-sm"
                    onClick={() => setSelectedProjectCodes([])}
                  >
                    Clear {selectedProjectCodes.length} selected project{selectedProjectCodes.length === 1 ? "" : "s"}
                  </button>
                )}
              </div>

              <div className="max-h-[36vh] lg:max-h-[calc(100vh-330px)] overflow-y-auto p-1.5 sm:p-2 grid grid-cols-2 gap-1.5 lg:block lg:space-y-2">
                {projectNavItems.map((p) => {
                  const active = selectedProjectCodes.includes(p.property_code);

                  return (
                    <button
                      key={p.property_code}
                      className={`w-full rounded-2xl border px-2 py-2 sm:px-3 sm:py-3 text-left transition ${
                        active
                          ? "bg-[color:var(--primary)] text-white border-[color:var(--primary)] shadow-sm"
                          : "bg-white hover:bg-slate-50 border-slate-200"
                      }`}
                      onClick={() => {
                        setSelectedProjectCodes((prev) => toggleValue(prev, p.property_code));
                        setOpenRowKey(null);
                        setOpenComputeKey(null);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-sm font-semibold leading-tight line-clamp-2 lg:truncate">
                            {p.property_name}
                          </div>
                          <div
                            className={`hidden sm:block text-[10px] sm:text-xs mt-0.5 truncate ${
                              active ? "text-white/80" : "text-muted-foreground"
                            }`}
                          >
                            {p.city || "No city"}
                          </div>
                        </div>
                        <div className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-slate-100"}`}>
                          {active ? "✓" : p.unitCount}
                        </div>
                      </div>
                      <div className={`hidden sm:block text-xs mt-2 ${active ? "text-white/85" : "text-muted-foreground"}`}>
                        Lowest in inventory: <span className="font-semibold">{fmtPhp(p.lowestPrice)}</span>
                      </div>
                    </button>
                  );
                })}

                {projectNavItems.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">No project name matches your sidebar search.</div>
                )}
              </div>
            </div>
          </aside>

          <section className="space-y-2 md:space-y-4 min-w-0">
            <header className="space-y-2 md:space-y-3">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <h1 className="text-base sm:text-2xl md:text-3xl font-semibold">Property Summary</h1>
                  <p className="hidden sm:block text-xs md:text-sm text-muted-foreground mt-1 max-w-4xl">
                    List view by project and building. Click a row to view details, computation, and full unit information.
                  </p>
                  {lastUpdated && (
                    <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground">
                      Last updated: <span className="font-semibold text-slate-700">{lastUpdated.date}</span> • {lastUpdated.time}
                    </p>
                  )}
                </div>

                <div className="card px-2.5 py-2 sm:px-4 sm:py-3 min-w-0 md:min-w-[260px] rounded-2xl">
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Viewing</div>
                  <div className="text-xs sm:text-base font-semibold truncate">{selectedProjectNames}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                    {stats.matchingUnits} units • {stats.dealRows} lowest rows
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1 md:gap-3">
                <StatCard label="Matching Units" value={fmtNumber(stats.matchingUnits)} />
                <StatCard label="Projects Found" value={fmtNumber(stats.projectCount)} />
                <StatCard label="Buildings Found" value={fmtNumber(stats.towerCount)} />
                <StatCard label="Lowest Price" value={fmtPhp(stats.lowest)} />
                <StatCard label="Lowest / sqm" value={`${fmtPhp(stats.lowestPerSqm)}/sqm`} />
              </div>
            </header>

            <div className="card p-2 sm:p-4 space-y-2 sm:space-y-4 rounded-2xl">
              {/* MOBILE CONTROLS */}
              <div className="sm:hidden space-y-2">
                <label className="col-span-3 block rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-2 shadow-[0_12px_30px_rgba(245,158,11,0.16)] ring-1 ring-amber-100 sm:col-span-2 md:col-span-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 sm:text-xs">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white shadow-sm sm:h-5 sm:w-5 sm:text-[10px]">
                        ⌕
                      </span>
                      Fast Search
                    </span>
                  </div>

                  <input
                    className="h-8 w-full rounded-xl border border-amber-300 bg-white px-3 text-[11px] font-medium text-slate-900 shadow-inner outline-none transition placeholder:text-slate-500 hover:border-amber-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100 sm:h-11 sm:text-sm"
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search project, building, unit, type, sqm, facing, price..."
                  />
                </label>

                <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-end">
                  <CompactSelect
                    label="Best"
                    value={bestBy}
                    options={BEST_BY_OPTIONS}
                    onChange={(value) => setBestBy(value as BestByMode)}
                    compact
                  />

                  <CompactSelect
                    label="Sort"
                    value={sortMode}
                    options={SORT_OPTIONS}
                    onChange={(value) => setSortMode(value as SortMode)}
                    compact
                  />

                  <button
                    className={`h-9 rounded-xl border px-3 text-[12px] font-semibold transition ${
                      filtersOpen
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => setFiltersOpen((prev) => !prev)}
                  >
                    {activeFilterCount ? `Filters (${activeFilterCount})` : "Filters"}
                  </button>
                </div>
              </div>

              {/* DESKTOP / TABLET CONTROLS */}
              <div className="hidden sm:grid grid-cols-[1fr_190px_190px_140px] gap-3 items-end">
                <label className="col-span-3 block rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 via-white to-orange-50 p-2 shadow-[0_12px_30px_rgba(245,158,11,0.16)] ring-1 ring-amber-100 sm:col-span-2 md:col-span-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 sm:text-xs">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white shadow-sm sm:h-5 sm:w-5 sm:text-[10px]">
                        ⌕
                      </span>
                      Search
                    </span>
                  </div>

                  <input
                    className="h-8 w-full rounded-xl border border-amber-300 bg-white px-3 text-[11px] font-medium text-slate-900 shadow-inner outline-none transition placeholder:text-slate-500 hover:border-amber-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100 sm:h-11 sm:text-sm"
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search project, building, unit, type, sqm, facing, price..."
                  />
                </label>

                <CompactSelect
                  label="Best"
                  value={bestBy}
                  options={BEST_BY_OPTIONS}
                  onChange={(value) => setBestBy(value as BestByMode)}
                />

                <CompactSelect
                  label="Sort"
                  value={sortMode}
                  options={SORT_OPTIONS}
                  onChange={(value) => setSortMode(value as SortMode)}
                />

                <button
                  className={`h-11 rounded-2xl border px-3 text-sm font-semibold transition ${
                    filtersOpen
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  onClick={() => setFiltersOpen((prev) => !prev)}
                >
                  {filtersOpen ? "Hide Filters" : activeFilterCount ? `Filters (${activeFilterCount})` : "Filters"}
                </button>
              </div>

              {filtersOpen && (
                <div className="space-y-2 sm:space-y-4 rounded-2xl border bg-slate-50 p-2 sm:p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
                    <div>
                      <div className="text-xs sm:text-sm font-semibold">Filters</div>
                      <div className="hidden sm:block text-xs text-muted-foreground">Hidden by default to keep the page clean.</div>
                    </div>
                    <button className="btn btn-outline btn-sm h-8 rounded-2xl px-3 text-[11px] sm:text-xs" onClick={resetFilters}>
                      Reset all
                    </button>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <FilterGroupHeader title="Unit Type" onClear={() => setSelectedTypes([])} hasValue={selectedTypes.length > 0} />
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {availableTypes.map((t) => (
                        <PillButton key={t} active={selectedTypes.includes(t)} onClick={() => setSelectedTypes((prev) => toggleValue(prev, t))}>
                          {t}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <FilterGroupHeader title="Facing" onClear={() => setSelectedFacings([])} hasValue={selectedFacings.length > 0} />
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {availableFacings.map((f) => (
                          <PillButton key={f} active={selectedFacings.includes(f)} onClick={() => setSelectedFacings((prev) => toggleValue(prev, f))}>
                            {f}
                          </PillButton>
                        ))}
                        {availableFacings.length === 0 && <span className="text-xs text-muted-foreground">No facing options</span>}
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <FilterGroupHeader
                        title="Floor"
                        onClear={() => setFloorRange(DEFAULT_FLOOR_RANGE)}
                        hasValue={floorRange[0] !== DEFAULT_FLOOR_RANGE[0] || floorRange[1] !== DEFAULT_FLOOR_RANGE[1]}
                      />
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        <PillButton active={floorRange[0] === 0 && floorRange[1] === 80} onClick={() => setFloorPreset("all")}>
                          All floors
                        </PillButton>
                        <PillButton active={floorRange[0] === 0 && floorRange[1] === 10} onClick={() => setFloorPreset("low")}>
                          Low 0–10F
                        </PillButton>
                        <PillButton active={floorRange[0] === 11 && floorRange[1] === 20} onClick={() => setFloorPreset("mid")}>
                          Mid 11–20F
                        </PillButton>
                        <PillButton active={floorRange[0] === 21 && floorRange[1] === 80} onClick={() => setFloorPreset("high")}>
                          High 21F+
                        </PillButton>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        <input
                          className="input rounded-2xl"
                          type="number"
                          min={0}
                          max={floorRange[1]}
                          value={floorRange[0]}
                          onChange={(e) => {
                            const lo = Math.max(0, Math.min(Number(e.target.value || 0), floorRange[1]));
                            setFloorRange([lo, floorRange[1]]);
                          }}
                        />
                        <input
                          className="input rounded-2xl"
                          type="number"
                          min={floorRange[0]}
                          max={80}
                          value={floorRange[1]}
                          onChange={(e) => {
                            const hi = Math.max(floorRange[0], Math.min(80, Number(e.target.value || 0)));
                            setFloorRange([floorRange[0], hi]);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <FilterGroupHeader
                      title={`Size ${hasValidSizeBounds ? `(${sizeRange[0]} – ${sizeRange[1]} sqm)` : ""}`}
                      onClear={() => setSizeFilterActive(false)}
                      hasValue={sizeFilterActive}
                    />
                    {hasValidSizeBounds ? (
                      <>
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
                            setSizeFilterActive(true);
                            setSizeRange([lo, hi]);
                          }}
                          renderTrack={({ props, children }) => {
                            const { key, ...rest } = (props as any) || {};
                            return (
                              <div key={key} {...rest} className="h-2 rounded-full bg-white border">
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
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <input
                            className="input w-24 rounded-2xl"
                            type="number"
                            value={sizeRange[0]}
                            min={sizeBounds.min}
                            max={sizeRange[1]}
                            onChange={(e) => {
                              setSizeFilterActive(true);
                              setSizeRange([
                                Math.max(sizeBounds.min, Math.min(Number(e.target.value || 0), sizeRange[1])),
                                sizeRange[1],
                              ]);
                            }}
                          />
                          <span className="text-xs text-muted-foreground">to</span>
                          <input
                            className="input w-24 rounded-2xl"
                            type="number"
                            value={sizeRange[1]}
                            min={sizeRange[0]}
                            max={sizeBounds.max}
                            onChange={(e) => {
                              setSizeFilterActive(true);
                              setSizeRange([
                                sizeRange[0],
                                Math.max(sizeRange[0], Math.min(Number(e.target.value || 0), sizeBounds.max)),
                              ]);
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">Size filter unavailable for the current filters.</div>
                    )}
                  </div>

                  <div className="rounded-2xl border bg-white">
                    <button
                      className="flex w-full items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 text-left"
                      onClick={() => setAdvancedOpen((prev) => !prev)}
                    >
                      <div>
                        <div className="text-xs sm:text-sm font-semibold">More Filters</div>
                        <div className="hidden sm:block text-xs text-muted-foreground">City, amenities, status, and budget</div>
                      </div>
                      <span className="text-[11px] sm:text-sm text-muted-foreground">{advancedOpen ? "Hide" : "Show"}</span>
                    </button>

                    {advancedOpen && (
                      <div className="border-t p-2 sm:p-4 space-y-2 sm:space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                          <CompactSelect
                            label="Status"
                            value={statusMode}
                            options={STATUS_OPTIONS}
                            onChange={(value) => setStatusMode(value as StatusMode)}
                            compact
                          />

                          <label className="block text-[11px] sm:text-xs">
                            Max Budget
                            <input
                              className="input mt-0.5 h-9 rounded-2xl text-[11px] sm:mt-1 sm:h-10 sm:text-sm"
                              type="number"
                              value={maxBudget}
                              onChange={(e) => setMaxBudget(e.target.value)}
                              placeholder="e.g. 10000000"
                            />
                          </label>
                        </div>

                        <div className="space-y-1.5 sm:space-y-2">
                          <FilterGroupHeader title="City" onClear={() => setSelectedCities([])} hasValue={selectedCities.length > 0} />
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {availableCities.map((c) => (
                              <PillButton key={c} active={selectedCities.includes(c)} onClick={() => setSelectedCities((prev) => toggleValue(prev, c))}>
                                {c}
                              </PillButton>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5 sm:space-y-2">
                          <FilterGroupHeader title="Amenities" onClear={() => setSelectedAmenities([])} hasValue={selectedAmenities.length > 0} />
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            {availableAmenities.map((a) => (
                              <PillButton
                                key={a}
                                active={selectedAmenities.includes(a)}
                                onClick={() => setSelectedAmenities((prev) => toggleValue(prev, a))}
                              >
                                {a}
                              </PillButton>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-1 border-t pt-2 sm:gap-2 sm:pt-3 text-[10px] sm:text-xs">
                  {selectedProjectCodes.map((code) => {
                    const label = allProjectNavItems.find((p) => p.property_code === code)?.property_name || code;
                    return <FilterChip key={code} label={`Project: ${label}`} onClear={() => setSelectedProjectCodes((prev) => clearValues(prev, code))} />;
                  })}
                  {q.trim() && <FilterChip label={`Search: ${q}`} onClear={() => setQ("")} />}
                  {selectedCities.map((city) => (
                    <FilterChip key={city} label={`City: ${city}`} onClear={() => setSelectedCities((prev) => clearValues(prev, city))} />
                  ))}
                  {selectedTypes.map((type) => (
                    <FilterChip key={type} label={`Type: ${type}`} onClear={() => setSelectedTypes((prev) => clearValues(prev, type))} />
                  ))}
                  {selectedAmenities.map((amenity) => (
                    <FilterChip
                      key={amenity}
                      label={`Amenities: ${amenity}`}
                      onClear={() => setSelectedAmenities((prev) => clearValues(prev, amenity))}
                    />
                  ))}
                  {selectedFacings.map((facing) => (
                    <FilterChip
                      key={facing}
                      label={`Facing: ${facing}`}
                      onClear={() => setSelectedFacings((prev) => clearValues(prev, facing))}
                    />
                  ))}
                  {statusMode !== "available" && (
                    <FilterChip label={`Status: ${statusMode.replace("_", " + ")}`} onClear={() => setStatusMode("available")} />
                  )}
                  {(floorRange[0] !== DEFAULT_FLOOR_RANGE[0] || floorRange[1] !== DEFAULT_FLOOR_RANGE[1]) && (
                    <FilterChip label={`Floor: ${floorRange[0]}F–${floorRange[1]}F`} onClear={() => setFloorRange(DEFAULT_FLOOR_RANGE)} />
                  )}
                  {sizeFilterActive && <FilterChip label={`Size: ${sizeRange[0]}–${sizeRange[1]} sqm`} onClear={() => setSizeFilterActive(false)} />}
                  {hasBudgetFilter && <FilterChip label={`Budget: ≤ ${fmtPhp(maxBudgetNumber)}`} onClear={() => setMaxBudget("")} />}
                </div>
              )}

              <div className="rounded-2xl border bg-white">
                <button
                  className="flex w-full items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 text-left"
                  onClick={() => setCalcOpen((prev) => !prev)}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-semibold">Quick Computation Assumptions</div>
                    <div className="hidden sm:block text-xs text-muted-foreground">Hidden by default</div>
                  </div>
                  <span className="text-[11px] sm:text-sm text-muted-foreground">{calcOpen ? "Hide" : "Show"}</span>
                </button>

                {calcOpen && (
                  <div className="border-t p-2 sm:p-4 grid grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-3 text-[11px] sm:text-sm">
                    <NumberInput label="Discount %" value={discountPct} step={0.1} onChange={setDiscountPct} />
                    <NumberInput label="DP %" value={downPct} step={0.1} onChange={setDownPct} />
                    <NumberInput
                      label="Months"
                      value={monthsToPay}
                      step={1}
                      min={1}
                      onChange={(v) => setMonthsToPay(Math.max(1, Math.floor(v)))}
                    />
                    <NumberInput
                      label="Reservation"
                      value={reservationFee}
                      step={1000}
                      min={0}
                      onChange={(v) => setReservationFee(Math.max(0, Math.floor(v)))}
                    />
                    <NumberInput label="Closing %" value={closingFeePct} step={0.1} onChange={setClosingFeePct} />
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                      <NumberInput label="15 yrs %" value={rate15yr} step={0.1} onChange={setRate15yr} />
                      <NumberInput label="20 yrs %" value={rate20yr} step={0.1} onChange={setRate20yr} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {loading && <div className="card p-4 sm:p-8">Loading…</div>}
            {error && <div className="card p-4 sm:p-8 text-red-600">{error}</div>}

            {!loading && !error && byProperty.length === 0 && (
              <div className="card p-4 sm:p-8 text-muted-foreground">
                No results match your filters. Try clearing size/floor/budget filters or selecting another project.
              </div>
            )}

            {!loading && !error && byProperty.length > 0 && (
              <div className="space-y-3 sm:space-y-6">
                {byProperty.map((group) => {
                  const lowestGroupPrice = Math.min(...group.rows.map((r) => r.bestPrice || Number.POSITIVE_INFINITY));
                  const lowestGroupPerSqm = Math.min(...group.rows.map((r) => r.bestPerSqm || Number.POSITIVE_INFINITY));

                  return (
                    <section key={group.header.code} className="card p-0 overflow-hidden">
                      <div className="bg-[#0f172a] text-white px-3 py-2.5 sm:px-4 sm:py-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
                          <div>
                            <div className="text-sm sm:text-lg font-semibold leading-tight">{group.header.name}</div>
                            <div className="text-[10px] sm:text-xs opacity-90">
                              {group.header.city}
                              {group.header.address ? ` • ${group.header.address}` : ""}
                            </div>
                          </div>
                          <div className="text-[10px] sm:text-xs opacity-90">
                            {group.rows.length} lowest rows • Cheapest {fmtPhp(lowestGroupPrice)} • {fmtPhp(lowestGroupPerSqm)}/sqm
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 bg-slate-100/70 p-1.5 sm:space-y-3 sm:bg-[#f7f9fc] sm:p-2.5">
                        {group.towerGroups.map((tower) => (
                          <div
                            key={tower.towerKey}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                          >
                            <div className="grid grid-cols-1 xl:grid-cols-[170px_1fr]">
                              <div className="border-b xl:border-b-0 xl:border-r bg-slate-50/80 px-3 py-3 sm:px-4">
                                <div className="flex items-start justify-between gap-3 xl:block">
                                  <div className="min-w-0">
                                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-slate-500">Building</div>
                                    <div className="text-[18px] leading-tight font-bold text-slate-900 mt-0.5">{tower.towerName}</div>
                                  </div>

                                  <div className="text-right xl:text-left text-[11px] sm:text-xs text-slate-600 shrink-0 xl:mt-3">
                                    <div>{tower.rows.length} row{tower.rows.length === 1 ? "" : "s"}</div>
                                    <div>
                                      Low <span className="font-semibold text-slate-800">{fmtCompactPhp(tower.lowestPrice)}</span>
                                    </div>
                                    <div>
                                      ₱/sqm <span className="font-semibold text-emerald-700">{fmtCompactPhp(tower.lowestPerSqm)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* MOBILE */}
                              <div className="xl:hidden bg-white">
                                <div className="grid grid-cols-[1.15fr_.7fr_.9fr_.8fr_18px] items-center gap-1 border-b bg-slate-50 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                                  <span>Unit</span>
                                  <span>Type</span>
                                  <span className="text-right">Price</span>
                                  <span className="text-right">₱/sqm</span>
                                  <span className="text-right">+</span>
                                </div>

                                <div className="divide-y divide-slate-100">
                                  {tower.rows.map((deal) => {
                                    const u = deal.bestUnit;
                                    const rowOpen = openRowKey === deal.key;
                                    const computeOpen = openComputeKey === deal.key;
                                    const id = getDealId(u);
                                    const c = computeSample(deal.bestPrice);
                                    const unitNo = getUnitNumber(u.BuildingUnit);

                                    return (
                                      <div key={deal.key} className={rowOpen ? "bg-blue-50/20" : "bg-white"}>
                                        <button
                                          className="grid w-full grid-cols-[1.15fr_.7fr_.9fr_.8fr_18px] items-start gap-1 px-2 py-2 text-left active:bg-slate-50"
                                          onClick={() => setOpenRowKey(rowOpen ? null : deal.key)}
                                        >
                                          <div className="min-w-0">
                                            <div className="truncate text-[13px] font-bold leading-tight text-slate-900">{unitNo}</div>
                                            <div className="truncate text-[10px] leading-tight text-slate-500">
                                              {parseFloorNumber(u.Floor)}F
                                              {u.Facing ? ` • ${u.Facing}` : ""}
                                            </div>
                                          </div>

                                          <div className="min-w-0">
                                            <div className="truncate text-[11px] font-semibold text-slate-800">{deal.type}</div>
                                            <div className="truncate text-[10px] leading-tight text-slate-500">{deal.sizeKey} sqm</div>
                                          </div>

                                          <div className="text-right">
                                            <div className="text-[12px] font-bold leading-tight text-slate-900">
                                              {fmtCompactPhp(deal.bestPrice)}
                                            </div>
                                            <div className="text-[10px] leading-tight text-slate-400">
                                              {deal.optionCount} opt.
                                            </div>
                                          </div>

                                          <div className="text-right">
                                            <div className="text-[11px] font-semibold leading-tight text-emerald-700">
                                              {fmtCompactPhp(deal.bestPerSqm)}
                                            </div>
                                            <div className="text-[9px] leading-tight text-slate-400">/sqm</div>
                                          </div>

                                          <div className={`text-right text-[12px] font-bold ${rowOpen ? "text-slate-500" : "text-blue-700"}`}>
                                            {rowOpen ? "–" : "+"}
                                          </div>
                                        </button>

                                        {rowOpen && (
                                          <div className="border-t bg-white px-2.5 py-2.5">
                                            <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[10px]">
                                              <DetailCell label="Unit #" value={unitNo} />
                                              <DetailCell label="Unit" value={u.BuildingUnit} />
                                              <DetailCell label="Status" value={u.Status || "—"} />
                                              <DetailCell label="RFO" value={u.RFODate || "TBA"} />
                                              <DetailCell label="Amenities" value={u.Amenities || "—"} />
                                              <DetailCell label="Options" value={String(deal.optionCount)} />
                                            </div>

                                            <div className="mt-2.5 grid grid-cols-2 gap-2">
                                              <Link
                                                className="btn btn-outline btn-sm h-8 rounded-2xl w-full px-2 text-[11px]"
                                                href={`/computation/${encodeURIComponent(id)}`}
                                              >
                                                Full computation
                                              </Link>
                                              <button
                                                className="btn btn-ghost btn-sm h-8 rounded-2xl w-full px-2 text-[11px]"
                                                onClick={() => setOpenComputeKey(computeOpen ? null : deal.key)}
                                              >
                                                {computeOpen ? "Hide sample" : "Quick sample"}
                                              </button>
                                            </div>

                                            {computeOpen && (
                                              <div className="mt-2 rounded-xl border bg-slate-50 p-2 text-[10px]">
                                                <div className="grid grid-cols-2 gap-2">
                                                  <ComputeCell label="TCP" value={fmtCompactPhp(c.TCP)} />
                                                  <ComputeCell label={`DP ${downPct}%`} value={fmtCompactPhp(c.dpAmount)} />
                                                  <ComputeCell label="Monthly DP" value={fmtCompactPhp(c.dpMonthly)} />
                                                  <ComputeCell label="Balance" value={fmtCompactPhp(c.bankBalance)} />
                                                  <ComputeCell label="15 yrs" value={fmtCompactPhp(c.monthly15)} />
                                                  <ComputeCell label="20 yrs" value={fmtCompactPhp(c.monthly20)} />
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* DESKTOP */}
                              <div className="hidden xl:block overflow-hidden">
                                <table className="w-full table-fixed text-[13px]">
                                  <thead className="bg-[#28459a] text-white text-[11px] uppercase tracking-wide">
                                    <tr>
                                      <th className="px-3 py-3 text-left font-semibold w-[19%]">Unit</th>
                                      <th className="px-2 py-3 text-left font-semibold w-[9%]">Type</th>
                                      <th className="px-2 py-3 text-left font-semibold w-[10%]">Size</th>
                                      <th className="px-3 py-3 text-right font-semibold w-[15%]">Price</th>
                                      <th className="px-3 py-3 text-right font-semibold w-[14%]">₱/sqm</th>
                                      <th className="px-2 py-3 text-center font-semibold w-[8%]">Floor</th>
                                      <th className="px-3 py-3 text-left font-semibold w-[13%]">Facing</th>
                                      <th className="px-2 py-3 text-center font-semibold w-[6%]">Opt.</th>
                                      <th className="px-3 py-3 text-right font-semibold w-[6%]">View</th>
                                    </tr>
                                  </thead>

                                  <tbody className="divide-y">
                                    {tower.rows.map((deal) => {
                                      const u = deal.bestUnit;
                                      const rowOpen = openRowKey === deal.key;
                                      const computeOpen = openComputeKey === deal.key;
                                      const id = getDealId(u);
                                      const c = computeSample(deal.bestPrice);
                                      const unitNo = getUnitNumber(u.BuildingUnit);

                                      return (
                                        <Fragment key={deal.key}>
                                          <tr className={rowOpen ? "bg-blue-50/40" : "hover:bg-slate-50"}>
                                            <td colSpan={9} className="p-0">
                                              <button
                                                className="grid w-full grid-cols-[19%_9%_10%_15%_14%_8%_13%_6%_6%] items-center text-left"
                                                onClick={() => setOpenRowKey(rowOpen ? null : deal.key)}
                                              >
                                                <span className="px-3 py-3 min-w-0">
                                                  <span className="block text-[16px] font-bold leading-tight text-slate-900">{unitNo}</span>
                                                  <span className="block truncate text-[11px] text-slate-500 mt-0.5">{u.BuildingUnit}</span>
                                                </span>

                                                <span className="px-2 py-3">
                                                  <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                                    {deal.type}
                                                  </span>
                                                </span>

                                                <span className="px-2 py-3 font-medium text-slate-800">{deal.sizeLabel}</span>

                                                <span className="px-3 py-3 text-right font-semibold text-slate-950">
                                                  {fmtPhp(deal.bestPrice)}
                                                </span>

                                                <span className="px-3 py-3 text-right font-semibold text-emerald-700">
                                                  {fmtPhp(deal.bestPerSqm)}/sqm
                                                </span>

                                                <span className="px-2 py-3 text-center text-slate-700">{parseFloorNumber(u.Floor)}F</span>

                                                <span className="px-3 py-3 truncate text-slate-700">{u.Facing || "—"}</span>

                                                <span className="px-2 py-3 text-center text-slate-500">{deal.optionCount}</span>

                                                <span className="px-3 py-3 text-right text-blue-700 font-medium">
                                                  {rowOpen ? "Hide" : "View"}
                                                </span>
                                              </button>

                                              {rowOpen && (
                                                <div className="border-t bg-blue-50/30 px-3 py-3">
                                                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
                                                    <div className="rounded-xl border bg-white p-4">
                                                      <div className="mb-3 text-sm font-semibold">Unit Details</div>
                                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                        <DetailCell label="Project" value={deal.property_name} />
                                                        <DetailCell label="Building" value={tower.towerName} />
                                                        <DetailCell label="Unit #" value={unitNo} />
                                                        <DetailCell label="Unit" value={u.BuildingUnit} />
                                                        <DetailCell label="Status" value={u.Status || "—"} />
                                                        <DetailCell label="Type" value={deal.type} />
                                                        <DetailCell label="Size" value={deal.sizeLabel} />
                                                        <DetailCell label="Floor" value={`${parseFloorNumber(u.Floor)}F`} />
                                                        <DetailCell label="RFO" value={u.RFODate || "TBA"} />
                                                        <DetailCell label="Amenities" value={u.Amenities || "—"} />
                                                        <DetailCell label="Facing" value={u.Facing || "—"} />
                                                        <DetailCell label="Lowest Price" value={fmtPhp(deal.bestPrice)} />
                                                        <DetailCell label="Price / sqm" value={`${fmtPhp(deal.bestPerSqm)}/sqm`} />
                                                      </div>
                                                    </div>

                                                    <div className="rounded-xl border bg-white p-4 space-y-3">
                                                      <Link className="btn btn-outline btn-sm w-full" href={`/computation/${encodeURIComponent(id)}`}>
                                                        Full computation
                                                      </Link>
                                                      <button
                                                        className="btn btn-ghost btn-sm w-full"
                                                        onClick={() => setOpenComputeKey(computeOpen ? null : deal.key)}
                                                      >
                                                        {computeOpen ? "Hide quick sample" : "Show quick sample"}
                                                      </button>
                                                    </div>
                                                  </div>

                                                  {computeOpen && (
                                                    <div className="mt-4 rounded-xl border bg-white p-4 text-sm">
                                                      <div className="mb-3 font-semibold">Quick Sample Computation</div>
                                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        <ComputeCell label={`TCP (disc ${discountPct}%)`} value={fmtPhp(c.TCP)} />
                                                        <ComputeCell label={`DP ${downPct}%`} value={fmtPhp(c.dpAmount)} />
                                                        <ComputeCell label="Reservation" value={fmtPhp(reservationFee)} />
                                                        <ComputeCell label={`Net DP / ${monthsToPay} mos`} value={fmtPhp(c.dpMonthly)} />
                                                        <ComputeCell label={`Closing Fee ${closingFeePct}%`} value={fmtPhp(c.closingFee)} />
                                                        <ComputeCell label="Balance" value={fmtPhp(c.bankBalance)} />
                                                        <ComputeCell label={`15 yrs @ ${rate15yr}%`} value={fmtPhp(c.monthly15)} />
                                                        <ComputeCell label={`20 yrs @ ${rate20yr}%`} value={fmtPhp(c.monthly20)} />
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        </Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function CompactSelect({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <div className={`text-slate-600 ${compact ? "mb-0.5 text-[10px]" : "mb-1 text-xs"}`}>{label}</div>

      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 ${
          compact ? "h-9 text-[12px]" : "h-11 text-sm"
        } ${open ? "border-blue-300 ring-2 ring-blue-100" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate">{compact ? selected.shortLabel || selected.label : selected.label}</span>
        <span className={`ml-2 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_18px_45px_rgba(15,23,42,0.18)] ${
            compact ? "min-w-[170px]" : ""
          }`}
        >
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                } ${compact ? "text-[12px]" : "text-sm"}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="truncate">{option.label}</span>
                <span className={`ml-2 text-xs ${active ? "opacity-100" : "opacity-0"}`}>✓</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card rounded-2xl px-1.5 py-1 sm:px-4 sm:py-3">
      <div className="truncate text-[8px] sm:text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-[10px] sm:text-lg md:text-xl font-semibold">{value}</div>
    </div>
  );
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`rounded-full border px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-xs font-medium transition ${
        active
          ? "bg-[color:var(--primary)] text-white border-[color:var(--primary)] shadow-sm"
          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
      }`}
      onClick={onClick}
    >
      {active ? "✓ " : ""}
      {children}
    </button>
  );
}

function FilterGroupHeader({ title, hasValue, onClear }: { title: string; hasValue: boolean; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[10px] sm:text-xs font-semibold text-slate-700">{title}</div>
      {hasValue && (
        <button className="text-[10px] sm:text-xs text-blue-700 hover:underline" onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      className="rounded-full border bg-white px-2 py-0.5 text-[10px] hover:bg-slate-50 sm:px-3 sm:py-1 sm:text-xs"
      onClick={onClear}
      title="Clear filter"
    >
      {label} <span className="ml-1 text-muted-foreground">×</span>
    </button>
  );
}

function NumberInput({
  label,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-[10px] sm:text-xs">
      {label}
      <input
        className="input mt-0.5 h-8 rounded-2xl text-[11px] sm:mt-1 sm:h-10 sm:text-sm"
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </label>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] sm:text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-[10px] sm:text-sm font-medium">{value}</div>
    </div>
  );
}

function ComputeCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] sm:text-xs text-muted-foreground">{label}</div>
      <div className="text-[10px] sm:text-sm font-semibold">{value}</div>
    </div>
  );
}