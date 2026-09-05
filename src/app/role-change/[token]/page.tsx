// src/app/role-change/[token]/page.tsx

import { serverSupabase } from "@/lib/supabase/server";
import { requireActivePage } from "@/lib/auth/role";
import RoleChangeClient from "@/components/RoleChangeClient";

type PageProps = {
  params: { token: string };
};

export default async function RoleChangePage({ params }: PageProps) {
  const token = params.token;

  // A PENDING/SUSPENDED/DEACTIVATED/EXPIRED target — or one whose profile
  // can't even be verified — must never see this confirmation UI at all
  // (the API would reject it anyway; see requireActiveApiAccount in
  // role-change-confirm/route.ts). requireActivePage() fails closed on a
  // missing/unreadable profile (-> /account/status), never getCurrentUser()'s
  // CLIENT/ACTIVE fallback, before the token is even looked up.
  const currentUser = await requireActivePage(`/role-change/${token}`);

  const supabase = await serverSupabase();

  // Find the role-change request by token
  const { data: request, error } = await supabase
    .from("role_change_requests")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !request) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Role change
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This link is invalid, expired, or has already been used.
        </p>
      </main>
    );
  }

  // Only the target user can use this link (extra safety)
  if (request.target_user_id !== currentUser.id) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Role change
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You do not have access to this role change request.
        </p>
      </main>
    );
  }

  // Get info about the admin who requested the change
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", request.requested_by)
    .single();

  const adminName =
    adminProfile?.full_name || adminProfile?.email || "an administrator";

  return (
    <main className="mx-auto flex min-h-[60vh] items-center justify-center px-4 py-10">
      <RoleChangeClient
        token={token}
        requestedRole={request.requested_role}
        initialStatus={request.status}
        adminName={adminName}
        createdAt={request.created_at}
      />
    </main>
  );
}
