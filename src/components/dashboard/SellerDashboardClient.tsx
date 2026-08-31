// src/components/dashboard/SellerDashboardClient.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock,
  FolderOpen,
  FolderPlus,
  GitCompareArrows,
  BarChart3,
  RefreshCw,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QuickActionsGrid, { type QuickAction } from "@/components/dashboard/QuickActionsGrid";
import { firstNameOf, timeOfDayGreeting } from "@/lib/dashboard/greeting";
import type { AttentionItem, SellerSummaryResponse, ShortlistSummary } from "@/lib/dashboard/types";

type LoadState = "loading" | "ready" | "error";
type Role = "AGENT" | "MANAGER" | "ADMIN";

const MAX_SHORTLISTS_SHOWN = 5;
const MAX_ATTENTION_SHOWN = 5;

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Browse Availability", href: "/availability", icon: Search },
  { label: "View Summary", href: "/summary", icon: BarChart3 },
  { label: "Client Shortlists", href: "/shortlists", icon: FolderOpen },
  { label: "Compare Units", href: "/compare", icon: GitCompareArrows },
];

// Compact millions formatting for dense attention rows: ₱4,790,000 -> "₱4.79M".
// Full precision (2 decimals, PHP currency symbol) below 1M.
function fmtCompactPhp(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`;
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
}

// "HH:mm:ss" (24h, as read from the Process Log sheet) -> "8:42 AM".
function to12Hour(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time || "");
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

export default function SellerDashboardClient({
  fullName,
  email,
  role,
}: {
  fullName: string | null;
  email: string | null;
  role: Role;
}) {
  const [summary, setSummary] = useState<SellerSummaryResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    // Computed on mount (not during SSR) so the greeting reflects the
    // viewer's local time instead of the server's, without risking a
    // hydration mismatch between the two.
    setGreeting(timeOfDayGreeting(new Date()));
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/dashboard/seller-summary", { cache: "no-store" });
      if (!res.ok) {
        setState("error");
        return;
      }
      const json = (await res.json()) as SellerSummaryResponse;
      setSummary(json);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = firstNameOf(fullName, email);
  const roleLabel = role === "ADMIN" ? "Admin" : role === "MANAGER" ? "Manager" : "Agent";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{roleLabel}</p>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {greeting}, {firstName}
        </h1>
      </header>

      <QuickActionsGrid actions={QUICK_ACTIONS} />

      {state === "error" && (
        <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <h2 className="text-sm font-semibold text-foreground">Couldn&apos;t load your dashboard data</h2>
          <p className="max-w-sm text-xs text-muted-foreground">
            Quick actions above still work. Try reloading your shortlists and inventory summary.
          </p>
          <Button variant="outline" size="sm" onClick={load} className="mt-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </Card>
      )}

      {state !== "error" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MyShortlistsSection state={state} shortlists={summary?.shortlists ?? []} />
          </div>

          <div className="space-y-4">
            <NeedsAttentionSection
              state={state}
              available={summary?.attention.available ?? true}
              items={summary?.attention.items ?? []}
              totalCount={summary?.attention.totalCount ?? 0}
            />
            <InventorySnapshotSection
              state={state}
              available={summary?.inventory.available ?? true}
              availableUnitCount={summary?.inventory.availableUnitCount ?? null}
              latestLog={summary?.inventory.latestLog ?? null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function MyShortlistsSection({ state, shortlists }: { state: LoadState; shortlists: ShortlistSummary[] }) {
  if (state === "loading") {
    return (
      <SectionCard title="My Client Shortlists">
        <div className="space-y-2" role="status" aria-label="Loading shortlists">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (shortlists.length === 0) {
    return (
      <SectionCard title="My Client Shortlists">
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FolderPlus className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No client shortlists yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Save units from Availability into a shortlist to start tracking options for a client.
          </p>
          <Button asChild size="sm" className="mt-1">
            <Link href="/shortlists">View Shortlists</Link>
          </Button>
        </div>
      </SectionCard>
    );
  }

  const shown = shortlists.slice(0, MAX_SHORTLISTS_SHOWN);

  return (
    <SectionCard title="My Client Shortlists">
      <ul className="divide-y divide-slate-100">
        {shown.map((s) => (
          <li key={s.id}>
            <Link
              href={`/shortlists/${s.id}`}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.unit_count} unit{s.unit_count !== 1 ? "s" : ""}
                  {s.attention_count ? (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-amber-700">
                      • {s.attention_count} change{s.attention_count !== 1 ? "s" : ""}
                    </span>
                  ) : null}
                  {" • "}
                  Updated {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/shortlists"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--primary)] hover:underline"
      >
        View all Shortlists
        <ChevronRight className="h-3 w-3" />
      </Link>
    </SectionCard>
  );
}

function attentionTag(item: AttentionItem): { label: string; tone: string } {
  if (item.status === "missing") {
    return { label: "No longer in inventory", tone: "bg-red-50 text-red-700 border-red-100" };
  }
  const kinds = item.changes.map((c) => c.kind);
  if (kinds.includes("PRICE_CHANGED") && kinds.includes("STATUS_CHANGED")) {
    return { label: "Price & status changed", tone: "bg-amber-50 text-amber-700 border-amber-100" };
  }
  if (kinds.includes("PRICE_CHANGED")) {
    return { label: "Price changed", tone: "bg-amber-50 text-amber-700 border-amber-100" };
  }
  return { label: "Status changed", tone: "bg-blue-50 text-blue-700 border-blue-100" };
}

function NeedsAttentionSection({
  state,
  available,
  items,
  totalCount,
}: {
  state: LoadState;
  available: boolean;
  items: AttentionItem[];
  totalCount: number;
}) {
  if (state === "loading") {
    return (
      <SectionCard title="Needs Attention">
        <div className="space-y-2" role="status" aria-label="Checking for changes">
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
        </div>
      </SectionCard>
    );
  }

  if (!available) {
    return (
      <SectionCard title="Needs Attention">
        <p className="text-xs text-muted-foreground">
          Inventory data is temporarily unavailable, so shortlist changes can&apos;t be checked right now.
        </p>
      </SectionCard>
    );
  }

  if (totalCount === 0) {
    return (
      <SectionCard title="Needs Attention">
        <p className="text-xs text-muted-foreground">No shortlist changes need attention.</p>
      </SectionCard>
    );
  }

  const shown = items.slice(0, MAX_ATTENTION_SHOWN);
  const remaining = totalCount - shown.length;

  return (
    <SectionCard title="Needs Attention">
      <ul className="space-y-2.5">
        {shown.map((item) => {
          const tag = attentionTag(item);
          return (
            <li key={item.shortlist_unit_id}>
              <Link
                href={`/shortlists/${item.shortlist_id}`}
                className="block rounded-lg border border-slate-100 p-2.5 hover:border-slate-200 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tag.tone}`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {tag.label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>

                <p className="mt-1.5 truncate text-xs font-medium text-slate-900">{item.property_label}</p>

                <div className="mt-1 space-y-0.5">
                  {item.status === "missing" ? (
                    <p className="text-[11px] text-muted-foreground">
                      Saved at {fmtCompactPhp(item.saved_price)}
                      {item.saved_status ? ` • Last known status: ${item.saved_status}` : ""}
                    </p>
                  ) : (
                    item.changes.map((change, i) =>
                      change.kind === "PRICE_CHANGED" ? (
                        <p key={i} className="text-[11px] text-muted-foreground">
                          {fmtCompactPhp(change.saved_price)} → {fmtCompactPhp(change.current_price)}
                        </p>
                      ) : (
                        <p key={i} className="text-[11px] text-muted-foreground">
                          {change.saved_status || "—"} → {change.current_status}
                        </p>
                      )
                    )
                  )}
                </div>

                <p className="mt-1 truncate text-[11px] text-muted-foreground/80">{item.shortlist_name}</p>
              </Link>
            </li>
          );
        })}
      </ul>

      {remaining > 0 && (
        <Link
          href="/shortlists"
          className="mt-3 inline-block text-xs font-medium text-[color:var(--primary)] hover:underline"
        >
          + {remaining} more
        </Link>
      )}
    </SectionCard>
  );
}

