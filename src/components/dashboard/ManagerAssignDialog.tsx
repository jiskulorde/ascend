// src/components/dashboard/ManagerAssignDialog.tsx
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

export type ManagerOption = { id: string; full_name: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: { id: string; full_name: string | null };
  currentManagerId: string | null;
  currentManagerName: string | null;
  managerOptions: ManagerOption[];
  onSaved: (agentId: string, newManagerId: string | null) => void;
};

type Step = "select" | "confirm";
type PendingAction = { kind: "assign" | "unassign"; managerId: string | null; managerName: string | null };

// Admin-only Assign/Change/Unassign Manager dialog for a single Agent row on
// /dashboard/users. Always calls the trusted POST /api/admin/agents/manager
// route — never writes profiles.manager_id from the browser directly.
//
// A brand-new assignment (currentManagerId was null) saves immediately, no
// extra step. Changing an EXISTING assignment, or unassigning one, goes
// through a "confirm" step first (Part D: "show a normal confirmation
// before applying" for reassignment/unassign — not the stronger
// type-to-confirm pattern reserved for permanent deletion later).
export default function ManagerAssignDialog({
  open,
  onOpenChange,
  agent,
  currentManagerId,
  currentManagerName,
  managerOptions,
  onSaved,
}: Props) {
  const [step, setStep] = useState<Step>("select");
  const [selectedManagerId, setSelectedManagerId] = useState<string>(currentManagerId ?? "");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("select");
      setSelectedManagerId(currentManagerId ?? "");
      setPendingAction(null);
      setError(null);
    }
  }, [open, currentManagerId]);

  const managerNameOf = (id: string | null) =>
    managerOptions.find((m) => m.id === id)?.full_name || "this manager";

  async function submit(managerId: string | null) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/agents/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, managerId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update the assignment.");
      }

      onSaved(agent.id, managerId);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setStep("select");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaveClick() {
    const nextManagerId = selectedManagerId || null;

    if (nextManagerId === currentManagerId) {
      setError("Select a different manager first.");
      return;
    }

    // Fresh assignment (was unassigned) — nothing to overwrite, save directly.
    if (currentManagerId === null && nextManagerId !== null) {
      void submit(nextManagerId);
      return;
    }

    // Reassignment — confirm first.
    setPendingAction({ kind: "assign", managerId: nextManagerId, managerName: managerNameOf(nextManagerId) });
    setStep("confirm");
  }

  function handleUnassignClick() {
    setPendingAction({ kind: "unassign", managerId: null, managerName: null });
    setStep("confirm");
  }

  const dialogTitle = currentManagerId ? "Change Manager" : "Assign Manager";

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        {step === "select" && (
          <>
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>
                {agent.full_name || "This agent"} —{" "}
                {currentManagerName ? `currently managed by ${currentManagerName}` : "currently unassigned"}.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Manager</label>
              {managerOptions.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  No manager accounts available yet.
                </p>
              ) : (
                <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name || "Unnamed manager"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <DialogFooter className="items-center gap-2 sm:justify-between">
              {currentManagerId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUnassignClick}
                  disabled={submitting}
                  className="text-red-700 hover:bg-red-50"
                >
                  Unassign
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={submitting || managerOptions.length === 0}
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && pendingAction && (
          <>
            <DialogHeader>
              <DialogTitle>{pendingAction.kind === "unassign" ? "Unassign manager?" : "Confirm change"}</DialogTitle>
              <DialogDescription>
                {pendingAction.kind === "unassign"
                  ? `${agent.full_name || "This agent"} will no longer be managed by ${currentManagerName || "their current manager"}.`
                  : `Change ${agent.full_name || "this agent"}'s manager ${
                      currentManagerName ? `from ${currentManagerName} ` : ""
                    }to ${pendingAction.managerName}?`}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setStep("select")} disabled={submitting}>
                Back
              </Button>
              <Button
                type="button"
                variant={pendingAction.kind === "unassign" ? "destructive" : "default"}
                onClick={() => submit(pendingAction.managerId)}
                disabled={submitting}
              >
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
