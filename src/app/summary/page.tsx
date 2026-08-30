// src/app/summary/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import SummaryClient from "@/components/summary/SummaryClient";

export const dynamic = "force-dynamic";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

// Summary is a seller/buyer tool — any authenticated role may use it, but it
// must never be reachable by an anonymous visitor. Mirrors the guard pattern
// already used by src/app/availability/page.tsx and src/app/shortlists/page.tsx.
const ALLOWED_ROLES: Role[] = ["CLIENT", "AGENT", "MANAGER", "ADMIN"];

export default async function SummaryPage() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/summary");
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

  return <SummaryClient />;
}
