// src/components/dashboard/AddAgentDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UnassignedAgentSummary } from "@/lib/manager/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentClaimed: (agent: UnassignedAgentSummary) => void;
};

// Manager-only claim flow (Part G). Lists currently-unassigned Agents via
// GET /api/manager/agents/unassigned and claims one via POST
// /api/manager/agents/claim — the Manager never supplies a manager id
// themselves; the server always uses the caller's own authenticated id.
export default function AddAgentDialog({ open, onOpenChange, onAgentClaimed }: Props) {
  const [agents, setAgents] = useState<UnassignedAgentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadUnassigned() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/manager/agents/unassigned", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load unassigned agents.");
      }
      setAgents(data.agents ?? []);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setNotice(null);
      setError(null);
      void loadUnassigned();
    }
  }, [open]);

  async function handleClaim(agent: UnassignedAgentSummary) {
    setClaimingId(agent.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/manager/agents/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setNotice("This agent was just assigned to another manager. Refreshing the available list.");
        void loadUnassigned();
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to add this agent.");
      }

      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
      onAgentClaimed(agent);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Agent</DialogTitle>
          <DialogDescription>Select an unassigned agent to add to your team.</DialogDescription>
        </DialogHeader>

        {notice && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {loading && (
            <div className="space-y-2" role="status" aria-label="Loading unassigned agents">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}

          {!loading && agents.length === 0 && !error && (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
              No unassigned agents available right now.
            </p>
          )}

          {!loading &&
            agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                  {agent.full_name || "Unnamed agent"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleClaim(agent)}
                  disabled={claimingId === agent.id}
                >
                  {claimingId === agent.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Add
                </Button>
              </div>
            ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
