// src/components/shortlists/EditUnitNoteDialog.tsx
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
import type { ShortlistUnit } from "@/lib/shortlists/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  target: ShortlistUnit | null;
  unitLabel?: string;
  onSaved: (unit: ShortlistUnit) => void;
};

export default function EditUnitNoteDialog({
  open,
  onOpenChange,
  shortlistId,
  target,
  unitLabel,
  onSaved,
}: Props) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotes(target?.notes ?? "");
    setError(null);
    setSubmitting(false);
  }, [open, target]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/shortlists/${shortlistId}/units/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() ? notes.trim() : null }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session has expired. Please sign in again.");
        } else if (res.status === 403) {
          setError("You don't have permission to do that.");
        } else if (res.status === 404) {
          setError("This saved unit no longer exists.");
        } else {
          setError(json?.error || "Something went wrong. Please try again.");
        }
        return;
      }

      onSaved(json.unit as ShortlistUnit);
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
          <DialogTitle>Edit unit note</DialogTitle>
          <DialogDescription>
            {unitLabel ? `Private note for ${unitLabel}.` : "Private note for this saved unit."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            rows={4}
            placeholder="e.g. Client liked the balcony view, wants to check unit facing…"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />

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
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
