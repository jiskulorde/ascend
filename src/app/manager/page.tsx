import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

export default async function ManagerHome() {
  const supabase = await serverSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/auth/login?next=/manager");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const allowed = profile?.role === "MANAGER";
  if (!allowed) redirect("/403");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Manager • Console</h1>
      <p className="muted mt-1">Team KPIs, reports, and assignments go here.</p>
    </main>
  );
}
