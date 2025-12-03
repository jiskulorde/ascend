// src/app/dashboard/page.tsx

import { serverSupabase } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // This should always exist because layout already guards, but just in case:
  if (!session) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", session.user.id)
    .single();

  const role = (profile?.role || "CLIENT") as
    | "CLIENT"
    | "AGENT"
    | "MANAGER"
    | "ADMIN";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {role === "ADMIN"
          ? "Admin overview"
          : role === "MANAGER"
          ? "Manager overview"
          : role === "AGENT"
          ? "My sales dashboard"
          : "My dashboard"}
      </h1>

      <p className="text-sm text-slate-600">
        Welcome {profile?.full_name || session.user.email}.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Quick actions</h2>
          <p className="text-xs text-slate-500">
            Jump to CRM, ads schedule, or availability.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Today</h2>
          <p className="text-xs text-slate-500">
            Later we can show follow-ups due today and ad duty here.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-1">Status</h2>
          <p className="text-xs text-slate-500">
            Manager/admin views can show lead counts & campaign stats.
          </p>
        </div>
      </div>
    </div>
  );
}
