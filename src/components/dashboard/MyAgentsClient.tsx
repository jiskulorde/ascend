// src/components/dashboard/MyAgentsClient.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Users2, UserPlus, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddAgentDialog from "@/components/dashboard/AddAgentDialog";
import type { AgentSummary, UnassignedAgentSummary } from "@/lib/manager/types";

type LoadState = "loading" | "ready" | "error";

// Manager's own Agent roster (Part F). Backed entirely by GET
// /api/manager/agents (manager_id = caller, server-enforced) — no client
// data beyond full_name/role, no fake KPIs/sales/lead/performance numbers.
export default function MyAgentsClient() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/manager/agents", { cache: "no-store" });
      if (!res.ok) {
        setState("error");
        return;
      }
      const data = await res.json();
      setAgents(data.agents ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleAgentClaimed(agent: UnassignedAgentSummary) {
    setAgents((prev) => [...prev, { id: agent.id, full_name: agent.full_name, role: "AGENT" }]);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Agents</h1>
          <p className="text-sm text-slate-600">Agents currently assigned to you.</p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)} className="w-fit">
          <UserPlus className="h-4 w-4" />
          Add Agent
        </Button>
      </header>

      {state === "loading" && (
        <div className="space-y-2" role="status" aria-label="Loading your agents">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <p className="text-sm font-medium text-slate-800">Couldn&apos;t load your agents</p>
          <Button variant="outline" size="sm" onClick={load} className="mt-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {state === "ready" && agents.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <Users2 className="h-6 w-6 text-slate-400" />
          <p className="text-sm font-medium text-slate-800">No Agents assigned yet.</p>
          <Button type="button" size="sm" onClick={() => setAddOpen(true)} className="mt-1">
            <UserPlus className="h-3.5 w-3.5" />
            Add Agent
          </Button>
        </div>
      )}

      {state === "ready" && agents.length > 0 && (
        <ul className="space-y-2.5">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {agent.full_name || "Unnamed agent"}
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">Assigned to you</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                AGENT
              </span>
            </li>
          ))}
        </ul>
      )}

      <AddAgentDialog open={addOpen} onOpenChange={setAddOpen} onAgentClaimed={handleAgentClaimed} />
    </div>
  );
}
