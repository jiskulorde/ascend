// src/components/shortlists/ShortlistDetailClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, AlertCircle, FolderOpen, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { matchesLegacyOrCanonical } from "@/lib/unit-id";
import { rtoTypeCandidates } from "@/lib/financing";
import type { AvailabilityRow, ClientShortlist, RtoInfo, ShortlistUnit, UnitMode } from "@/lib/shortlists/types";
import ShortlistFormDialog from "@/components/shortlists/ShortlistFormDialog";
import EditUnitNoteDialog from "@/components/shortlists/EditUnitNoteDialog";
import RemoveUnitDialog from "@/components/shortlists/RemoveUnitDialog";
import UnitCard from "@/components/shortlists/UnitCard";

type LoadState = "loading" | "ready" | "unauthorized" | "forbidden" | "not_found" | "error";
type AvailabilityState = "loading" | "ready" | "error";

const MAX_COMPARE = 6;
const SELECTED_UNITS_KEY = "selectedUnits";

function rtoKeyFor(row: AvailabilityRow): string {
  return `${row.property_code}::${row.GrossAreaSQM}::${rtoTypeCandidates(row.Type).join("|")}`;
}

function unitLabel(unit: ShortlistUnit, current: AvailabilityRow | undefined): string {
  if (current) return `${current.property_name} • ${current.BuildingUnit}`;
  return `${unit.property_code} • ${unit.building_unit}`;
}

