// src/components/shortlists/ShortlistDetailClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, AlertCircle, FolderOpen, LayoutGrid, ListChecks, Pencil, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { matchesLegacyOrCanonical } from "@/lib/unit-id";
import { rtoTypeCandidates } from "@/lib/financing";
import { membershipKey } from "@/lib/shortlists/membership";
import type { AvailabilityRow, ClientShortlist, RtoInfo, ShortlistUnit, UnitMode } from "@/lib/shortlists/types";
import ShortlistFormDialog from "@/components/shortlists/ShortlistFormDialog";
import EditUnitNoteDialog from "@/components/shortlists/EditUnitNoteDialog";
import RemoveUnitDialog from "@/components/shortlists/RemoveUnitDialog";
import AddUnitsDialog from "@/components/shortlists/AddUnitsDialog";
import UnitCard from "@/components/shortlists/UnitCard";

type LoadState = "loading" | "ready" | "unauthorized" | "forbidden" | "not_found" | "error";
type AvailabilityState = "loading" | "ready" | "error";

const MAX_COMPARE = 6;
const SELECTED_UNITS_KEY = "selectedUnits";

function rtoKeyFor(row: AvailabilityRow): string {
  return `${row.property_code}::${row.GrossAreaSQM}::${rtoTypeCandidates(row.Type).join("|")}`;
}

