// src/app/dashboard/appearance/page.tsx


import { serverSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppearanceClient from "@/components/dashboard/AppearanceClient"; 

export default async function AppearancePage() {
  const supabase = await serverSupabase();
  // getUser() re-verifies the session against Supabase Auth rather than
  // trusting locally-stored session data, per Supabase's own guidance for
  // server-side authorization decisions.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role as "CLIENT" | "AGENT" | "MANAGER" | "ADMIN" | undefined;
  if (role !== "MANAGER" && role !== "ADMIN") redirect("/");

  const { data: widgets, error } = await supabase
    .from("home_widgets")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return <div className="mx-auto max-w-4xl p-6">Error loading widgets: {error.message}</div>;
  }

  return <AppearanceClient initialWidgets={widgets || []} />;
}
