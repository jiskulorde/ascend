// src/components/dashboard/UsersAdminClient.tsx
"use client";

import { useMemo, useState } from "react";
import { Shield, UserCircle2, Loader2, Users2, Clock } from "lucide-react";
import ManagerAssignDialog, { type ManagerOption } from "@/components/dashboard/ManagerAssignDialog";
import ApproveAccountDialog from "@/components/dashboard/ApproveAccountDialog";
import { computeEffectiveState, type AccountStatus } from "@/lib/auth/accountLifecycle";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN" | null;

type ProfileRow = {
  id: string;
  full_name: string | null;
  email?: string | null;
  role: Role;
  manager_id?: string | null;
  account_status?: AccountStatus | null;
  access_expires_at?: string | null;
  requested_role?: Role | null;
};

type Props = {
  admin: ProfileRow;
  initialUsers: ProfileRow[];
  managerOptions: ManagerOption[];
};

const ALL_ROLES: Exclude<Role, null>[] = [
  "CLIENT",
  "AGENT",
  "MANAGER",
  "ADMIN",
];

const REQUESTED_ROLE_LABELS: Record<string, string> = {
  CLIENT: "Buyer / Client",
  AGENT: "Property Consultant / Agent",
  MANAGER: "Manager",
};

export default function UsersAdminClient({ admin, initialUsers, managerOptions }: Props) {
  const [rows, setRows] = useState(initialUsers);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [managerDialogAgent, setManagerDialogAgent] = useState<ProfileRow | null>(null);
  const [approveDialogAccount, setApproveDialogAccount] = useState<ProfileRow | null>(null);
  const [draftRole, setDraftRole] = useState<Record<string, Exclude<Role, null>>>(
    () =>
      initialUsers.reduce(
        (acc, u) => ({
          ...acc,
          [u.id]: (u.role || "CLIENT") as Exclude<Role, null>,
        }),
        {} as Record<string, Exclude<Role, null>>
      )
  );

  // Effective status per row, computed with the same shared logic every
  // other layer uses (Phase 3B) — not a separately-invented display rule.
  // account_status defaults to ACTIVE for any row that somehow lacks it
  // (shouldn't happen post-Phase-3A, but matches every other layer's
  // fallback rather than crashing on an unexpected null).
  const effectiveStatus = (u: ProfileRow) =>
    computeEffectiveState((u.account_status ?? "ACTIVE") as AccountStatus, u.access_expires_at ?? null);

  const stats = useMemo(() => {
    const base = { CLIENT: 0, AGENT: 0, MANAGER: 0, ADMIN: 0 } as Record<
      Exclude<Role, null>,
      number
    >;
    let pendingCount = 0;
    for (const u of rows) {
      const r = (u.role || "CLIENT") as Exclude<Role, null>;
      base[r] = (base[r] || 0) + 1;
      if (effectiveStatus(u) === "PENDING") pendingCount += 1;
    }
    return { ...base, PENDING: pendingCount };
  }, [rows]);

  const managerNameById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of managerOptions) map.set(m.id, m.full_name);
    return map;
  }, [managerOptions]);

  const roleBadge = (role: Role) => {
    const safe = (role || "CLIENT") as Exclude<Role, null>;
    const base =
      "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide";
    switch (safe) {
      case "ADMIN":
        return (
          <span className={`${base} bg-slate-900 text-white`}>
            {safe}
          </span>
        );
      case "MANAGER":
        return (
          <span className={`${base} bg-indigo-50 text-indigo-700`}>
            {safe}
          </span>
        );
      case "AGENT":
        return (
          <span className={`${base} bg-emerald-50 text-emerald-700`}>
            {safe}
          </span>
        );
      default:
        return (
          <span className={`${base} bg-slate-100 text-slate-700`}>
            {safe}
          </span>
        );
    }
  };

  // Status badge is deliberately a separate visual from the role badge —
  // role answers "what can they do," status answers "may they do it right
  // now." EXPIRED only ever shows if access_expires_at actually derives it
  // (no account can reach that yet — no expiration UI exists this phase).
  const statusBadge = (u: ProfileRow) => {
    const state = effectiveStatus(u);
    const base =
      "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide";
    switch (state) {
      case "PENDING":
        return <span className={`${base} bg-amber-50 text-amber-700`}>Pending</span>;
      case "ACTIVE":
        return <span className={`${base} bg-emerald-50 text-emerald-700`}>Active</span>;
      case "SUSPENDED":
        return <span className={`${base} bg-orange-50 text-orange-700`}>Suspended</span>;
      case "DEACTIVATED":
        return <span className={`${base} bg-slate-200 text-slate-600`}>Deactivated</span>;
      case "EXPIRED":
        return <span className={`${base} bg-red-50 text-red-700`}>Expired</span>;
    }
  };

  const handleSendRequest = async (userId: string) => {
    const newRole = draftRole[userId];
    const row = rows.find((r) => r.id === userId);
    if (!row) return;

    setError(null);
    setMessage(null);

    if ((row.role || "CLIENT") === newRole) {
      setError("New role is the same as current role.");
      return;
    }

    setPending(userId);
    try {
      const res = await fetch("/api/admin/role-change-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create request.");
      }

      setMessage(
        `Role change request sent. Ask the user to check their email for the confirmation link.`
      );
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setPending(null);
    }
  };

  const handleManagerSaved = (agentId: string, newManagerId: string | null) => {
    setRows((prev) => prev.map((r) => (r.id === agentId ? { ...r, manager_id: newManagerId } : r)));
    setError(null);
    setMessage(
      newManagerId
        ? `Manager updated: ${managerNameById.get(newManagerId) || "assigned"}.`
        : "Manager unassigned."
    );
  };

  const handleAccountApproved = (userId: string, role: Exclude<Role, null>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === userId ? { ...r, role, account_status: "ACTIVE" as AccountStatus } : r))
    );
    setDraftRole((prev) => ({ ...prev, [userId]: role }));
    setError(null);
    setMessage(`Account approved as ${role}.`);
  };

  const managerCell = (u: ProfileRow) => {
    if (u.role !== "AGENT") {
      return <span className="text-slate-300">—</span>;
    }

    const currentManagerName = u.manager_id ? managerNameById.get(u.manager_id) ?? "Unknown manager" : null;

    return (
      <div className="flex flex-col gap-1">
        <span className={currentManagerName ? "text-slate-800" : "text-slate-400"}>
          {currentManagerName || "Unassigned"}
        </span>
        <button
          type="button"
          onClick={() => setManagerDialogAgent(u)}
          className="w-fit rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
        >
          {currentManagerName ? "Change" : "Assign"}
        </button>
      </div>
    );
  };

  // Pending accounts get Approve as their primary action, not the ordinary
  // role-change flow — the two shouldn't compete. Role-change stays hidden
  // until the account is actually ACTIVE (Part M).
  const roleActionCell = (u: ProfileRow) => {
    if (effectiveStatus(u) === "PENDING") {
      return (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">
            Requested:{" "}
            <span className="font-medium text-slate-700">
              {u.requested_role ? REQUESTED_ROLE_LABELS[u.requested_role] ?? u.requested_role : "Not specified"}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setApproveDialogAccount(u)}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800"
          >
            Approve
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs"
          value={draftRole[u.id]}
          onChange={(e) =>
            setDraftRole((prev) => ({
              ...prev,
              [u.id]: e.target.value as Exclude<Role, null>,
            }))
          }
          disabled={pending === u.id}
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => handleSendRequest(u.id)}
          disabled={pending === u.id}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending === u.id ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Sending…
            </>
          ) : (
            "Send role change"
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Users
          </h1>
          <p className="text-sm text-slate-600">
            Manage accounts, roles, and Manager assignments for your Ascend • DMCI workspace.
          </p>
        </div>
      </div>

      {/* Admin info + stats */}
      <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
              <Shield size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                You are signed in as
              </p>
              <p className="text-sm font-medium text-slate-900">
                {admin.full_name || admin.email}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {roleBadge(admin.role)}
                <span className="text-[11px] text-slate-500">
                  Admin accounts can view all users, change roles (with email
                  confirmation), approve pending accounts, and assign Agent Managers.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            User overview
          </p>
          <dl className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
            {stats.PENDING > 0 && (
              <div className="rounded-2xl bg-amber-50 px-3 py-2">
                <dt className="flex items-center gap-1 text-[11px] text-amber-700">
                  <Clock size={11} /> Pending
                </dt>
                <dd className="text-sm font-semibold text-amber-900">{stats.PENDING}</dd>
              </div>
            )}
            <div className="rounded-2xl bg-slate-50 px-3 py-2">
              <dt className="text-[11px] text-slate-500">Clients</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {stats.CLIENT}
              </dd>
            </div>
            <div className="rounded-2xl bg-emerald-50/60 px-3 py-2">
              <dt className="text-[11px] text-emerald-700">Agents</dt>
              <dd className="text-sm font-semibold text-emerald-900">
                {stats.AGENT}
              </dd>
            </div>
            <div className="rounded-2xl bg-indigo-50/70 px-3 py-2">
              <dt className="text-[11px] text-indigo-700">Managers</dt>
              <dd className="text-sm font-semibold text-indigo-900">
                {stats.MANAGER}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-900/90 px-3 py-2 text-white">
              <dt className="text-[11px] text-slate-200">Admins</dt>
              <dd className="text-sm font-semibold">
                {stats.ADMIN + 1 /* include yourself */}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Messages */}
      {message && (
        <p className="text-xs rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="text-xs rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          {error}
        </p>
      )}

      {/* Desktop table (md+) */}
      <section className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-900 text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Manager
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                Role / Approval
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <UserCircle2 size={18} />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {u.full_name || "—"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        ID: {u.id.slice(0, 8)}…
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-slate-700">
                  {u.email === undefined ? (
                    <span
                      className="text-amber-600"
                      title="No matching Supabase Auth account was found for this profile."
                    >
                      Account data mismatch
                    </span>
                  ) : u.email ? (
                    u.email
                  ) : (
                    <span className="text-slate-400">No email</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">{roleBadge(u.role)}</td>
                <td className="px-4 py-3 align-top">{statusBadge(u)}</td>
                <td className="px-4 py-3 align-top text-xs">{managerCell(u)}</td>
                <td className="px-4 py-3 align-top">{roleActionCell(u)}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-slate-500"
                >
                  No other users yet. New sign-ups will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Mobile cards (below md) — the desktop table doesn't just shrink;
          each account gets its own compact card with the same actions. */}
      <section className="space-y-3 md:hidden">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500 shadow-sm">
            No other users yet. New sign-ups will appear here.
          </div>
        )}

        {rows.map((u) => (
          <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <UserCircle2 size={18} />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{u.full_name || "—"}</div>
                  <div className="truncate text-[11px] text-slate-400">
                    {u.email === undefined
                      ? "Account data mismatch"
                      : u.email || "No email"}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {roleBadge(u.role)}
                {statusBadge(u)}
              </div>
            </div>

            {u.role === "AGENT" && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-xs">
                  <span className="text-slate-500">Manager: </span>
                  <span className={u.manager_id ? "text-slate-800" : "text-slate-400"}>
                    {u.manager_id ? managerNameById.get(u.manager_id) ?? "Unknown manager" : "Unassigned"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setManagerDialogAgent(u)}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  {u.manager_id ? "Change" : "Assign"}
                </button>
              </div>
            )}

            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {effectiveStatus(u) === "PENDING" ? "Approval" : "Change role"}
              </p>
              {roleActionCell(u)}
            </div>
          </div>
        ))}
      </section>

      {managerDialogAgent && (
        <ManagerAssignDialog
          open={!!managerDialogAgent}
          onOpenChange={(open) => {
            if (!open) setManagerDialogAgent(null);
          }}
          agent={{ id: managerDialogAgent.id, full_name: managerDialogAgent.full_name }}
          currentManagerId={managerDialogAgent.manager_id ?? null}
          currentManagerName={
            managerDialogAgent.manager_id
              ? managerNameById.get(managerDialogAgent.manager_id) ?? "Unknown manager"
              : null
          }
          managerOptions={managerOptions}
          onSaved={handleManagerSaved}
        />
      )}

      {approveDialogAccount && (
        <ApproveAccountDialog
          open={!!approveDialogAccount}
          onOpenChange={(open) => {
            if (!open) setApproveDialogAccount(null);
          }}
          account={{
            id: approveDialogAccount.id,
            full_name: approveDialogAccount.full_name,
            email: approveDialogAccount.email,
            requested_role: approveDialogAccount.requested_role ?? null,
          }}
          onApproved={handleAccountApproved}
        />
      )}

      {managerOptions.length === 0 && stats.AGENT > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Users2 size={12} />
          No Manager accounts exist yet — promote a user to Manager before assigning Agents.
        </p>
      )}
    </div>
  );
}
