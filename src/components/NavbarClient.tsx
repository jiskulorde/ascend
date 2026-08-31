// src/components/NavbarClient.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown, User } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/client";
import PreviewSwitch from "@/components/PreviewSwitch";

type SimpleLink = {
  kind: "link";
  label: string;
  href: string;
};

type DropdownLink = {
  kind: "dropdown";
  id: string;
  label: string;
  items: SimpleLink[];
};

type NavLink = SimpleLink | DropdownLink;

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN" | undefined;

type Props = {
  initialSignedIn: boolean;
  initialRole?: Exclude<Role, undefined>;
};

const SELLER_ROLES: Exclude<Role, undefined>[] = ["AGENT", "MANAGER", "ADMIN"];

// Public/CLIENT nav — identical for both (Phase 1: CLIENT is a buyer account
// with no seller tools, so it gets the exact same flat nav as an anonymous
// visitor, not a cut-down version of the seller nav). No "More" dropdown —
// five flat items is compact enough on its own.
const PUBLIC_LINKS: NavLink[] = [
  { kind: "link", label: "Home", href: "/" },
  { kind: "link", label: "Projects", href: "/projects" },
  { kind: "link", label: "Availability", href: "/availability" },
  { kind: "link", label: "Buyer’s Guide", href: "/buyers-guide" },
  { kind: "link", label: "About Us", href: "/about" },
];

// AGENT/MANAGER: full seller toolset. MANAGER gets the identical nav for now
// — a "My Agents"/"Agents" entry was scoped for this phase but there is no
// real, non-placeholder route to point it at yet (dashboard/team is an
// unscoped "every non-client account" list, not a per-manager roster), so it
// is deliberately not added rather than shipping a fake link.
const SELLER_MORE_DROPDOWN: DropdownLink = {
  kind: "dropdown",
  id: "seller-more",
  label: "More",
  items: [
    { kind: "link", label: "Computation", href: "/computation" },
    { kind: "link", label: "Projects", href: "/projects" },
    { kind: "link", label: "Buyer’s Guide", href: "/buyers-guide" },
    { kind: "link", label: "About Us", href: "/about" },
  ],
};

const SELLER_LINKS: NavLink[] = [
  { kind: "link", label: "Dashboard", href: "/dashboard" },
  { kind: "link", label: "Availability", href: "/availability" },
  { kind: "link", label: "Summary", href: "/summary" },
  { kind: "link", label: "Shortlists", href: "/shortlists" },
  { kind: "link", label: "Compare", href: "/compare" },
  SELLER_MORE_DROPDOWN,
];

// ADMIN: governance-first nav rather than an Agent navbar with an extra
// badge. Sales Tools groups every seller page behind one dropdown so the top
// level reads as "Control Center / Accounts / Sales Tools / More" per the
// Phase 1 nav matrix. Approvals/Audit Logs/Security/Subscriptions are
// deliberately absent — those routes don't exist yet.
const ADMIN_SALES_TOOLS_DROPDOWN: DropdownLink = {
  kind: "dropdown",
  id: "admin-sales-tools",
  label: "Sales Tools",
  items: [
    { kind: "link", label: "Availability", href: "/availability" },
    { kind: "link", label: "Summary", href: "/summary" },
    { kind: "link", label: "Shortlists", href: "/shortlists" },
    { kind: "link", label: "Compare", href: "/compare" },
    { kind: "link", label: "Computation", href: "/computation" },
  ],
};

const ADMIN_MORE_DROPDOWN: DropdownLink = {
  kind: "dropdown",
  id: "admin-more",
  label: "More",
  items: [
    { kind: "link", label: "Projects", href: "/projects" },
    { kind: "link", label: "Buyer’s Guide", href: "/buyers-guide" },
    { kind: "link", label: "About Us", href: "/about" },
  ],
};

const ADMIN_LINKS: NavLink[] = [
  { kind: "link", label: "Control Center", href: "/dashboard" },
  { kind: "link", label: "Accounts", href: "/dashboard/users" },
  ADMIN_SALES_TOOLS_DROPDOWN,
  ADMIN_MORE_DROPDOWN,
];

// Purely presentational — the real access control lives in middleware.ts and
// each page's own server-side guard (see src/app/*/page.tsx). This only
// decides what the navbar *shows*, never what it enforces.
function getMainLinks(isSignedIn: boolean, role: Role): NavLink[] {
  if (!isSignedIn) return PUBLIC_LINKS;

  if (role === "ADMIN") return ADMIN_LINKS;
  if (role === "AGENT" || role === "MANAGER") return SELLER_LINKS;

  // CLIENT (or a signed-in session with no recognized role yet) — same
  // public nav as an anonymous visitor, never the seller toolset.
  return PUBLIC_LINKS;
}

