// src/app/availability/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import AvailabilityClient from "@/components/availability/AvailabilityClient";

export const dynamic = "force-dynamic";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

const ALLOWED_ROLES: Role[] = ["CLIENT", "AGENT", "MANAGER", "ADMIN"];

export default async function AvailabilityPage() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/availability");
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

  return <AvailabilityClient />;
}