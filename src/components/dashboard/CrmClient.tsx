// src/components/dashboard/CrmClient.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronsUpDown,
  Search,
  AlertCircle,
  Calendar,
  Loader2,
} from "lucide-react";
import type { CrmLead } from "@/lib/google/crm";

type Lead = CrmLead;

type CrmOptions = {
  statusOptions: string[];
  leadOwnerOptions: string[];
  channelOptions: string[];
  priorityOptions: string[];
};

type Props = {
  managerEmail: string;
  managerName?: string | null;
  initialLeads: Lead[];
  /** Optional; if not passed, we fall back to defaults that mirror the Apps Script config */
  options?: CrmOptions;
};

function getLeadKey(lead: Lead): string {
  // Some rows may have blank Lead ID – fall back to row index
  return lead.leadId || `row-${lead.rowIndex}`;
}

export default function CrmClient({
  managerEmail,
  managerName,
  initialLeads,
  options,
}: Props) {
  // ----- FALLBACK OPTIONS (prevents undefined crash) -----
  const opts: CrmOptions =
    options ?? {
      statusOptions: [
        "New",
        "To Follow Up",
        "In Progress",
        "Site Visit Set",
        "Reserved",
        "Closed Won",
        "Closed Lost",
        "Not Responding",
      ],
      leadOwnerOptions: [
        "Ascend - 1",
        "Ascend - 2",
        "Ascend - 3",
        "Ascend - 4",
        "Ascend - 5",
        "Ascend - 6",
        "Ascend - 7",
        "Ascend - 8",
        "Ascend - 9",
        "Ascend - 10",
        "Unassigned",
      ],
      channelOptions: [
        "Call",
        "SMS",
        "Messenger",
        "Viber",
        "Email",
        "Site Visit",
        "Zoom / Online",
      ],
      priorityOptions: ["Hot", "Warm", "Cold"],
    };

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialLeads[0] ? getLeadKey(initialLeads[0]) : null
  );
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const selected = useMemo(
    () =>
      leads.find((l) => getLeadKey(l) === selectedId) ??
      (leads.length > 0 ? leads[0] : null),
    [leads, selectedId]
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filterStatus !== "All" && lead.status !== filterStatus) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [
          lead.fullName,
          lead.email,
          lead.mobile,
          lead.project,
          lead.unit,
          lead.owner,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [leads, filterStatus, search]);

  function updateSelected(field: keyof Lead, value: string) {
    if (!selected) return;
    setLeads((prev) =>
      prev.map((l) =>
        getLeadKey(l) === getLeadKey(selected)
          ? {
              ...l,
              [field]: value,
            }
          : l
      )
    );
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/manager/crm/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: selected.rowIndex,
          leadId: selected.leadId,
          updates: {
            status: selected.status,
            owner: selected.owner,
            lastContact: selected.lastContact,
            nextFollowUp: selected.nextFollowUp,
            channel: selected.channel,
            priority: selected.priority,
            notes: selected.notes,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to update CRM lead.");
      }

      setSaveMessage("Changes saved to CRM.");
      setEditing(false);
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (err: any) {
      console.error("[crm] save error", err);
      setError(err?.message ?? "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  const total = leads.length;
  const overdueCount = leads.filter((l) => l.overdue === "OVERDUE").length;

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-6">
        {/* Top info cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Manager
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {managerName || managerEmail}
            </p>
            <p className="mt-1 text-xs text-slate-500">{managerEmail}</p>
            <p className="mt-3 text-xs text-slate-500">
              You see all leads. In the future, agents will see only their
              assigned clients.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Leads loaded
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{total}</p>
            <p className="mt-2 text-xs text-slate-500">
              {overdueCount > 0 ? (
                <>
                  <span className="font-semibold text-red-600">
                    {overdueCount} overdue
                  </span>{" "}
                  follow-up{overdueCount > 1 ? "s" : ""} detected.
                </>
              ) : (
                "No overdue follow-ups today."
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Tip
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Use the list on the left to quickly scan leads. Click a lead to
              view full details and edit status, owner, follow-up dates,
              channel, and notes on the right.
            </p>
          </div>
        </div>

        {/* Filter + search */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            CRM
          </h1>

          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            {/* Status filter */}
            <div className="inline-flex items-center gap-2">
              <span className="text-xs text-slate-500">Filter status:</span>
              <select
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs md:text-sm shadow-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="All">All</option>
                {opts.statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="w-full md:w-60 rounded-full border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs md:text-sm shadow-sm"
                placeholder="Search name, email, project…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Master–detail layout */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* List (master) */}
          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center justify-between text-xs font-medium text-slate-500 uppercase tracking-wide">
              <span>Leads</span>
              <span>{filteredLeads.length} shown</span>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                <AlertCircle size={16} className="text-slate-400" />
                No leads match your filters.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => {
                  const key = getLeadKey(lead);
                  const isSelected =
                    selected && getLeadKey(selected) === key;
                  const overdue = lead.overdue === "OVERDUE";

                  return (
                    <li key={key}>
                      <button
                        onClick={() => {
                          setSelectedId(key);
                          setEditing(false);
                          setError(null);
                          setSaveMessage(null);
                        }}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition ${
                          isSelected ? "bg-indigo-50/80" : "hover:bg-slate-50"
                        }`}
                      >
                        {/* Avatar */}
                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white shrink-0">
                          {lead.fullName?.charAt(0).toUpperCase() || "?"}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {lead.fullName || "(No name)"}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500 truncate">
                                {lead.project || "—"}
                              </p>
                            </div>
                            {/* Status chip */}
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                                lead.status === "Closed Won"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : lead.status === "Closed Lost"
                                  ? "bg-rose-50 text-rose-700"
                                  : lead.status === "To Follow Up"
                                  ? "bg-amber-50 text-amber-700"
                                  : lead.status === "In Progress"
                                  ? "bg-sky-50 text-sky-700"
                                  : "bg-slate-50 text-slate-600"
                              }`}
                            >
                              {lead.status || "New"}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span className="truncate max-w-[140px]">
                              Owner:{" "}
                              <span className="font-medium">
                                {lead.owner || "Unassigned"}
                              </span>
                            </span>
                            {lead.nextFollowUp && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={10} />
                                Next: {lead.nextFollowUp}
                              </span>
                            )}
                            {overdue && (
                              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                OVERDUE
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Detail (compact editing) */}
          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 md:p-5">
            {!selected ? (
              <p className="text-sm text-slate-500">
                Select a lead on the left to view and edit details.
              </p>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {selected.fullName || "(No name)"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 break-all">
                      {selected.email || "No email"}
                      {selected.mobile && ` · ${selected.mobile}`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Lead ID: {selected.leadId || "—"} · Date inquired:{" "}
                      {selected.dateInquired || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-50"
                      onClick={() => setEditing((v) => !v)}
                    >
                      {editing ? "Stop editing" : "Edit lead"}
                    </button>
                    <Link
                      href={`/dashboard/crm/${encodeURIComponent(
                        selected.leadId || String(selected.rowIndex)
                      )}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white hover:bg-slate-50"
                    >
                      View full profile
                    </Link>
                  </div>
                </div>

                {/* Project / unit (read-only, compact) */}
                <div className="mt-4 grid gap-3 text-xs text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-800 text-[11px] uppercase tracking-wide">
                      Project
                    </p>
                    <p className="mt-0.5">
                      {selected.project || "—"}
                      {selected.cityPreference && (
                        <>
                          {" "}
                          · <span>{selected.cityPreference}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="mt-5 grid gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                        Status
                      </label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                        value={selected.status}
                        disabled={!editing}
                        onChange={(e) =>
                          updateSelected("status", e.target.value)
                        }
                      >
                        {opts.statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                        Owner
                      </label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                        value={selected.owner}
                        disabled={!editing}
                        onChange={(e) =>
                          updateSelected("owner", e.target.value)
                        }
                      >
                        {opts.leadOwnerOptions.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                        Last contact
                      </label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                        value={selected.lastContact || ""}
                        disabled={!editing}
                        onChange={(e) =>
                          updateSelected("lastContact", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                        Next follow-up
                      </label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                        value={selected.nextFollowUp || ""}
                        disabled={!editing}
                        onChange={(e) =>
                          updateSelected("nextFollowUp", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                        Channel
                      </label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                        value={selected.channel}
                        disabled={!editing}
                        onChange={(e) =>
                          updateSelected("channel", e.target.value)
                        }
                      >
                        {opts.channelOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                        Priority
                      </label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                        value={selected.priority}
                        disabled={!editing}
                        onChange={(e) =>
                          updateSelected("priority", e.target.value)
                        }
                      >
                        {opts.priorityOptions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Notes
                    </label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs min-h-[70px] disabled:bg-slate-50 disabled:text-slate-400"
                      value={selected.notes || ""}
                      disabled={!editing}
                      onChange={(e) =>
                        updateSelected("notes", e.target.value)
                      }
                      placeholder="Example: Requested payment terms, prefers high floor facing amenities…"
                    />
                  </div>
                </div>

                {/* Save + status + full profile link already above */}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    {error && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] text-rose-700">
                        <AlertCircle size={12} />
                        {error}
                      </span>
                    )}
                    {saveMessage && !error && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">
                        {saveMessage}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !editing}
                    className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {saving && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