export default function NavbarClient({ initialSignedIn, initialRole }: Props) {
  const pathname = usePathname();
  const supabase = browserSupabase();

  const [isSignedIn, setIsSignedIn] = useState(initialSignedIn);
  const [role, setRole] = useState<Role>(initialRole);
  const [checkingProfile, setCheckingProfile] = useState(false);

  const [openDropdown, setOpenDropdown] = useState<null | string>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function syncProfile(userId?: string) {
      if (!userId) {
        if (!mounted) return;
        setIsSignedIn(false);
        setRole(undefined);
        setCheckingProfile(false);
        return;
      }

      setCheckingProfile(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;

      setIsSignedIn(true);
      setRole(profile?.role as Role);
      setCheckingProfile(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      void syncProfile(data.session?.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncProfile(session?.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  const effectiveRole = role || "CLIENT";
  const isSeller = SELLER_ROLES.includes(effectiveRole);
  const mainLinks = getMainLinks(isSignedIn, role);

  const mobileSectionTitle = !isSignedIn
    ? "EXPLORE"
    : role === "ADMIN"
    ? "GOVERNANCE"
    : isSeller
    ? "SALES TOOLS"
    : "EXPLORE";

  const mobilePrimaryLinks = mainLinks.filter((l): l is SimpleLink => l.kind === "link");
  // Admin has two dropdowns (Sales Tools + More) — render every dropdown in
  // mainLinks as its own mobile section, not just the first one found.
  const mobileDropdowns = mainLinks.filter((l): l is DropdownLink => l.kind === "dropdown");

  const shell =
    "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-border";

  const navLinkBase =
    "rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition";

  const navLinkActive =
    "bg-slate-100 text-[color:var(--primary)] border border-slate-200";

  const dropdownPanel =
    "absolute left-0 mt-2 w-56 rounded-2xl border border-slate-100 bg-white text-slate-900 shadow-xl z-40 py-1";

  // CLIENT has no dashboard to open (Phase 1: buyer accounts get no seller
  // dashboard) — the profile menu only offers it to seller/admin roles.
  const canOpenDashboard = isSeller;
  const dashboardLinkLabel = role === "ADMIN" ? "Open Control Center" : "Open dashboard";

  const profileLabel =
    role === "ADMIN"
      ? "Control Center"
      : role === "MANAGER"
      ? "Manager dashboard"
      : role === "AGENT"
      ? "My dashboard"
      : "My account";

  return (
    <nav className={`sticky top-0 z-50 ${shell}`}>
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex h-16 items-center justify-between gap-3" ref={rootRef}>
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[color:var(--primary)]" />
            <span className="text-lg font-semibold tracking-tight md:text-xl">
              <span className="text-[color:var(--primary)]">Ascend</span> • DMCI
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {mainLinks.map((link) =>
              link.kind === "dropdown" ? (
                <div key={link.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown((v) => (v === link.id ? null : link.id))}
                    className={`${navLinkBase} inline-flex items-center gap-1 ${
                      openDropdown === link.id || link.items.some((i) => isActive(i.href))
                        ? navLinkActive
                        : ""
                    }`}
                  >
                    {link.label}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${
                        openDropdown === link.id ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <div
                    className={`${dropdownPanel} transition-all duration-150 ${
                      openDropdown === link.id
                        ? "scale-100 opacity-100 pointer-events-auto"
                        : "scale-95 opacity-0 pointer-events-none"
                    }`}
                  >
                    {link.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`mx-1 my-0.5 block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100/80 ${
                          isActive(item.href) ? "bg-slate-100 font-medium" : ""
                        }`}
                        onClick={() => setOpenDropdown(null)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${navLinkBase} ${isActive(link.href) ? navLinkActive : ""}`}
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {isSignedIn ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)]">
                    <User size={14} />
                  </div>

                  <span className="hidden uppercase tracking-wide text-[10px] sm:inline">
                    {checkingProfile ? "..." : role || "CLIENT"}
                  </span>

                  <ChevronDown
                    size={14}
                    className={`transition-transform ${profileOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-border bg-card text-sm text-card-foreground shadow-lg transition-all duration-150 ${
                    profileOpen
                      ? "scale-100 opacity-100 pointer-events-auto"
                      : "scale-95 opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="border-b px-3 pb-2 pt-3 text-xs">
                    <div className="font-semibold">{profileLabel}</div>
                    <div className="text-slate-500">
                      Signed in as <span className="uppercase">{role || "CLIENT"}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    {canOpenDashboard && (
                      <Link
                        href="/dashboard"
                        className="block px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => setProfileOpen(false)}
                      >
                        {dashboardLinkLabel}
                      </Link>
                    )}

                    {(role === "MANAGER" || role === "ADMIN") && (
                      <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-600">
                        <span>Preview mode</span>
                        <PreviewSwitch show={true} />
                      </div>
                    )}

                    <form action="/auth/signout" method="post" className="mt-1 border-t">
                      <button
                        type="submit"
                        className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => setProfileOpen(false)}
                      >
                        Sign out
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="btn btn-ghost">
                  Sign in
                </Link>
                <Link href="/auth/login" className="btn btn-primary">
                  Create account
                </Link>
              </>
            )}
          </div>

          <button
            className="inline-flex items-center justify-center rounded-full p-2 hover:bg-muted md:hidden"
            onClick={() => setIsOpenMobile((v) => !v)}
            aria-label="Toggle navigation"
          >
            {isOpenMobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {isOpenMobile && (
        <div className="border-t border-border bg-white md:hidden">
          <div className="mx-auto max-w-7xl space-y-4 px-4 py-3">
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {mobileSectionTitle}
              </p>
              {mobilePrimaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    isActive(link.href)
                      ? "bg-slate-100 font-medium text-[color:var(--primary)]"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setIsOpenMobile(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {mobileDropdowns.map((dropdown) => (
              <div key={dropdown.id} className="space-y-1 border-t border-border pt-3">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {dropdown.label.toUpperCase()}
                </p>
                {dropdown.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-3 py-2 text-sm ${
                      isActive(item.href)
                        ? "bg-slate-100 font-medium text-[color:var(--primary)]"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setIsOpenMobile(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}

            <div className="space-y-2 border-t border-border pt-3">
              {isSignedIn ? (
                <form action="/auth/signout" method="post">
                  <button className="btn btn-outline btn-block">Sign out</button>
                </form>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/auth/login" className="btn btn-ghost btn-block">
                    Sign in
                  </Link>
                  <Link href="/auth/login" className="btn btn-primary btn-block">
                    Create account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