// Same candidate-trying loop used by Compare/Computation/save.ts — tries each
// candidate unit_type in order, first eligible result wins. Distinguishes a
// genuine lookup failure ("error" — no successful response for any candidate)
// from a confirmed "not_eligible" (we successfully checked and it's a no), so
// the UI never has to guess which one happened.
async function lookupRto(row: AvailabilityRow): Promise<RtoInfo> {
  const candidates = rtoTypeCandidates(row.Type);
  let sawSuccessfulResponse = false;

  for (const unit_type of candidates) {
    const qs = new URLSearchParams({
      project_code: row.property_code,
      unit_type,
      area: String(row.GrossAreaSQM || 0),
    });
    try {
      const res = await fetch(`/api/rto-rate?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) continue; // this candidate's request failed server-side — try the next
      sawSuccessfulResponse = true;
      const json = await res.json();
      if (json?.eligible) {
        return { status: "eligible", monthly: Number(json.monthly_rate) || 0, memo: json.memo_ref || null };
      }
    } catch {
      // network failure — try the next candidate before giving up
    }
  }

  return sawSuccessfulResponse ? { status: "not_eligible" } : { status: "error" };
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
  const [addUnitsOpen, setAddUnitsOpen] = useState(false);
  const [editNoteTarget, setEditNoteTarget] = useState<ShortlistUnit | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ShortlistUnit | null>(null);

  // Mobile-only (the lg+ grid always shows full cards regardless of this).
  // Defaults to "compact" so a phone screen can show several units at once
  // instead of one giant card per screen.
  const [mobileView, setMobileView] = useState<"compact" | "cards">("compact");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [rtoByKey, setRtoByKey] = useState<Record<string, RtoInfo>>({});

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

  // ---------------- RTO — only for matched units, deduped by (project, area,
  // type-candidates) so a shortlist with many units of the same layout only
  // triggers one /api/rto-rate lookup per layout, not one per unit.
  //
  // ROOT CAUSE of the old "stuck on Checking RTO eligibility… forever, with
  // /api/rto-rate requested repeatedly" bug: the previous effect depended on
  // its OWN output state (`[entries, rtoByKey, rtoLoadingKeys]`). Writing to
  // rtoByKey/rtoLoadingKeys is what marks a key as "in flight" / "resolved" —
  // but since those same two pieces of state were also effect dependencies,
  // every write re-ran the effect, and (especially under React Strict Mode's
  // dev-only double-invoke, where the effect fires twice against the SAME
  // pre-update state snapshot) a key could end up dispatched again before the
  // "already requested" state from the first dispatch had actually committed —
  // a feedback loop, not a one-time fetch.
  //
  // Fix: track "have I already dispatched a lookup for this key" in a ref, not
  // in reactive state. Refs mutate synchronously and are NOT effect
  // dependencies, so marking a key in the ref during the effect body has no
  // chance of re-triggering the same effect — the loop is structurally
  // impossible now, not just guarded against. The effect's only dependency is
  // `uniqueRtoTargets`, a memoized list derived purely from unit/inventory
  // data, so it only re-runs when there's a genuinely new key to look up.
  const uniqueRtoTargets = useMemo(() => {
    const map = new Map<string, AvailabilityRow>();
    entries.forEach(({ current }) => {
      if (!current) return;
      const key = rtoKeyFor(current);
      if (!map.has(key)) map.set(key, current);
    });
    return map;
  }, [entries]);

  // A stable primitive signature of the target keys, used as the effect
  // dependency INSTEAD of the Map object itself — this guarantees the effect
  // only ever re-runs when the actual set of keys changes, even if
  // uniqueRtoTargets were ever rebuilt with an equivalent-but-new Map
  // reference (belt-and-suspenders on top of `entries` already being stable).
  const uniqueRtoTargetsSignature = useMemo(
    () => Array.from(uniqueRtoTargets.keys()).sort().join("||"),
    [uniqueRtoTargets]
  );

  const requestedRtoKeys = useRef<Set<string>>(new Set());

  // Tracks whether the component is CURRENTLY mounted. Must be set true on
  // setup, not only cleared on cleanup — see the root-cause note below.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ROOT CAUSE of the RTO cards getting stuck on "Checking RTO eligibility…"
  // forever in real (dev-server) testing, confirmed via a standalone timing
  // simulation of this exact sequence: the previous version of this effect
  // used a per-invocation local `cancelled` flag ("let cancelled = false;
  // return () => { cancelled = true }") to guard the final setRtoByKey call. Under
  // React 18 StrictMode (dev only — reactStrictMode: true in next.config.ts),
  // every effect is invoked, cleaned up, and re-invoked once, SYNCHRONOUSLY,
  // before any awaited work resolves:
  //   1st invocation: dispatches the /api/rto-rate fetch, marks the key in
  //     requestedRtoKeys (the ref-based dedup gate added in the prior fix).
  //   StrictMode immediately calls that invocation's cleanup -> its LOCAL
  //     `cancelled` becomes true.
  //   2nd invocation: sees the key already in requestedRtoKeys -> does
  //     nothing (this is working as designed — it must not double-fetch).
  //   The ORIGINAL (and only) in-flight fetch from the 1st invocation
  //     eventually resolves, checks ITS OWN now-true `cancelled` flag, and
  //     returns WITHOUT ever calling setRtoByKey.
  // Net effect: the key was marked "checking" (that state write happens
  // synchronously, before StrictMode's cleanup) and then NOTHING ever moves
  // it to a terminal state — permanently stuck, exactly as reported, on every
  // affected key, deterministically under `npm run dev`.
  //
  // Fix: since requestedRtoKeys already guarantees each key is fetched at
  // most once total (not once per invocation), there is nothing left for a
  // per-invocation cancel flag to usefully cancel — the only thing worth
  // checking before applying the result is "is the component still mounted",
  // which the (now correctly toggling) mountedRef already answers. No
  // per-invocation flag, no discard-the-only-in-flight-request race.
  useEffect(() => {
    const pending = Array.from(uniqueRtoTargets.entries()).filter(
      ([key]) => !requestedRtoKeys.current.has(key)
    );
    if (!pending.length) return;

    // Mark dispatched (ref, not state) BEFORE the async work starts — this is
    // what makes a re-run of this effect (for any reason) see these keys as
    // already handled, permanently, without waiting for a state commit.
    pending.forEach(([key]) => requestedRtoKeys.current.add(key));

    // Show "checking" immediately rather than waiting for the network round
    // trip, without touching requestedRtoKeys (that stays the single dedup gate).
    setRtoByKey((prev) => {
      const next = { ...prev };
      pending.forEach(([key]) => {
        if (!next[key]) next[key] = { status: "checking" };
      });
      return next;
    });

    (async () => {
      const results = await Promise.all(pending.map(async ([key, row]) => [key, await lookupRto(row)] as const));
      if (!mountedRef.current) return;
      setRtoByKey((prev) => {
        const next = { ...prev };
        results.forEach(([key, info]) => {
          next[key] = info;
        });
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueRtoTargetsSignature]);

  // Manual retry for a key that resolved to "error" — bypasses the dedup ref
  // deliberately (this is an explicit user action, not the automatic effect),
  // and re-runs the exact same lookup used above.
  const retryRto = useCallback(async (key: string, row: AvailabilityRow) => {
    setRtoByKey((prev) => ({ ...prev, [key]: { status: "checking" } }));
    const info = await lookupRto(row);
    if (!mountedRef.current) return;
    setRtoByKey((prev) => ({ ...prev, [key]: info }));
  }, []);

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

  // Physical-identity keys already saved in THIS shortlist — passed to
  // AddUnitsDialog so it can mark "Already added" without a second API call.
  const existingKeys = useMemo(() => new Set(units.map((u) => membershipKey(u))), [units]);

  function handleUnitsAdded(newUnits: ShortlistUnit[]) {
    setUnits((prev) => {
      const existingIds = new Set(prev.map((u) => u.id));
      const additions = newUnits.filter((u) => !existingIds.has(u.id));
      return additions.length > 0 ? [...additions, ...prev] : prev;
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

  function renderUnitCard({ unit, current }: (typeof entries)[number], variant: "card" | "compact") {
    const mode = modeFor(current);
    const rtoKey = current ? rtoKeyFor(current) : null;
    return (
      <UnitCard
        key={unit.id}
        variant={variant}
        unit={unit}
        current={current}
        mode={mode}
        rtoInfo={rtoKey ? rtoByKey[rtoKey] : undefined}
        onRetryRto={current && rtoKey ? () => retryRto(rtoKey, current) : undefined}
        selected={selectedIds.has(unit.id)}
        selectable={mode === "matched" && (selectedIds.has(unit.id) || selectedIds.size < MAX_COMPARE)}
        onToggleSelect={() => toggleSelect(unit.id)}
        onEditNote={() => setEditNoteTarget(unit)}
        onRemove={() => setRemoveTarget(unit)}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/shortlists"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Client Shortlists
      </Link>

      <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {shortlist.name}
          </h1>
          {shortlist.notes && <p className="mt-0.5 text-sm text-muted-foreground">{shortlist.notes}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {units.length} saved unit{units.length !== 1 ? "s" : ""}
            {shortlist.updated_at && ` • Updated ${format(new Date(shortlist.updated_at), "MMM d, yyyy")}`}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => setAddUnitsOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Units
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditShortlistOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>

      {availabilityState === "error" && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
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
            description="Save units from Availability, or use Add Units above, to start building this shortlist."
            action={
              <Button onClick={() => setAddUnitsOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Units
              </Button>
            }
            inline
          />
        </div>
      ) : (
        <>
          {/* Mobile/narrow: Compact vs stacked Cards toggle. The lg+ grid below
              always shows full cards regardless of this — desktop keeps the
              existing card concept unconditionally. */}
          <div className="mt-4 flex items-center justify-between lg:hidden">
            <span className="text-xs font-medium text-muted-foreground">
              {units.length} unit{units.length !== 1 ? "s" : ""}
            </span>
            <div className="inline-flex h-8 overflow-hidden rounded-full border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setMobileView("compact")}
                aria-pressed={mobileView === "compact"}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition ${
                  mobileView === "compact" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <ListChecks className="h-3.5 w-3.5" />
                Compact
              </button>
              <button
                type="button"
                onClick={() => setMobileView("cards")}
                aria-pressed={mobileView === "cards"}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition ${
                  mobileView === "cards" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
            </div>
          </div>

          {mobileView === "compact" ? (
            <div className="mt-3 space-y-2 pb-24 lg:hidden">
              {entries.map((entry) => renderUnitCard(entry, "compact"))}
            </div>
          ) : (
            <div className="mt-3 space-y-3 pb-24 lg:hidden">
              {entries.map((entry) => renderUnitCard(entry, "card"))}
            </div>
          )}

          {/* items-start: cards keep their own natural height and are
              top-aligned within a row, instead of CSS Grid's default
              `stretch` forcing every card in a row to match the tallest one
              (which produced big empty vertical gaps above the footer). */}
          <div className="mt-6 hidden items-start gap-3 pb-20 lg:grid lg:grid-cols-3">
            {entries.map((entry) => renderUnitCard(entry, "card"))}
          </div>
        </>
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

      <AddUnitsDialog
        open={addUnitsOpen}
        onOpenChange={setAddUnitsOpen}
        shortlistId={shortlistId}
        shortlistName={shortlist.name}
        availabilityRows={availabilityRows}
        availabilityState={availabilityState}
        existingKeys={existingKeys}
        rtoByKey={rtoByKey}
        onAdded={handleUnitsAdded}
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
