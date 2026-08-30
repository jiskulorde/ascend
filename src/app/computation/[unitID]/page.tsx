// src/app/computation/[unitID]/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import ComputationDetailClient from "@/components/computation/ComputationDetailClient";

export const dynamic = "force-dynamic";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

const ALLOWED_ROLES: Role[] = ["CLIENT", "AGENT", "MANAGER", "ADMIN"];

export default async function ComputationDetailPage({
  params,
}: {
  params: Promise<{ unitID: string }>;
}) {
  const { unitID } = await params;
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/computation/${unitID}`)}`);
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

  return <ComputationDetailClient />;
}