function InventorySnapshotSection({
  state,
  available,
  availableUnitCount,
  latestLog,
}: {
  state: LoadState;
  available: boolean;
  availableUnitCount: number | null;
  latestLog: { date: string; time: string; fileName: string } | null;
}) {
  if (state === "loading") {
    return (
      <SectionCard title="Inventory">
        <div className="h-16 animate-pulse rounded-lg bg-muted" role="status" aria-label="Loading inventory snapshot" />
      </SectionCard>
    );
  }

  if (!available) {
    return (
      <SectionCard title="Inventory">
        <p className="text-xs text-muted-foreground">Inventory data is temporarily unavailable.</p>
        <Button asChild variant="outline" size="sm" className="mt-3 w-full">
          <Link href="/availability">
            <Building2 className="h-3.5 w-3.5" />
            Browse Availability
          </Link>
        </Button>
      </SectionCard>
    );
  }

  const time12h = latestLog ? to12Hour(latestLog.time) : "";

  return (
    <SectionCard title="Inventory">
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-slate-900">
          {availableUnitCount != null ? availableUnitCount.toLocaleString() : "—"}
        </span>
        <span className="text-xs text-muted-foreground">Available Units</span>
      </div>

      {latestLog && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last updated {latestLog.date}
          {time12h ? ` • ${time12h}` : ""}
        </p>
      )}

      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
        <Link href="/availability">
          <Search className="h-3.5 w-3.5" />
          Browse Availability
        </Link>
      </Button>
    </SectionCard>
  );
}
