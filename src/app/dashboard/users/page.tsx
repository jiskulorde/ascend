// src/app/dashboard/users/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import UsersAdminClient from "@/components/dashboard/UsersAdminClient";

export default async function UsersAdminPage() {
  const supabase = await serverSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const adminEmail = session.user.email ?? "";

  // Load current admin profile (no email column here)
  const { data: me, error: meError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", session.user.id)
    .single();

  if (meError || !me) {
    throw new Error(meError?.message || "Admin profile not found");
  }

  if (me.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Load all OTHER users (no email column here either)
  const { data: users, error: usersError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .neq("id", me.id)
    .order("full_name", { ascending: true });

  if (usersError) {
    throw new Error(usersError.message);
  }

  return (
    <UsersAdminClient
      admin={{ ...me, email: adminEmail }}
      initialUsers={(users ?? []).map((u) => ({ ...u, email: null }))}
    />
  );
}
