// src/components/RoleChangeClient.tsx
"use client";

import { useState } from "react";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

type Props = {
  token: string;
  requestedRole: Role | string;
  initialStatus: "PENDING" | "APPROVED" | "REJECTED";
  adminName: string;
  createdAt: string;
};

export default function RoleChangeClient({
  token,
  requestedRole,
  initialStatus,
  adminName,
  createdAt,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState<"APPROVE" | "REJECT" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const disabled = status !== "PENDING" || loading !== null;

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    setError(null);
    setMessage(null);
    setLoading(decision);

    try {
      const res = await fetch("/api/admin/role-change-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setStatus(data.status);
      if (decision === "APPROVE") {
        setMessage(
          `Your role has been updated to ${data.newRole}. You may need to refresh the page or sign out/in to see all changes.`
        );
      } else {
        setMessage("You have rejected this role change request.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(null);
    }
  };

  const prettyDate = new Date(createdAt).toLocaleString();

  return (
    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
          <ShieldAlert size={20} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Confirm role change
          </h1>
          <p className="text-xs text-slate-500">
            Requested by {adminName} • {prettyDate}
          </p>
        </div>
      </div>

      <div className="space-y-3 text-sm text-slate-700">
        <p>
          An administrator is requesting to change your account role to:
        </p>
        <p className="text-center text-base font-semibold">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-800">
            {String(requestedRole)}
          </span>
        </p>
        <p className="text-xs text-slate-500">
          Your role controls what you can access inside Ascend • DMCI. Please
          only approve this if you recognize the request.
        </p>
      </div>

      {status === "APPROVED" && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 border border-emerald-200">
          <CheckCircle2 size={16} className="mt-[2px]" />
          <div>
            <p className="font-semibold">Role change approved</p>
            <p>{message}</p>
          </div>
        </div>
      )}

      {status === "REJECTED" && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-800 border border-red-200">
          <XCircle size={16} className="mt-[2px]" />
          <div>
            <p className="font-semibold">Role change rejected</p>
            <p>{message}</p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {status === "PENDING" && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleDecision("REJECT")}
            className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading === "REJECT" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleDecision("APPROVE")}
            className="inline-flex justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {loading === "APPROVE" ? "Approving…" : "Approve & update role"}
          </button>
        </div>
      )}

      {status !== "PENDING" && (
        <p className="mt-4 text-center text-xs text-slate-400">
          This request is no longer pending.
        </p>
      )}
    </div>
  );
}
