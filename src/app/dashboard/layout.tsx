// src/app/dashboard/layout.tsx

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

// Auth guard only. middleware.ts (repo root) already requires a signed-in
// session for every /dashboard/:path* request regardless of role — this is
// defense-in-depth matching the same inline-guard pattern every other
// protected page in the app uses (see src/app/summary/page.tsx,
// src/app/shortlists/page.tsx, etc.), not the primary enforcement.
//
// The global Navbar (src/components/Navbar.tsx, rendered once in the root
// layout) is the app's one primary navigation surface. This layout no longer
// renders its own permanent sidebar/nav list — unfinished sub-routes under
// /dashboard/* (crm, team, users, reports, appearance) still exist and still
// work if visited directly; they're just no longer exposed through a
// duplicate nav shell here. Dashboard is a content area now, not a second
// nav surface.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/dashboard");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
