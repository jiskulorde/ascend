// src/app/clients/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import ClientPropertiesClient from "@/components/clients/ClientPropertiesClient";

export const dynamic = "force-dynamic";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

// This page is an orphaned, un-audited legacy inventory listing (no seller
// actions — the "View Details" button isn't wired to anything, so it isn't
// treated as a seller tool). It's not linked from primary navigation and
// isn't being redesigned here; it's only being closed off as an anonymous
// full-inventory bypass now that GET /api/availability requires a session.
// Any authenticated role may still reach it, same as before this fix.
const ALLOWED_ROLES: Role[] = ["CLIENT", "AGENT", "MANAGER", "ADMIN"];

export default async function ClientsPage() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/clients");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "CLIENT") as Role;

  if (!ALLOWED_ROLES.includes(role)) {
    redirect("/403");
  }

  return <ClientPropertiesClient />;
}
