// src/components/shortlists/RemoveUnitDialog.tsx
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
import type { ShortlistUnit } from "@/lib/shortlists/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  target: ShortlistUnit | null;
  unitLabel?: string;
  onRemoved: (shortlistUnitId: string) => void;
};

export default function RemoveUnitDialog({
  open,
  onOpenChange,
  shortlistId,
  target,
  unitLabel,
  onRemoved,
}: Props) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    if (!target || removing) return;
    setRemoving(true);
    setError(null);

    try {
      const res = await fetch(`/api/shortlists/${shortlistId}/units/${target.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        if (res.status === 401) {
          setError("Your session has expired. Please sign in again.");
        } else if (res.status === 403) {
          setError("You don't have permission to do that.");
        } else if (res.status === 404) {
          // Already gone — treat as success.
          onRemoved(target.id);
          onOpenChange(false);
          return;
        } else {
          setError(json?.error || "Something went wrong. Please try again.");
        }
        return;
      }

      onRemoved(target.id);
      onOpenChange(false);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!removing ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove unit from shortlist?</DialogTitle>
          <DialogDescription>
            {unitLabel ? (
              <>
                <span className="font-medium text-foreground">{unitLabel}</span> will be removed from this
                shortlist. This does not affect current inventory.
              </>
            ) : (
              "This unit will be removed from this shortlist. This does not affect current inventory."
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={removing}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleRemove} disabled={removing}>
            {removing && <Loader2 className="h-4 w-4 animate-spin" />}
            {removing ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
