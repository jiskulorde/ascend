// src/app/dashboard/crm/page.tsx
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { fetchCrmLeads } from "@/lib/google/crm";
import CrmClient from "@/components/dashboard/CrmClient";

export const dynamic = "force-dynamic";

export default async function ManagerCrmPage() {
  const supabase = await serverSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login?next=/dashboard/crm");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", session.user.id)
    .single();

  const role = (profile?.role as string) ?? "CLIENT";
  if (role !== "MANAGER" && role !== "ADMIN") {
    redirect("/dashboard");
  }

  const managerEmail = session.user.email ?? "";
  const managerName = profile?.full_name ?? null;

  const leads = await fetchCrmLeads();

  return (
    <CrmClient
      managerEmail={managerEmail}
      managerName={managerName}
      initialLeads={leads}
    />
  );
}
