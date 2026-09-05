// src/components/dashboard/ClientDashboardClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Calculator, GitCompareArrows, Search, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import QuickActionsGrid, { type QuickAction } from "@/components/dashboard/QuickActionsGrid";
import { firstNameOf, timeOfDayGreeting } from "@/lib/dashboard/greeting";

// No seller-summary (or any other) fetch here — CLIENT never calls the
// AGENT/MANAGER/ADMIN-only /api/dashboard/seller-summary endpoint, and an
// Inventory Snapshot card is deliberately omitted rather than adding a full
// authenticated inventory fetch just for a decorative count (see the Phase 4
// dashboard plan: "omit rather than overengineer").
const QUICK_ACTIONS: QuickAction[] = [
  { label: "Browse Availability", href: "/availability", icon: Search },
  { label: "Lowest Price Summary", href: "/summary", icon: BarChart3 },
  { label: "Compare Units", href: "/compare", icon: GitCompareArrows },
  { label: "Payment Computation", href: "/computation", icon: Calculator },
];

export default function ClientDashboardClient({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string | null;
}) {
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    setGreeting(timeOfDayGreeting(new Date()));
  }, []);

  const firstName = firstNameOf(fullName, email);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {greeting}, {firstName}
        </h1>
      </header>

      <QuickActionsGrid actions={QUICK_ACTIONS} />

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[color:var(--primary)]" />
          <h2 className="text-sm font-semibold text-slate-900">More resources</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/buyers-guide"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Buyer’s Guide
          </Link>
          <Link
            href="/projects"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Browse Projects
          </Link>
        </div>
      </Card>
    </div>
  );
}
