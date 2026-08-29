// src/components/shortlists/ShortlistFormDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
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

const NAME_MAX = 120;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this shortlist (PATCH). Otherwise it creates one (POST). */
  target?: ClientShortlist | null;
  onSaved: (shortlist: ClientShortlist) => void;
};

export default function ShortlistFormDialog({ open, onOpenChange, target, onSaved }: Props) {
  const isEdit = !!target;

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form contents whenever the dialog opens (or the edit target changes).
  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? "");
    setNotes(target?.notes ?? "");
    setError(null);
    setSubmitting(false);
  }, [open, target]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // guards against double-submit (e.g. double Enter/click)

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(isEdit ? `/api/shortlists/${target!.id}` : "/api/shortlists", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          notes: notes.trim() ? notes.trim() : null,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session has expired. Please sign in again.");
        } else if (res.status === 403) {
          setError("You don't have permission to do that.");
        } else {
          setError(json?.error || "Something went wrong. Please try again.");
        }
        return;
      }

      onSaved(json.shortlist as ClientShortlist);
      onOpenChange(false);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!submitting ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit shortlist" : "New shortlist"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rename this shortlist or update its notes."
              : "Give this shortlist a name your client will recognize."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="shortlist-name" className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="shortlist-name"
              autoFocus
              value={name}
              maxLength={NAME_MAX}
              placeholder="e.g. The Reyes Family — Condo Options"
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="shortlist-notes" className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="shortlist-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="Budget, preferred tower, move-in timeline…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create shortlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
