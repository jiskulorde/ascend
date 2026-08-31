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
  /** Path to return to after a seller sign-in. Defaults to the public Availability preview. */
  next?: string;
};

const BENEFITS = [
  "Full unit and pricing details",
  "Financing and payment options explained",
  "Recommendations matched to your needs",
  "No-pressure guidance",
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2";

// Reused wherever the public Availability preview offers a buyer a next step
// (see AvailabilityPreviewClient.tsx's "Request Details" button). This is a
// buyer-facing dialog — it points toward the Buyer's Guide / a property
// consultant, not toward creating an account, since a buyer (CLIENT) account
// does not grant the seller tools sign-in used to promise here. The "DMCI
// seller? Sign in" line stays, small and secondary, for the rare case a
// seller lands on this page signed out. Built on the existing Radix Dialog
// primitive (src/components/ui/dialog.tsx), the same one
// SaveToShortlistDialog already uses.
export default function SignInPromptDialog({ open, onOpenChange, next = "/availability" }: Props) {
  const signInHref = `/auth/login?next=${encodeURIComponent(next)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Property Details</DialogTitle>
          <DialogDescription>
            Connect with a DMCI-authorized property consultant for:
          </DialogDescription>
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
          <Link href="/buyers-guide" className={`btn btn-primary ${focusRing}`}>
            Talk to a Consultant
          </Link>
        </DialogFooter>

        <p className="text-center text-xs text-muted-foreground">
          DMCI seller?{" "}
          <Link href={signInHref} className={`underline rounded ${focusRing}`}>
            Sign in
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
