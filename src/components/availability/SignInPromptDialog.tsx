// src/components/availability/SignInPromptDialog.tsx

"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Path to return to after sign-in. Defaults to the public Availability preview. */
  next?: string;
};

const BENEFITS = [
  "Complete unit inventory",
  "Advanced filters",
  "Lowest Price Summary",
  "Unit Comparison",
  "Payment Computations",
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2";

// Reused everywhere a protected action (Calculate Payment, Compare, etc.) is
// attempted from the public Availability preview — see
// AvailabilityPreviewClient.tsx. Built on the existing Radix Dialog
// primitive (src/components/ui/dialog.tsx), the same one
// SaveToShortlistDialog already uses, so this needs no new dependency and
// gets focus-trapping / Escape-to-close / labeled-dialog semantics for free.
export default function SignInPromptDialog({ open, onOpenChange, next = "/availability" }: Props) {
  const signInHref = `/auth/login?next=${encodeURIComponent(next)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock Full Property Tools</DialogTitle>
          <DialogDescription>Sign in to access:</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2">
              <Check size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={`btn btn-ghost ${focusRing}`}
          >
            Not now
          </button>
          <Link href={signInHref} className={`btn btn-primary ${focusRing}`}>
            Sign In
          </Link>
        </DialogFooter>

        <p className="text-center text-xs text-muted-foreground">
          New here?{" "}
          <Link href={signInHref} className={`underline rounded ${focusRing}`}>
            Create an account
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
