// src/app/compare/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import CompareClient from "@/components/compare/CompareClient";

export const dynamic = "force-dynamic";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

// Compare is a logged-in tool for CLIENT/AGENT/MANAGER/ADMIN — never usable
// anonymously. Mirrors the guard pattern already used by
// src/app/availability/page.tsx and src/app/shortlists/page.tsx.
const ALLOWED_ROLES: Role[] = ["CLIENT", "AGENT", "MANAGER", "ADMIN"];

export default async function ComparePage() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/compare");
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

  return <CompareClient />;
}
