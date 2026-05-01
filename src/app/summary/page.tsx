// src/app/summary/page.tsx

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Range } from "react-range";
import { makeUnitId } from "@/lib/unit-id";

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

const TYPE_ORDER = ["STUDIO", "1BR", "2BR", "3BR", "4BR", "LOFT"];
const DEFAULT_FLOOR_RANGE: [number, number] = [0, 80];

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
  const [downPct, setDownPct] = useState<number>(20);
  const [monthsToPay, setMonthsToPay] = useState<number>(36);
  const [reservationFee, setReservationFee] = useState<number>(20000);
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

        // Same source used by the Availability page.
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

      const price = Number.isFinite(r.ListPrice) && r.ListPrice > 0 ? r.ListPrice : Number.POSITIVE_INFINITY;
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
                  className="lg:hidden rounded-md bg-white/10 px-2 py-1 text-[10px] font-medium hover:bg-white/20"
                  onClick={() => setMobileProjectOpen((prev) => !prev)}
                >
                  {mobileProjectOpen ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className={`${mobileProjectOpen ? "block" : "hidden"} lg:block`}>
              <div className="p-2 sm:p-3 border-b bg-white space-y-1.5 sm:space-y-3">
              <input
                className="input h-8 text-[11px] sm:h-10 sm:text-sm"
                type="text"
                value={projectQ}
                onChange={(e) => setProjectQ(e.target.value)}
                placeholder="Search project list..."
              />

              <button
                className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] sm:px-3 sm:py-2 sm:text-sm transition ${
                  selectedProjectCodes.length === 0
                    ? "bg-[#f4f7fb] border-[#d9e2ef] text-[#243b53]"
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
                  className="w-full rounded-md border border-red-100 bg-red-50 px-2 py-1.5 text-left text-[11px] text-red-700 hover:bg-red-100 sm:px-3 sm:py-2 sm:text-sm"
                  onClick={() => setSelectedProjectCodes([])}
                >
                  Clear {selectedProjectCodes.length} selected project{selectedProjectCodes.length === 1 ? "" : "s"}
                </button>
              )}
            </div>

            <div className="max-h-[36vh] lg:max-h-[calc(100vh-330px)] overflow-y-auto p-1.5 sm:p-2 grid grid-cols-2 gap-1 lg:block lg:space-y-2">
              {projectNavItems.map((p) => {
                const active = selectedProjectCodes.includes(p.property_code);

                return (
                  <button
                    key={p.property_code}
                    className={`w-full rounded-md lg:rounded-lg border px-1.5 py-1.5 sm:px-3 sm:py-3 text-left transition ${
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
                        <div className="text-[10px] sm:text-sm font-semibold leading-tight line-clamp-2 lg:truncate">{p.property_name}</div>
                        <div className={`hidden sm:block text-[10px] sm:text-xs mt-0.5 truncate ${active ? "text-white/80" : "text-muted-foreground"}`}>
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
                    <p className="mt-1 text-[10px] font-medium text-slate-500 sm:text-xs">
                      Last updated: <span className="font-semibold text-slate-700">{lastUpdated.date}</span> • {lastUpdated.time}
                    </p>
                  )}
                </div>

                <div className="card px-2.5 py-1.5 sm:px-4 sm:py-3 min-w-0 md:min-w-[260px]">
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

            <div className="card p-1.5 sm:p-4 space-y-1.5 sm:space-y-4">
              <div className="grid grid-cols-[1fr_74px_64px] sm:grid-cols-2 md:grid-cols-[1fr_180px_180px_160px_140px] gap-1 sm:gap-3 items-end">
                <label className="block text-[10px] sm:text-xs col-span-3 sm:col-span-2 md:col-span-2">
                  Fast Search
                  <input
                    className="input mt-0.5 h-7 sm:mt-1 sm:h-11 px-1.5 text-[10px] sm:text-sm"
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search project, building, unit, type, sqm, facing, price..."
                  />
                </label>

                <label className="block text-[10px] sm:text-xs">
                  Best
                  <select className="input mt-0.5 h-7 sm:mt-1 sm:h-11 px-1.5 text-[10px] sm:text-sm" value={bestBy} onChange={(e) => setBestBy(e.target.value as BestByMode)}>
                    <option value="price">Lowest total price</option>
                    <option value="perSqm">Lowest price / sqm</option>
                  </select>
                </label>

                <label className="block text-[10px] sm:text-xs">
                  Sort
                  <select className="input mt-0.5 h-7 sm:mt-1 sm:h-11 px-1.5 text-[10px] sm:text-sm" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
                    <option value="project">Project A-Z</option>
                    <option value="price">Lowest Price</option>
                    <option value="perSqm">Lowest / sqm</option>
                    <option value="size">Smallest Size</option>
                    <option value="count">Most Options</option>
                  </select>
                </label>

                <button
                  className={`btn h-7 sm:h-11 px-1 text-[10px] sm:px-2 sm:text-sm ${filtersOpen ? "btn-outline" : "btn-ghost"}`}
                  onClick={() => setFiltersOpen((prev) => !prev)}
                >
                  {filtersOpen ? "Hide Filters" : `Filters ${activeFilterCount ? `(${activeFilterCount})` : ""}`}
                </button>
              </div>

              {filtersOpen && (
                <div className="space-y-2 sm:space-y-4 rounded-xl sm:rounded-2xl border bg-slate-50 p-2 sm:p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
                    <div>
                      <div className="text-xs sm:text-sm font-semibold">Filters</div>
                      <div className="hidden sm:block text-xs text-muted-foreground">Hidden by default to keep the page clean.</div>
                    </div>
                    <button className="btn btn-outline btn-sm h-7 px-2 text-[11px] sm:h-8 sm:text-xs" onClick={resetFilters}>Reset all</button>
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
                      <FilterGroupHeader title="Floor" onClear={() => setFloorRange(DEFAULT_FLOOR_RANGE)} hasValue={floorRange[0] !== DEFAULT_FLOOR_RANGE[0] || floorRange[1] !== DEFAULT_FLOOR_RANGE[1]} />
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        <PillButton active={floorRange[0] === 0 && floorRange[1] === 80} onClick={() => setFloorPreset("all")}>All floors</PillButton>
                        <PillButton active={floorRange[0] === 0 && floorRange[1] === 10} onClick={() => setFloorPreset("low")}>Low 0–10F</PillButton>
                        <PillButton active={floorRange[0] === 11 && floorRange[1] === 20} onClick={() => setFloorPreset("mid")}>Mid 11–20F</PillButton>
                        <PillButton active={floorRange[0] === 21 && floorRange[1] === 80} onClick={() => setFloorPreset("high")}>High 21F+</PillButton>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        <input
                          className="input"
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
                          className="input"
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
                    <FilterGroupHeader title={`Size ${hasValidSizeBounds ? `(${sizeRange[0]} – ${sizeRange[1]} sqm)` : ""}`} onClear={() => setSizeFilterActive(false)} hasValue={sizeFilterActive} />
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
                            return <div key={key} {...rest} className="h-2 rounded-full bg-white border">{children}</div>;
                          }}
                          renderThumb={({ props }) => {
                            const { key, ...rest } = (props as any) || {};
                            return <div key={key} {...rest} className="h-4 w-4 rounded-full bg-[color:var(--primary)] shadow" aria-label="sqm handle" />;
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <input
                            className="input w-24"
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
                            className="input w-24"
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

                  <div className="rounded-xl sm:rounded-2xl border bg-white">
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 sm:px-4 sm:py-3 text-left"
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
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-2 sm:gap-4">
                          <label className="block text-[11px] sm:text-xs">
                            Status
                            <select className="input mt-0.5 h-8 text-[11px] sm:mt-1 sm:h-10 sm:text-sm" value={statusMode} onChange={(e) => setStatusMode(e.target.value as StatusMode)}>
                              <option value="available">Available only</option>
                              <option value="available_hold">Available + On Hold</option>
                              <option value="hold">On Hold only</option>
                              <option value="all">All statuses</option>
                            </select>
                          </label>

                          <label className="block text-[11px] sm:text-xs">
                            Max Budget
                            <input
                              className="input mt-0.5 h-8 text-[11px] sm:mt-1 sm:h-10 sm:text-sm"
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
                              <PillButton key={a} active={selectedAmenities.includes(a)} onClick={() => setSelectedAmenities((prev) => toggleValue(prev, a))}>
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
                  {selectedCities.map((city) => <FilterChip key={city} label={`City: ${city}`} onClear={() => setSelectedCities((prev) => clearValues(prev, city))} />)}
                  {selectedTypes.map((type) => <FilterChip key={type} label={`Type: ${type}`} onClear={() => setSelectedTypes((prev) => clearValues(prev, type))} />)}
                  {selectedAmenities.map((amenity) => <FilterChip key={amenity} label={`Amenities: ${amenity}`} onClear={() => setSelectedAmenities((prev) => clearValues(prev, amenity))} />)}
                  {selectedFacings.map((facing) => <FilterChip key={facing} label={`Facing: ${facing}`} onClear={() => setSelectedFacings((prev) => clearValues(prev, facing))} />)}
                  {statusMode !== "available" && <FilterChip label={`Status: ${statusMode.replace("_", " + ")}`} onClear={() => setStatusMode("available")} />}
                  {(floorRange[0] !== DEFAULT_FLOOR_RANGE[0] || floorRange[1] !== DEFAULT_FLOOR_RANGE[1]) && (
                    <FilterChip label={`Floor: ${floorRange[0]}F–${floorRange[1]}F`} onClear={() => setFloorRange(DEFAULT_FLOOR_RANGE)} />
                  )}
                  {sizeFilterActive && <FilterChip label={`Size: ${sizeRange[0]}–${sizeRange[1]} sqm`} onClear={() => setSizeFilterActive(false)} />}
                  {hasBudgetFilter && <FilterChip label={`Budget: ≤ ${fmtPhp(maxBudgetNumber)}`} onClear={() => setMaxBudget("")} />}
                </div>
              )}

              <div className="rounded-xl sm:rounded-2xl border bg-white">
                <button
                  className="flex w-full items-center justify-between px-3 py-2 sm:px-4 sm:py-3 text-left"
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
                    <NumberInput label="Months" value={monthsToPay} step={1} min={1} onChange={(v) => setMonthsToPay(Math.max(1, Math.floor(v)))} />
                    <NumberInput label="Reservation" value={reservationFee} step={1000} min={0} onChange={(v) => setReservationFee(Math.max(0, Math.floor(v)))} />
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
                      <div className="bg-[#0f172a] text-white px-3 py-2 sm:px-4 sm:py-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
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

                      <div className="space-y-2 bg-[#f3f6fb] p-1.5 sm:space-y-4 sm:bg-[#f6f8fb] sm:p-3">
                        {group.towerGroups.map((tower) => (
                          <div key={tower.towerKey} className="overflow-hidden rounded-lg border border-[#dbe4ef] bg-white shadow-sm sm:rounded-2xl sm:border-[#dbe4ef] sm:shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                            <div className="grid grid-cols-1 xl:grid-cols-[210px_1fr] border-l-4 border-[#b8c7dc]">
                              <div className="bg-[#f8fafc] px-2 py-1.5 sm:px-4 sm:py-4 xl:border-r xl:border-[#dbe4ef]">
                                <div className="flex items-center justify-between gap-2 xl:block">
                                  <div className="min-w-0">
                                    <div className="text-[8px] sm:text-xs uppercase tracking-wide text-[#64748b]">Building</div>
                                    <div className="truncate text-[12px] font-bold leading-tight text-slate-900 sm:text-base">{tower.towerName}</div>
                                  </div>
                                  <div className="shrink-0 text-right text-[9px] leading-tight text-slate-600 sm:mt-2 sm:text-left sm:text-xs">
                                    <div>{tower.rows.length} row{tower.rows.length === 1 ? "" : "s"}</div>
                                    <div>Low <span className="font-semibold text-slate-800">{fmtCompactPhp(tower.lowestPrice)}</span></div>
                                    <div>₱/sqm <span className="font-semibold text-emerald-700">{fmtCompactPhp(tower.lowestPerSqm)}</span></div>
                                  </div>
                                </div>
                              </div>

                              <div className="xl:hidden text-[10px]">
                                <div className="grid grid-cols-[44px_minmax(0,1.05fr)_minmax(0,0.9fr)_48px_22px] items-center gap-1 border-b border-[#d9e2ef] bg-[#f4f7fb] px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-[#64748b]">
                                  <span>Type</span>
                                  <span className="text-right">Price</span>
                                  <span className="text-right">₱/sqm</span>
                                  <span className="text-center">Flr/Face</span>
                                  <span className="text-right">+</span>
                                </div>

                                <div className="divide-y">
                                  {tower.rows.map((deal) => {
                                    const u = deal.bestUnit;
                                    const rowOpen = openRowKey === deal.key;
                                    const computeOpen = openComputeKey === deal.key;
                                    const id = getDealId(u);
                                    const c = computeSample(deal.bestPrice);

                                    return (
                                      <div key={deal.key} className={rowOpen ? "bg-[#f4f7fb]" : "bg-white"}>
                                        <button
                                          className="grid w-full grid-cols-[44px_minmax(0,1.05fr)_minmax(0,0.9fr)_48px_22px] items-center gap-1 px-2 py-1.5 text-left hover:bg-[#f8fafc]"
                                          onClick={() => setOpenRowKey(rowOpen ? null : deal.key)}
                                        >
                                          <span className="min-w-0 rounded-md border border-[#d9e2ef] bg-[#f8fafc] px-1 py-0.5">
                                            <span className="block truncate text-[10px] font-bold leading-tight text-[#243b53]">{deal.type}</span>
                                            <span className="block truncate text-[8px] leading-tight text-slate-500">{deal.sizeLabel.replace(" sqm", "")}</span>
                                          </span>
                                          <span className="truncate text-right text-[11px] font-bold text-slate-950">{fmtCompactPhp(deal.bestPrice)}</span>
                                          <span className="truncate text-right text-[10px] font-semibold text-emerald-700">{fmtCompactPhp(deal.bestPerSqm)}</span>
                                          <span className="text-center text-[8px] leading-tight text-slate-600">
                                            <span className="block font-semibold text-slate-800">{parseFloorNumber(u.Floor)}F</span>
                                            <span className="block truncate">{u.Facing || "—"}</span>
                                          </span>
                                          <span className={`text-right text-[12px] font-bold ${rowOpen ? "text-slate-500" : "text-[#64748b]"}`}>{rowOpen ? "–" : "+"}</span>
                                        </button>

                                        {rowOpen && (
                                          <div className="border-t border-[#d9e2ef] bg-[#f4f7fb] px-1.5 py-2">
                                            <div className="rounded-md border border-[#d9e2ef] bg-white p-2">
                                              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                                                <DetailCell label="Unit" value={u.BuildingUnit} />
                                                <DetailCell label="Status" value={u.Status || "—"} />
                                                <DetailCell label="RFO" value={u.RFODate || "TBA"} />
                                                <DetailCell label="Bldg" value={tower.towerName} />
                                                <DetailCell label="Amenity" value={u.Amenities || "—"} />
                                                <DetailCell label="Options" value={String(deal.optionCount)} />
                                              </div>

                                              <div className="mt-2 grid grid-cols-2 gap-1.5">
                                                <Link className="btn btn-outline btn-sm h-7 w-full px-1 text-[10px]" href={`/computation/${encodeURIComponent(id)}`}>
                                                  Full computation
                                                </Link>
                                                <button
                                                  className="btn btn-ghost btn-sm h-7 w-full px-1 text-[10px]"
                                                  onClick={() => setOpenComputeKey(computeOpen ? null : deal.key)}
                                                >
                                                  {computeOpen ? "Hide sample" : "Quick sample"}
                                                </button>
                                              </div>
                                            </div>

                                            {computeOpen && (
                                              <div className="mt-1.5 rounded-md border border-[#d9e2ef] bg-white p-2 text-[10px]">
                                                <div className="grid grid-cols-2 gap-1.5">
                                                  <ComputeCell label={`TCP`} value={fmtCompactPhp(c.TCP)} />
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

                              <div className="hidden xl:block overflow-hidden bg-white">
                                <table className="w-full table-fixed text-xs">
                                  <thead className="border-b border-[#d9e2ef] bg-[#f4f7fb] text-[10px] uppercase tracking-[0.06em] text-[#243b53]">
                                    <tr>
                                      <th className="w-[6%] px-2 py-2 text-left font-bold">Type</th>
                                      <th className="w-[8%] px-2 py-2 text-left font-bold">Size</th>
                                      <th className="w-[14%] px-2 py-2 text-right font-bold">Price</th>
                                      <th className="w-[14%] px-2 py-2 text-right font-bold">₱/sqm</th>
                                      <th className="w-[17%] px-2 py-2 text-left font-bold">Unit</th>
                                      <th className="w-[7%] px-2 py-2 text-center font-bold">Floor</th>
                                      <th className="w-[13%] px-2 py-2 text-left font-bold">Facing</th>
                                      <th className="w-[7%] px-2 py-2 text-center font-bold">Opt.</th>
                                      <th className="w-[14%] px-2 py-2 text-right font-bold">View</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {tower.rows.map((deal) => {
                                      const u = deal.bestUnit;
                                      const rowOpen = openRowKey === deal.key;
                                      const computeOpen = openComputeKey === deal.key;
                                      const id = getDealId(u);
                                      const c = computeSample(deal.bestPrice);

                                      return (
                                        <Fragment key={deal.key}>
                                          <tr
                                            className={`cursor-pointer ${rowOpen ? "bg-[#f4f7fb]" : "bg-white hover:bg-[#f8fafc]"}`}
                                            onClick={() => setOpenRowKey(rowOpen ? null : deal.key)}
                                          >
                                            <td className="w-[6%] px-2 py-2.5 align-middle">
                                              <span className="inline-flex rounded-full border border-[#d9e2ef] bg-[#f8fafc] px-2 py-0.5 text-[11px] font-bold text-[#243b53]">
                                                {deal.type}
                                              </span>
                                            </td>
                                            <td className="w-[8%] px-2 py-2.5 align-middle font-semibold text-slate-800">
                                              {deal.sizeLabel}
                                            </td>
                                            <td className="w-[14%] px-2 py-2.5 text-right align-middle font-bold text-slate-950">
                                              {fmtPhp(deal.bestPrice)}
                                            </td>
                                            <td className="w-[14%] px-2 py-2.5 text-right align-middle font-semibold text-emerald-700">
                                              {fmtPhp(deal.bestPerSqm)}/sqm
                                            </td>
                                            <td className="w-[17%] truncate px-2 py-2.5 align-middle text-slate-600">
                                              {u.BuildingUnit}
                                            </td>
                                            <td className="w-[7%] px-2 py-2.5 text-center align-middle font-medium text-slate-700">
                                              {parseFloorNumber(u.Floor)}F
                                            </td>
                                            <td className="w-[13%] truncate px-2 py-2.5 align-middle text-slate-700">
                                              {u.Facing || "—"}
                                            </td>
                                            <td className="w-[7%] px-2 py-2.5 text-center align-middle text-slate-500">
                                              {deal.optionCount}
                                            </td>
                                            <td className="w-[14%] px-2 py-2.5 text-right align-middle">
                                              <button
                                                type="button"
                                                className="font-semibold text-[#64748b] hover:text-[#0f172a]"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  setOpenRowKey(rowOpen ? null : deal.key);
                                                }}
                                              >
                                                {rowOpen ? "Hide" : "View"}
                                              </button>
                                            </td>
                                          </tr>

                                          {rowOpen && (
                                            <tr className="bg-[#f4f7fb]">
                                              <td colSpan={9} className="border-t border-[#d9e2ef] px-2.5 py-2.5 sm:px-4 sm:py-4">
                                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
                                                  <div className="rounded-lg border bg-white p-3">
                                                    <div className="mb-2 text-sm font-semibold">Unit Details</div>
                                                    <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                                                      <DetailCell label="Project" value={deal.property_name} />
                                                      <DetailCell label="Building" value={tower.towerName} />
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

                                                  <div className="rounded-xl border border-[#d9e2ef] bg-white p-3 space-y-2">
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
                                                  <div className="mt-3 rounded-xl border border-[#d9e2ef] bg-white p-3 text-sm">
                                                    <div className="mb-2 font-semibold">Quick Sample Computation</div>
                                                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
                                              </td>
                                            </tr>
                                          )}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-1.5 py-1 sm:px-4 sm:py-3">
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
        className="input mt-0.5 h-8 text-[11px] sm:mt-1 sm:h-10 sm:text-sm"
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
