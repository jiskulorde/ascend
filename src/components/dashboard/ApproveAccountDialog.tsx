// src/components/dashboard/ApproveAccountDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type FinalRole = "CLIENT" | "AGENT" | "MANAGER";

const FINAL_ROLE_OPTIONS: { value: FinalRole; label: string }[] = [
  { value: "CLIENT", label: "Client" },
  { value: "AGENT", label: "Agent" },
  { value: "MANAGER", label: "Manager" },
];

const REQUESTED_ROLE_LABELS: Record<string, string> = {
  CLIENT: "Buyer / Client",
  AGENT: "Property Consultant / Agent",
  MANAGER: "Manager",
};

function isFinalRole(value: string | null | undefined): value is FinalRole {
  return value === "CLIENT" || value === "AGENT" || value === "MANAGER";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    full_name: string | null;
    email?: string | null;
    requested_role: string | null;
  };
  onApproved: (userId: string, role: FinalRole, approvedAt: string) => void;
};

type Step = "select" | "confirm";

// Admin-only approval dialog for a PENDING account (Phase 3B). Default final
// role: requested_role, ONLY if it's a valid CLIENT/AGENT/MANAGER value —
// otherwise no default is pre-selected and Approve stays disabled until the
// Admin makes an explicit choice. This is deliberately the more conservative
// option over silently defaulting an unspecified/invalid request to CLIENT:
// an ambiguous request should get the Admin's attention, not slide through
// on an assumption. Admin may always override the requested role regardless.
export default function ApproveAccountDialog({ open, onOpenChange, account, onApproved }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [selectedRole, setSelectedRole] = useState<FinalRole | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("select");
      setSelectedRole(isFinalRole(account.requested_role) ? account.requested_role : "");
      setError(null);
    }
  }, [open, account.requested_role]);

  async function submit() {
    if (!selectedRole) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: account.id, role: selectedRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to approve this account.");
      }

      onApproved(account.id, selectedRole, data.profile?.approved_at ?? new Date().toISOString());
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setStep("select");
    } finally {
      setSubmitting(false);
    }
  }

  const requestedLabel = account.requested_role
    ? REQUESTED_ROLE_LABELS[account.requested_role] ?? account.requested_role
    : "Not specified";

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        {step === "select" && (
          <>
            <DialogHeader>
              <DialogTitle>Approve Account</DialogTitle>
              <DialogDescription>
                {account.full_name || "This account"}
                {account.email ? ` — ${account.email}` : ""}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}

            <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-500">Requested: </span>
              <span className="font-medium text-slate-800">{requestedLabel}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Final role</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as FinalRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {FINAL_ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Admin may approve with a different role than requested.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" onClick={() => setStep("confirm")} disabled={submitting || !selectedRole}>
                Approve
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && selectedRole && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm approval</DialogTitle>
              <DialogDescription>
                Approve {account.full_name || "this account"} as{" "}
                <span className="font-medium text-foreground">{selectedRole}</span>? They will gain{" "}
                {selectedRole.toLowerCase()} access immediately.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setStep("select")} disabled={submitting}>
                Back
              </Button>
              <Button type="button" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Confirm
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
