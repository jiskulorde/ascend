// src/app/dashboard/agents/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/role";
import MyAgentsClient from "@/components/dashboard/MyAgentsClient";

export const dynamic = "force-dynamic";

// Manager-only. AGENT/CLIENT never reach this (no nav link, and gated here
// too). ADMIN is deliberately also redirected — Admin manages every
// Agent/Manager relationship from /dashboard/users, not this per-manager
// roster, and GET /api/manager/agents itself is MANAGER-only, so letting
// ADMIN view this page would just show an error from that API anyway.
export default async function MyAgentsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/auth/login?next=/dashboard/agents");
  }

  if (currentUser.role !== "MANAGER") {
    redirect("/dashboard");
  }

  return <MyAgentsClient />;
}
