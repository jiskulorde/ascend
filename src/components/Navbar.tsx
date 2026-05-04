// src/components/Navbar.tsx

import { serverSupabase } from "@/lib/supabase/server";
import NavbarClient from "./NavbarClient";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

export default async function Navbar() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: Role | undefined;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    role = profile?.role as Role | undefined;
  }

  return <NavbarClient initialSignedIn={!!user} initialRole={role} />;
}