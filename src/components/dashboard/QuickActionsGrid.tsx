// src/components/dashboard/QuickActionsGrid.tsx
"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// 2x2 on mobile (compact, no horizontal overflow), a single row of 4 from
// sm+ up. Shared between the seller and client dashboards so both stay
// visually identical for this pattern — only the action list differs.
export default function QuickActionsGrid({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {actions.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-center shadow-sm transition hover:border-[color:var(--primary)]/40 hover:bg-slate-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-slate-700">{label}</span>
        </Link>
      ))}
    </div>
  );
}
