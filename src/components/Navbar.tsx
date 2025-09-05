import { serverSupabase } from "@/lib/supabase/server";
import NavbarClient from "./NavbarClient";

export default async function Navbar() {
  const supabase = await serverSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  let role: "CLIENT" | "AGENT" | "MANAGER" | "ADMIN" | undefined;

  if (session) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    role = profile?.role as any;
  }

  return <NavbarClient initialSignedIn={!!session} initialRole={role} />;
}
