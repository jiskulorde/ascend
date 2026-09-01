// src/app/dashboard/users/page.tsx

import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { getAuthEmailsByUserId } from "@/lib/supabase/authUsers";
import UsersAdminClient from "@/components/dashboard/UsersAdminClient";

export default async function UsersAdminPage() {
  const supabase = await serverSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  // Load current admin profile (no email column here — see authUsers.ts)
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
    .select("id, full_name, role, manager_id")
    .neq("id", me.id)
    .order("full_name", { ascending: true });

  if (usersError) {
    throw new Error(usersError.message);
  }

  // Manager options for the Agent -> Manager assignment control. Admin's own
  // session already has full profiles SELECT via the existing
  // profiles_select_all_admin RLS policy — no service-role read needed here,
  // and no new RLS policy was added for this (Phase 2E stays within Phase
  // 2C/2D's "no new Manager SELECT RLS" boundary; this is Admin's existing
  // access, not a new grant).
  const { data: managers, error: managersError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "MANAGER")
    .order("full_name", { ascending: true });

  if (managersError) {
    throw new Error(managersError.message);
  }

  // Only reachable after the ADMIN check above. Emails live in auth.users,
  // not profiles, so this is the one place that reaches for them — via the
  // service-role Admin API, server-side only, never from browser code.
  // A failure here degrades to showing no emails rather than crashing the
  // whole Accounts page.
  let emailsById = new Map<string, string | null>();
  try {
    emailsById = await getAuthEmailsByUserId();
  } catch (err) {
    console.error("[dashboard/users] failed to load auth emails", err);
  }

  // `undefined` (key absent) means no matching auth.users row was found for
  // this profile id — an account-data inconsistency, surfaced in the UI
  // rather than crashing the page. `null` means the auth user exists but has
  // no email on record.
  const adminEmail = emailsById.has(me.id)
    ? emailsById.get(me.id) ?? null
    : session.user.email ?? null;

  return (
    <UsersAdminClient
      admin={{ ...me, email: adminEmail }}
      initialUsers={(users ?? []).map((u) => ({
        ...u,
        email: emailsById.has(u.id) ? emailsById.get(u.id) ?? null : undefined,
      }))}
      managerOptions={managers ?? []}
    />
  );
}
