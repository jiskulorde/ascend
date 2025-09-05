import { serverSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppearanceClient from "@/components/dashboard/AppearanceClient"; 

export default async function AppearancePage() {
  const supabase = await serverSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
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
