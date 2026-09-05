import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

export default async function AgentHome() {
  const supabase = await serverSupabase();
  // getUser() re-verifies the session against Supabase Auth rather than
  // trusting locally-stored session data, per Supabase's own guidance for
  // server-side authorization decisions.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/agent");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed = profile?.role === "AGENT" || profile?.role === "MANAGER";
  if (!allowed) redirect("/403");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Agent • Tools</h1>
      <p className="muted mt-1">Your leads, inventory, and calculators go here.</p>
    </main>
  );
}
