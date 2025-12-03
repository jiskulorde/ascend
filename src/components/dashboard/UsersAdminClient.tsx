// src/components/dashboard/UsersAdminClient.tsx
"use client";

import { useMemo, useState } from "react";
import { Shield, UserCircle2, Loader2 } from "lucide-react";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN" | null;

type ProfileRow = {
  id: string;
  full_name: string | null;
  email?: string | null;
  role: Role;
};

type Props = {
  admin: ProfileRow;
  initialUsers: ProfileRow[];
};

const ALL_ROLES: Exclude<Role, null>[] = [
  "CLIENT",
  "AGENT",
  "MANAGER",
  "ADMIN",
];

export default function UsersAdminClient({ admin, initialUsers }: Props) {
  const [rows, setRows] = useState(initialUsers);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const stats = useMemo(() => {
    const base = { CLIENT: 0, AGENT: 0, MANAGER: 0, ADMIN: 0 } as Record<
      Exclude<Role, null>,
      number
    >;
    for (const u of rows) {
      const r = (u.role || "CLIENT") as Exclude<Role, null>;
      base[r] = (base[r] || 0) + 1;
    }
    return base;
  }, [rows]);

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Users
          </h1>
          <p className="text-sm text-slate-600">
            Manage accounts and roles for your Ascend • DMCI workspace.
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
                  Admin accounts can view all users and change roles (with email
                  confirmation).
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            User overview
          </p>
          <dl className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
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

      {/* Users table */}
      <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
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
                Change role
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
                  {u.email ?? "—"}
                </td>
                <td className="px-4 py-3 align-top">{roleBadge(u.role)}</td>
                <td className="px-4 py-3 align-top">
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
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-sm text-slate-500"
                >
                  No other users yet. New sign-ups will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
