// src/app/dashboard/agents/page.tsx
import { redirect } from "next/navigation";
import { requireActivePage } from "@/lib/auth/role";
import MyAgentsClient from "@/components/dashboard/MyAgentsClient";

export const dynamic = "force-dynamic";

// Manager-only. AGENT/CLIENT never reach this (no nav link, and gated here
// too). ADMIN is deliberately also redirected — Admin manages every
// Agent/Manager relationship from /dashboard/users, not this per-manager
// roster, and GET /api/manager/agents itself is MANAGER-only, so letting
// ADMIN view this page would just show an error from that API anyway.
//
// requireActivePage() fails closed on PENDING/SUSPENDED/DEACTIVATED/
// EXPIRED/unverifiable accounts before the role check below — previously
// this page used getCurrentUser() (role-only, no lifecycle awareness).
export default async function MyAgentsPage() {
  const currentUser = await requireActivePage("/dashboard/agents");

  if (currentUser.role !== "MANAGER") {
    redirect("/dashboard");
  }

  return <MyAgentsClient />;
}