export default function ShortlistDetailClient({ shortlistId }: { shortlistId: string }) {
  const router = useRouter();

  const [shortlist, setShortlist] = useState<ClientShortlist | null>(null);
  const [units, setUnits] = useState<ShortlistUnit[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>([]);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("loading");

  const [editShortlistOpen, setEditShortlistOpen] = useState(false);
  const [editNoteTarget, setEditNoteTarget] = useState<ShortlistUnit | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ShortlistUnit | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [rtoByKey, setRtoByKey] = useState<Record<string, RtoInfo>>({});
  const [rtoLoadingKeys, setRtoLoadingKeys] = useState<Set<string>>(new Set());

  const loadShortlist = useCallback(async () => {
    setLoadState("loading");
    try {
      const res = await fetch(`/api/shortlists/${shortlistId}`, { cache: "no-store" });
      if (res.status === 401) {
        setLoadState("unauthorized");
        return;
      }
      if (res.status === 403) {
        setLoadState("forbidden");
        return;
      }
      if (res.status === 404) {
        setLoadState("not_found");
        return;
      }
      if (!res.ok) {
        setLoadState("error");
        return;
      }
      const json = await res.json();
      setShortlist(json.shortlist as ClientShortlist);
      setUnits(Array.isArray(json.units) ? (json.units as ShortlistUnit[]) : []);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [shortlistId]);

  const loadAvailability = useCallback(async () => {
    setAvailabilityState("loading");
    try {
      const res = await fetch("/api/availability", { cache: "no-store" });
      if (!res.ok) {
        setAvailabilityState("error");
        return;
      }
      const json = await res.json();
      const rows: AvailabilityRow[] = Array.isArray(json.data) ? json.data : [];
      setAvailabilityRows(rows);
      setAvailabilityState("ready");
    } catch {
      setAvailabilityState("error");
    }
  }, []);

  useEffect(() => {
    loadShortlist();
  }, [loadShortlist]);

  useEffect(() => {
    // Current-inventory fetch failure is independent of the saved shortlist load —
    // it must never block or clear the already-loaded saved snapshot data.
    loadAvailability();
  }, [loadAvailability]);

  // ---------------- Match saved units against current inventory
  const findCurrent = useCallback(
    (u: ShortlistUnit): AvailabilityRow | undefined =>
      availabilityRows.find((r) =>
        matchesLegacyOrCanonical(
          { property_code: r.property_code, tower_code: r.tower_code, building_unit: r.BuildingUnit },
          u.unit_id
        )
      ),
    [availabilityRows]
  );

  const entries = useMemo(
    () => units.map((unit) => ({ unit, current: findCurrent(unit) })),
    [units, findCurrent]
  );

  function modeFor(current: AvailabilityRow | undefined): UnitMode {
    if (current) return "matched";
    if (availabilityState === "ready") return "missing";
    if (availabilityState === "error") return "unavailable";
    return "checking";
  }

  // ---------------- RTO — only for matched units, deduped by (project, area, type-candidates)
  // so a shortlist with many units of the same layout only triggers one lookup per layout,
  // not one per unit.
  useEffect(() => {
    const uniqueByKey = new Map<string, AvailabilityRow>();
    entries.forEach(({ current }) => {
      if (!current) return;
      const key = rtoKeyFor(current);
      if (!uniqueByKey.has(key)) uniqueByKey.set(key, current);
    });

    const pending = Array.from(uniqueByKey.entries()).filter(
      ([key]) => !(key in rtoByKey) && !rtoLoadingKeys.has(key)
    );
    if (!pending.length) return;

    let cancelled = false;
    setRtoLoadingKeys((prev) => {
      const next = new Set(prev);
      pending.forEach(([key]) => next.add(key));
      return next;
    });

    (async () => {
      try {
        const results = await Promise.all(
          pending.map(async ([key, row]) => {
            const candidates = rtoTypeCandidates(row.Type);
            for (const unit_type of candidates) {
              const qs = new URLSearchParams({
                project_code: row.property_code,
                unit_type,
                area: String(row.GrossAreaSQM || 0),
              });
              try {
                const res = await fetch(`/api/rto-rate?${qs.toString()}`, { cache: "no-store" });
                if (!res.ok) continue;
                const json = await res.json();
                if (json?.eligible) {
                  return [
                    key,
                    { eligible: true, monthly: Number(json.monthly_rate) || 0, memo: json.memo_ref || null },
                  ] as const;
                }
              } catch {
                // try next candidate
              }
            }
            return [key, { eligible: false }] as const;
          })
        );

        if (cancelled) return;
        setRtoByKey((prev) => {
          const next = { ...prev };
          results.forEach(([key, info]) => {
            next[key] = info;
          });
          return next;
        });
      } finally {
        setRtoLoadingKeys((prev) => {
          const next = new Set(prev);
          pending.forEach(([key]) => next.delete(key));
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entries, rtoByKey, rtoLoadingKeys]);

  // ---------------- Selection + Compare handoff
  function toggleSelect(shortlistUnitId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(shortlistUnitId)) {
        next.delete(shortlistUnitId);
      } else if (next.size < MAX_COMPARE) {
        next.add(shortlistUnitId);
      }
      return next;
    });
  }

  function handleCompareSelected() {
    const ids = entries
      .filter(({ unit, current }) => current && selectedIds.has(unit.id))
      .map(({ current }) => current!.unit_id);
    if (!ids.length) return;
    try {
      localStorage.setItem(SELECTED_UNITS_KEY, JSON.stringify(ids));
    } catch {
      // localStorage unavailable (private mode, quota) — Compare will just load with nothing pre-selected.
    }
    router.push("/compare");
  }

  function handleUnitRemoved(shortlistUnitId: string) {
    setUnits((prev) => prev.filter((u) => u.id !== shortlistUnitId));
    setSelectedIds((prev) => {
      if (!prev.has(shortlistUnitId)) return prev;
      const next = new Set(prev);
      next.delete(shortlistUnitId);
      return next;
    });
  }

  function handleUnitNoteSaved(updated: ShortlistUnit) {
    setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  // ---------------- Render
  if (loadState === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-72 animate-pulse bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  if (loadState === "unauthorized") {
    return (
      <PageStatus
        icon={<AlertCircle className="h-6 w-6 text-destructive" />}
        title="Your session has expired"
        description="Please sign in again to view this shortlist."
        action={<Button onClick={() => router.push(`/auth/login?next=/shortlists/${shortlistId}`)}>Sign in</Button>}
      />
    );
  }

  if (loadState === "forbidden") {
    return (
      <PageStatus
        icon={<AlertCircle className="h-6 w-6 text-destructive" />}
        title="You don't have access to this shortlist"
        description="Only the seller who created a shortlist can view it."
        action={<BackLink />}
      />
    );
  }

  if (loadState === "not_found") {
    return (
      <PageStatus
        icon={<FolderOpen className="h-6 w-6 text-muted-foreground" />}
        title="Shortlist not found"
        description="It may have been deleted, or the link is incorrect."
        action={<BackLink />}
      />
    );
  }

  if (loadState === "error" || !shortlist) {
    return (
      <PageStatus
        icon={<AlertCircle className="h-6 w-6 text-destructive" />}
        title="Couldn't load this shortlist"
        description="Something went wrong. Please try again."
        action={
          <Button variant="outline" onClick={loadShortlist}>
            Retry
          </Button>
        }
      />
    );
  }

  const selectableCount = selectedIds.size;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/shortlists"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Client Shortlists
      </Link>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {shortlist.name}
          </h1>
          {shortlist.notes && <p className="mt-1 text-sm text-muted-foreground">{shortlist.notes}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {units.length} unit{units.length !== 1 ? "s" : ""} saved
            {shortlist.updated_at && ` • Updated ${format(new Date(shortlist.updated_at), "MMM d, yyyy")}`}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => setEditShortlistOpen(true)} className="shrink-0">
          <Pencil className="h-3.5 w-3.5" />
          Edit shortlist
        </Button>
      </div>

      {availabilityState === "error" && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>Could not load current inventory. Saved snapshot data below is still accurate.</span>
          <Button variant="outline" size="sm" onClick={loadAvailability} className="h-7 shrink-0 px-2 text-xs">
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {units.length === 0 ? (
        <div className="mt-6">
          <PageStatus
            icon={<FolderOpen className="h-6 w-6 text-muted-foreground" />}
            title="Nothing saved yet"
            description="Units you save from Availability, Compare, and other tools will show up here in a later phase."
            inline
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(({ unit, current }) => {
            const mode = modeFor(current);
            const rtoKey = current ? rtoKeyFor(current) : null;
            return (
              <UnitCard
                key={unit.id}
                unit={unit}
                current={current}
                mode={mode}
                rtoInfo={rtoKey ? rtoByKey[rtoKey] : undefined}
                rtoLoading={rtoKey ? rtoLoadingKeys.has(rtoKey) : false}
                selected={selectedIds.has(unit.id)}
                selectable={mode === "matched" && (selectedIds.has(unit.id) || selectedIds.size < MAX_COMPARE)}
                onToggleSelect={() => toggleSelect(unit.id)}
                onEditNote={() => setEditNoteTarget(unit)}
                onRemove={() => setRemoveTarget(unit)}
              />
            );
          })}
        </div>
      )}

      {selectableCount > 0 && (
        <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
          <span className="text-xs font-medium text-muted-foreground">
            {selectableCount} of {MAX_COMPARE} selected
          </span>
          <Button size="sm" onClick={handleCompareSelected}>
            Compare Selected
          </Button>
        </div>
      )}

      <ShortlistFormDialog
        open={editShortlistOpen}
        onOpenChange={setEditShortlistOpen}
        target={shortlist}
        onSaved={(updated) => setShortlist(updated)}
      />

      <EditUnitNoteDialog
        open={!!editNoteTarget}
        onOpenChange={(open) => !open && setEditNoteTarget(null)}
        shortlistId={shortlistId}
        target={editNoteTarget}
        unitLabel={editNoteTarget ? unitLabel(editNoteTarget, findCurrent(editNoteTarget)) : undefined}
        onSaved={handleUnitNoteSaved}
      />

      <RemoveUnitDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        shortlistId={shortlistId}
        target={removeTarget}
        unitLabel={removeTarget ? unitLabel(removeTarget, findCurrent(removeTarget)) : undefined}
        onRemoved={handleUnitRemoved}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Button variant="outline" asChild>
      <Link href="/shortlists">Back to Client Shortlists</Link>
    </Button>
  );
}

function PageStatus({
  icon,
  title,
  description,
  action,
  inline,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  inline?: boolean;
}) {
  const content = (
    <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );

  if (inline) return content;

  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{content}</div>;
}
