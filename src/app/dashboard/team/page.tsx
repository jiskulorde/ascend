// src/app/dashboard/team/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

export default async function ManagerTeamPage() {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/team");
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", session.user.id)
    .single();

  const myRole = (me?.role as string) ?? "CLIENT";
  if (myRole !== "MANAGER" && myRole !== "ADMIN") {
    redirect("/dashboard");
  }

  const meName = me?.full_name || session.user.email;

  const { data: team, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .neq("role", "CLIENT")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  const rows: ProfileRow[] = team || [];

  const totalAgents = rows.filter((r) => r.role === "AGENT").length;
  const totalManagers = rows.filter((r) => r.role === "MANAGER").length;
  const totalAdmins = rows.filter((r) => r.role === "ADMIN").length;

  return (
    <main className="px-4 py-6 md:px-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Team &amp; ads schedule
        </h1>
        <p className="text-sm text-muted-foreground">
          View your internal team. Later, you can assign ad duty and lead
          coverage here.
        </p>
      </header>

      {/* Overview cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Manager
          </p>
          <p className="text-sm font-semibold">{meName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You can see all non-client accounts (Agents, Managers, Admins).
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Team size
          </p>
          <p className="text-xl font-semibold">{rows.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Internal users only; client accounts are hidden here.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Roles
          </p>
          <p className="text-xs text-muted-foreground">
            Agents: <span className="font-semibold">{totalAgents}</span> ·
            Managers: <span className="font-semibold">{totalManagers}</span> ·
            Admins: <span className="font-semibold">{totalAdmins}</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Role changes are managed in the Admin &gt; Users screen with email
            confirmation.
          </p>
        </div>
      </section>

      {/* Team list */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Team members</h2>
          {error && (
            <p className="text-[11px] text-red-600">
              Error loading team: {error.message}
            </p>
          )}
        </div>

        <div className="divide-y divide-border">
          {rows.length === 0 && (
            <p className="py-4 text-xs text-muted-foreground">
              No team members yet. Invite agents and managers by creating
              accounts and assigning roles in the Admin &gt; Users panel.
            </p>
          )}

          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {row.full_name || "Unnamed user"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ID: {row.id.slice(0, 8)}…
                </p>
              </div>

              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                  row.role === "ADMIN"
                    ? "bg-black text-white"
                    : row.role === "MANAGER"
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-sky-50 text-sky-700"
                }`}
              >
                {row.role ?? "ROLE"}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Next step: add a per-day ad duty schedule table (e.g. &ldquo;Dec 4 –
          Agent 1&rdquo;) and connect it to your Google Sheet or a Supabase
          table.
        </p>
      </section>
    </main>
  );
}
