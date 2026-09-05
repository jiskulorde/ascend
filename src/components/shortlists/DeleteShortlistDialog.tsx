// src/components/shortlists/DeleteShortlistDialog.tsx
"use client";

import { useState } from "react";
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
import type { ClientShortlist } from "@/lib/shortlists/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ClientShortlist | null;
  onDeleted: (id: string) => void;
};

export default function DeleteShortlistDialog({ open, onOpenChange, target, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!target || deleting) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/shortlists/${target.id}`, { method: "DELETE" });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        if (res.status === 401) {
          setError("Your session has expired. Please sign in again.");
        } else if (res.status === 403) {
          setError("You don't have permission to do that.");
        } else if (res.status === 404) {
          // Already gone — treat as success from the seller's point of view.
          onDeleted(target.id);
          onOpenChange(false);
          return;
        } else {
          setError(json?.error || "Something went wrong. Please try again.");
        }
        return;
      }

      onDeleted(target.id);
      onOpenChange(false);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!deleting ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete shortlist?</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                This permanently deletes <span className="font-medium text-foreground">“{target.name}”</span> and
                every unit saved inside it. This cannot be undone.
              </>
            ) : (
              "This cannot be undone."
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? "Deleting…" : "Delete shortlist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
