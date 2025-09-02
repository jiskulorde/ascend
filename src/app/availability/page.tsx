// src/app/availability/page.tsx
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import AvailabilityClient from "@/components/availability/AvailabilityClient";

export default async function AvailabilityPage() {
  // Authenticate on the server (trusted)
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/availability");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed = profile?.role === "AGENT" || profile?.role === "MANAGER";
  if (!allowed) {
    redirect("/403");
  }

  // Render the client UI
  return <AvailabilityClient />;
}
