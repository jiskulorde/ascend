// src/components/shortlists/SaveToShortlistDialog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientShortlist } from "@/lib/shortlists/types";
import {
  buildUnitSnapshots,
  removeUnitFromShortlists,
  saveUnitsToShortlists,
  summarizeMembershipEdit,
  summarizeMultiSave,
  type SavableUnit,
  type ShortlistSaveTarget,
  type UnitSnapshotPayload,
} from "@/lib/shortlists/save";
import {
  fetchMembershipIndex,
  shortlistIdsFor,
  shortlistUnitIdFor,
  type MembershipIndex,
} from "@/lib/shortlists/membership";

type LoadState = "loading" | "ready" | "unauthorized" | "forbidden" | "error";
type MembershipStatus = "all" | "partial" | "none";

export type SaveToShortlistResult = {
  // Every (unit identity, shortlist id) pair now confirmed persisted — both
  // newly-saved and pre-existing duplicates count, since either way that pair
  // is a real, database-backed membership now. The caller merges these into
  // its own membership index immediately, without a refetch.
  memberships: Array<{
    property_code: string;
    tower_code: string;
    building_unit: string;
    shortlist_id: string;
    shortlist_unit_id: string;
  }>;
  // Only populated by single-unit membership edits (see below) — memberships
  // the seller explicitly unchecked and that were actually deleted.
  removedMemberships?: Array<{
    property_code: string;
    tower_code: string;
    building_unit: string;
    shortlist_id: string;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: SavableUnit[];
  onSaved?: (result: SaveToShortlistResult) => void;
};

export default function SaveToShortlistDialog({ open, onOpenChange, units, onSaved }: Props) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [shortlists, setShortlists] = useState<ClientShortlist[]>([]);
  // Persisted, database-backed membership — never inferred from session state.
  // null = not yet known (fetch pending or failed); a loaded index means every
  // shortlist row below can show its REAL "already saved" state.
  const [membershipIndex, setMembershipIndex] = useState<MembershipIndex | null>(null);
  const [membershipUnavailable, setMembershipUnavailable] = useState(false);

  // A unit isn't exclusive to one shortlist — the seller may want to save the
  // same unit(s) into several clients' shortlists in one go, so this is a set.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Single-unit mode only: which shortlists the unit was ACTUALLY in when the
  // dialog opened, so editing selectedIds afterward can be diffed into
  // adds/removes without touching anything the seller didn't change.
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  // A single unit gets a true membership-manager view (edit adds AND removes
  // in one "Save Changes"); bulk stays conservative/add-only, per product
  // decision — mass-removal from a multi-unit selection is not implemented.
  const isSingleUnitMode = units.length === 1;

  // Reset/re-fetch only on the false→true transition — deliberately NOT keyed on
  // `units`, since that prop is a freshly-built array on every parent render and
  // would otherwise wipe the seller's in-progress selection each time the parent
  // re-renders for an unrelated reason while this dialog is still open.
  //
  // Membership is fetched fresh every time the dialog opens (never cached from
  // a previous open, never trusted from the parent) so it stays correct after a
  // page refresh, a logout/login, or reopening Availability much later.
  useEffect(() => {
    if (!open) return;

    setSelectedIds(new Set());
    setOriginalIds(new Set());
    setShowCreateForm(false);
    setNewName("");
    setNewNotes("");
    setCreateError(null);
    setSubmitError(null);
    setResultSummary(null);
    setSubmitting(false);
    setCreating(false);
    setMembershipIndex(null);
    setMembershipUnavailable(false);

    setLoadState("loading");
    (async () => {
      try {
        const [shortlistsRes, membership] = await Promise.all([fetch("/api/shortlists"), fetchMembershipIndex()]);

        if (shortlistsRes.status === 401) {
          setLoadState("unauthorized");
          return;
        }
        if (shortlistsRes.status === 403) {
          setLoadState("forbidden");
          return;
        }
        if (!shortlistsRes.ok) {
          setLoadState("error");
          return;
        }

        const json = await shortlistsRes.json();
        const list: ClientShortlist[] = Array.isArray(json.shortlists) ? json.shortlists : [];
        setShortlists(list);
        setShowCreateForm(list.length === 0);

        if (membership) {
          setMembershipIndex(membership);
          // Single-unit mode: pre-check exactly the shortlists this unit is
          // already persisted in — the seller edits from there.
          if (units.length === 1) {
            const existing = shortlistIdsFor(membership, units[0]);
            setOriginalIds(new Set(existing));
            setSelectedIds(new Set(existing));
          }
        } else {
          // Degrade gracefully: proceed with every shortlist shown as
          // unlocked/unchecked, and rely on the API's 409 response as the
          // duplicate safety net during save instead of pre-checking here.
          setMembershipUnavailable(true);
        }

        setLoadState("ready");
      } catch {
        setLoadState("error");
      }
    })();
    // `units` deliberately excluded — see the comment above this effect: it
    // must only reset/refetch on open, never when the parent hands this
    // dialog a freshly-built (but logically unchanged) `units` array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Bulk mode only: for each shortlist, how many of the CURRENT `units`
  // selection does it already contain. "all" -> locked+checked+"Already
  // saved" (not removable from this dialog). "partial" -> interactive,
  // indeterminate until explicitly checked, labeled "N of M already saved".
  // "none" -> a normal toggle.
  const membershipByShortlist = useMemo(() => {
    const map = new Map<string, { status: MembershipStatus; alreadyCount: number }>();
    if (isSingleUnitMode) return map; // single-unit mode never locks a row — see render
    shortlists.forEach((s) => {
      let count = 0;
      units.forEach((u) => {
        if (shortlistIdsFor(membershipIndex, u).has(s.id)) count++;
      });
      const status: MembershipStatus = count === 0 ? "none" : count === units.length ? "all" : "partial";
      map.set(s.id, { status, alreadyCount: count });
    });
    return map;
  }, [shortlists, units, membershipIndex, isSingleUnitMode]);

  // Single-unit mode: what pressing "Save Changes" would actually do.
  const toAdd = useMemo(
    () => (isSingleUnitMode ? Array.from(selectedIds).filter((id) => !originalIds.has(id)) : []),
    [isSingleUnitMode, selectedIds, originalIds]
  );
  const toRemove = useMemo(
    () => (isSingleUnitMode ? Array.from(originalIds).filter((id) => !selectedIds.has(id)) : []),
    [isSingleUnitMode, originalIds, selectedIds]
  );
  const hasPendingChanges = isSingleUnitMode ? toAdd.length > 0 || toRemove.length > 0 : selectedIds.size > 0;

  function toggleShortlist(id: string) {
    if (!isSingleUnitMode && membershipByShortlist.get(id)?.status === "all") return; // bulk-mode lock only
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateShortlist(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setCreateError("Name is required.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/shortlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, notes: newNotes.trim() ? newNotes.trim() : null }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) setCreateError("Your session has expired. Please sign in again.");
        else if (res.status === 403) setCreateError("You don't have permission to do that.");
        else setCreateError(json?.error || "Something went wrong. Please try again.");
        return;
      }

      const created = json.shortlist as ClientShortlist;
      setShortlists((prev) => [created, ...prev]);
      // Auto-select the new (necessarily empty) shortlist without disturbing any others already checked.
      setSelectedIds((prev) => new Set(prev).add(created.id));
      setShowCreateForm(false);
      setNewName("");
      setNewNotes("");
    } catch {
      setCreateError("Network error. Please check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveBulk() {
    const snapshots = await buildUnitSnapshots(units);
    const snapshotByUnitId = new Map(snapshots.map((s) => [s.unit_id, s]));

    const targets: ShortlistSaveTarget[] = Array.from(selectedIds)
      .map((id) => shortlists.find((s) => s.id === id))
      .filter((s): s is ClientShortlist => !!s)
      .map((s) => {
        const alreadyKnownUnitIds: string[] = [];
        const toSave: UnitSnapshotPayload[] = [];
        units.forEach((u) => {
          if (shortlistIdsFor(membershipIndex, u).has(s.id)) {
            alreadyKnownUnitIds.push(u.unit_id);
          } else {
            const snap = snapshotByUnitId.get(u.unit_id);
            if (snap) toSave.push(snap);
          }
        });
        return { id: s.id, name: s.name, toSave, alreadyKnownUnitIds };
      });

    const { perShortlist, unauthorized } = await saveUnitsToShortlists(targets);

    // Every (unit, shortlist) pair now confirmed persisted — new saves and
    // pre-existing duplicates both — reported so the caller's membership
    // index (and badges) update immediately, no refetch needed.
    const unitById = new Map(units.map((u) => [u.unit_id, u]));
    const memberships: SaveToShortlistResult["memberships"] = [];
    perShortlist.forEach(({ shortlistId, outcome }) => {
      outcome.savedUnitIds.forEach((unitId) => {
        const u = unitById.get(unitId);
        const shortlistUnitId = outcome.savedUnits.find((su) => su.unit_id === unitId)?.id;
        if (u && shortlistUnitId) {
          memberships.push({
            property_code: u.property_code,
            tower_code: u.tower_code,
            building_unit: u.building_unit,
            shortlist_id: shortlistId,
            shortlist_unit_id: shortlistUnitId,
          });
        }
      });
      outcome.alreadySavedUnitIds.forEach((unitId) => {
        const u = unitById.get(unitId);
        const shortlistUnitId = u ? shortlistUnitIdFor(membershipIndex, u, shortlistId) : undefined;
        if (u && shortlistUnitId) {
          memberships.push({
            property_code: u.property_code,
            tower_code: u.tower_code,
            building_unit: u.building_unit,
            shortlist_id: shortlistId,
            shortlist_unit_id: shortlistUnitId,
          });
        }
      });
    });
    if (memberships.length > 0) onSaved?.({ memberships });

    if (unauthorized) {
      const savedSoFar = perShortlist.reduce((n, p) => n + p.outcome.savedUnitIds.length, 0);
      setSubmitError(
        savedSoFar > 0
          ? `Your session expired partway through — ${savedSoFar} save(s) went through before that. Please sign in again.`
          : "Your session has expired. Please sign in again."
      );
      return;
    }

    setResultSummary(summarizeMultiSave(perShortlist, units.length));
  }

  async function handleSaveSingleUnitChanges() {
    const unit = units[0];

    const addTargets = shortlists.filter((s) => toAdd.includes(s.id));
    const removeTargets = toRemove
      .map((id) => ({ shortlistId: id, shortlistUnitId: shortlistUnitIdFor(membershipIndex, unit, id) }))
      .filter((r): r is { shortlistId: string; shortlistUnitId: string } => !!r.shortlistUnitId);

    let addOutcome: Awaited<ReturnType<typeof saveUnitsToShortlists>> | null = null;
    if (addTargets.length > 0) {
      const snapshots = await buildUnitSnapshots([unit]);
      const targets: ShortlistSaveTarget[] = addTargets.map((s) => ({
        id: s.id,
        name: s.name,
        toSave: snapshots,
        alreadyKnownUnitIds: [],
      }));
      addOutcome = await saveUnitsToShortlists(targets);
    }

    let removeOutcome: Awaited<ReturnType<typeof removeUnitFromShortlists>> | null = null;
    if (removeTargets.length > 0) {
      removeOutcome = await removeUnitFromShortlists(removeTargets);
    }

    const addedMemberships: SaveToShortlistResult["memberships"] = [];
    addOutcome?.perShortlist.forEach(({ shortlistId, outcome }) => {
      outcome.savedUnitIds.forEach((unitId) => {
        const shortlistUnitId = outcome.savedUnits.find((su) => su.unit_id === unitId)?.id;
        if (shortlistUnitId) {
          addedMemberships.push({
            property_code: unit.property_code,
            tower_code: unit.tower_code,
            building_unit: unit.building_unit,
            shortlist_id: shortlistId,
            shortlist_unit_id: shortlistUnitId,
          });
        }
      });
    });
    const removedMemberships = (removeOutcome?.removedShortlistIds ?? []).map((shortlistId) => ({
      property_code: unit.property_code,
      tower_code: unit.tower_code,
      building_unit: unit.building_unit,
      shortlist_id: shortlistId,
    }));

    if (addedMemberships.length > 0 || removedMemberships.length > 0) {
      onSaved?.({ memberships: addedMemberships, removedMemberships });
    }

    if (addOutcome?.unauthorized || removeOutcome?.fatal === "unauthorized") {
      setSubmitError("Your session has expired. Please sign in again.");
      return;
    }
    if (removeOutcome?.fatal === "forbidden") {
      setSubmitError("You don't have permission to remove this unit from one of those shortlists.");
      return;
    }

    const addedNames = (addOutcome?.perShortlist ?? [])
      .filter((p) => p.outcome.savedUnitIds.length > 0)
      .map((p) => p.shortlistName);
    const removedNames = (removeOutcome?.removedShortlistIds ?? []).map(
      (id) => shortlists.find((s) => s.id === id)?.name ?? "shortlist"
    );
    const failedCount =
      (addOutcome?.perShortlist.reduce((n, p) => n + p.outcome.failedUnitIds.length, 0) ?? 0) +
      (removeOutcome?.failedShortlistIds.length ?? 0);

    // Keep originalIds in sync so re-toggling within the same open dialog
    // (before hitting Done) continues to diff correctly against what's now persisted.
    setOriginalIds(new Set(selectedIds));

    setResultSummary(summarizeMembershipEdit(addedNames, removedNames, failedCount));
  }

  async function handleSave() {
    if (!hasPendingChanges || submitting || units.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (isSingleUnitMode) {
        await handleSaveSingleUnitChanges();
      } else {
        await handleSaveBulk();
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || creating;
  const footerLabel = submitting
    ? "Saving…"
    : isSingleUnitMode && originalIds.size > 0
    ? "Save Changes"
    : selectedIds.size > 1
    ? `Save to ${selectedIds.size} Shortlists`
    : "Save";

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md">
        {resultSummary ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Saved
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-foreground">{resultSummary}</p>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Save to Client Shortlists</DialogTitle>
              <DialogDescription>
                {isSingleUnitMode
                  ? "Check the shortlists this unit should belong to."
                  : `${units.length} units selected — choose one or more destination shortlists.`}
              </DialogDescription>
            </DialogHeader>

            {loadState === "loading" && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            )}

            {loadState === "unauthorized" && (
              <InlineError text="Your session has expired. Please sign in again." />
            )}
            {loadState === "forbidden" && (
              <InlineError text="You don't have permission to manage shortlists." />
            )}
            {loadState === "error" && <InlineError text="Couldn't load your shortlists. Please try again." />}

            {loadState === "ready" && (
              <div className="space-y-3">
                {membershipUnavailable && (
                  <div className="rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    Could not verify existing shortlist membership — duplicates will still be caught automatically.
                  </div>
                )}

                {shortlists.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground">Existing shortlists</div>
                    <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1.5">
                      {shortlists.map((s) => {
                        if (isSingleUnitMode) {
                          const isChecked = selectedIds.has(s.id);
                          const wasOriginal = originalIds.has(s.id);
                          const willRemove = wasOriginal && !isChecked;
                          const willAdd = !wasOriginal && isChecked;
                          return (
                            <label
                              key={s.id}
                              className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition ${
                                isChecked ? "bg-primary/10" : "hover:bg-muted"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={busy}
                                onChange={() => toggleShortlist(s.id)}
                                className="h-4 w-4 shrink-0"
                                style={{ accentColor: "var(--dmci-blue-500)" }}
                              />
                              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.name}</span>
                              {willRemove && (
                                <span className="shrink-0 text-[11px] font-semibold text-rose-700">Will remove</span>
                              )}
                              {willAdd && (
                                <span className="shrink-0 text-[11px] font-semibold text-emerald-700">Will add</span>
                              )}
                              {wasOriginal && isChecked && (
                                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                                  Already saved
                                </span>
                              )}
                            </label>
                          );
                        }

                        const info = membershipByShortlist.get(s.id) ?? { status: "none" as const, alreadyCount: 0 };
                        const isAll = info.status === "all";
                        const isPartial = info.status === "partial";
                        const checked = isAll || selectedIds.has(s.id);

                        return (
                          <label
                            key={s.id}
                            className={
                              isAll
                                ? "flex items-center gap-2.5 rounded-md bg-muted/50 px-2.5 py-2 text-sm cursor-not-allowed"
                                : `flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition ${
                                    selectedIds.has(s.id) ? "bg-primary/10" : "hover:bg-muted"
                                  }`
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busy || isAll}
                              onChange={() => toggleShortlist(s.id)}
                              ref={(el) => {
                                if (el) el.indeterminate = isPartial && !selectedIds.has(s.id);
                              }}
                              className="h-4 w-4 shrink-0"
                              style={{ accentColor: "var(--dmci-blue-500)" }}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.name}</span>
                            {isAll && (
                              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                                Already saved
                              </span>
                            )}
                            {isPartial && (
                              <span className="shrink-0 text-[11px] font-medium text-amber-700">
                                {info.alreadyCount} of {units.length} already saved
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isSingleUnitMode && toRemove.length > 0 && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-800">
                    {toRemove.length} shortlist{toRemove.length === 1 ? "" : "s"} will be removed
                  </div>
                )}

                {showCreateForm ? (
                  <form onSubmit={handleCreateShortlist} className="space-y-2 rounded-md border p-2.5">
                    <Input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Shortlist name"
                      disabled={creating}
                      maxLength={120}
                    />
                    <textarea
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      disabled={creating}
                      rows={2}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                    {createError && <InlineError text={createError} compact />}
                    <div className="flex justify-end gap-2">
                      {shortlists.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={creating}
                          onClick={() => {
                            setShowCreateForm(false);
                            setCreateError(null);
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
                        {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {creating ? "Creating…" : "Create"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="flex w-full items-center gap-1.5 rounded-md border border-dashed px-2.5 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-4 w-4" />
                    Create New Shortlist
                  </button>
                )}

                {submitError && <InlineError text={submitError} />}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={busy || !hasPendingChanges || loadState !== "ready"}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {footerLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InlineError({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-md bg-destructive/10 text-destructive ${
        compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
      }`}
    >
      <AlertCircle className={compact ? "mt-0.5 h-3.5 w-3.5 shrink-0" : "mt-0.5 h-4 w-4 shrink-0"} />
      <span>{text}</span>
    </div>
  );
}
