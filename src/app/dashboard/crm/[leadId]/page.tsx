// src/app/dashboard/crm/[leadId]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { fetchCrmLeads } from "@/lib/google/crm";

type PageProps = {
  params: { leadId: string };
};

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: PageProps) {
  const { leadId } = params;

  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/auth/login?next=/dashboard/crm/${encodeURIComponent(leadId)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const role = profile?.role as string | undefined;
  if (role !== "MANAGER" && role !== "ADMIN") {
    redirect("/dashboard");
  }

  const leads = await fetchCrmLeads();
  const lead =
    leads.find((l) => l.leadId === leadId) ??
    leads.find((l) => String(l.rowIndex) === leadId);

  if (!lead) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Lead profile
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {lead.fullName || "(No name)"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 break-all">
              {lead.email || "No email"}
              {lead.mobile && ` · ${lead.mobile}`}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Lead ID: {lead.leadId || "—"} · Date inquired:{" "}
              {lead.dateInquired || "—"}
            </p>
          </div>

          <Link
            href="/dashboard/crm"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            Back to CRM
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: project + preferences */}
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3 text-xs text-slate-700">
            <h2 className="text-sm font-semibold text-slate-900">
              Project & preferences
            </h2>

            <div>
              <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                Project inquired
              </p>
              <p className="mt-0.5">{lead.project || "—"}</p>
            </div>

            <div>
              <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                Unit preference
              </p>
              <p className="mt-0.5">{lead.unit || "—"}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  City preference
                </p>
                <p className="mt-0.5">{lead.cityPreference || "Any"}</p>
              </div>
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  Floor level preference
                </p>
                <p className="mt-0.5">{lead.floorPreference || "Any"}</p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                Facing / view preference
              </p>
              <p className="mt-0.5">{lead.facingPreference || "Any"}</p>
            </div>

            <div>
              <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                Source
              </p>
              <p className="mt-0.5">{lead.source || "—"}</p>
            </div>
          </section>

          {/* Right: follow-up / status */}
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3 text-xs text-slate-700">
            <h2 className="text-sm font-semibold text-slate-900">
              Follow-up & status
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  Status
                </p>
                <p className="mt-0.5">{lead.status || "New"}</p>
              </div>
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  Lead owner
                </p>
                <p className="mt-0.5">{lead.owner || "Unassigned"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  Last contact date
                </p>
                <p className="mt-0.5">{lead.lastContact || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  Next follow-up date
                </p>
                <p className="mt-0.5">{lead.nextFollowUp || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  Channel
                </p>
                <p className="mt-0.5">{lead.channel || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  Priority
                </p>
                <p className="mt-0.5">{lead.priority || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  Days since last contact
                </p>
                <p className="mt-0.5">{lead.daysSince || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                  Overdue
                </p>
                <p className="mt-0.5">
                  {lead.overdue || (lead.nextFollowUp ? "On track" : "—")}
                </p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 min-h-[60px]">
                {lead.notes || "No notes yet."}
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
