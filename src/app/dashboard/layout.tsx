// src/app/dashboard/layout.tsx

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

type NavItem = { label: string; href: string };

async function getSessionAndRole() {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { session: null, role: null, name: null, email: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", session.user.id)
    .single();

  const role = (profile?.role || "CLIENT") as Role;

  return {
    session,
    role,
    name: profile?.full_name ?? session.user.email ?? "Ascend user",
    email: session.user.email ?? "",
  };
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: "Overview", href: "/dashboard" },
    { label: "Users", href: "/dashboard/users" },          
    { label: "Security", href: "/dashboard/security" },
    { label: "Audit logs", href: "/dashboard/audit-logs" },
    { label: "System data", href: "/dashboard/system" },
  ],
  MANAGER: [
    { label: "Overview", href: "/dashboard" },
    { label: "Team & ads schedule", href: "/dashboard/team" },
    { label: "CRM", href: "/dashboard/crm" },
    { label: "Reports", href: "/dashboard/reports" },
    { label: "Home appearance", href: "/dashboard/appearance" },
  ],
  AGENT: [
    { label: "My dashboard", href: "/dashboard" },
    { label: "My clients", href: "/dashboard/clients" },
    { label: "Calendar", href: "/dashboard/calendar" },
  ],
  CLIENT: [
    { label: "My dashboard", href: "/dashboard" },
  ],
};

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session, role, name, email } = await getSessionAndRole();

  // Guard: only logged in users can see /dashboard
  if (!session) {
    redirect("/auth/login");
  }

  const safeRole = (role || "CLIENT") as Role;
  const navItems = NAV_BY_ROLE[safeRole];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      {/* We keep your global Navbar above; this container starts under it */}
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-6">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 md:flex md:flex-col">
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Profile
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-600/90 text-white flex items-center justify-center text-sm font-semibold">
                {name?.[0]?.toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-900">
                  {name}
                </span>
                <span className="text-xs text-slate-500">{email}</span>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
              {safeRole}
            </div>
          </div>

          <nav className="rounded-2xl bg-white p-3 shadow-sm border border-slate-100">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Dashboard
            </p>
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            <form action="/auth/signout" method="post" className="mt-4">
              <button
                type="submit"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
