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

// "More" groups the pages that shouldn't compete visually with the core
// sales tools. About is intentionally left out: no /about route exists yet
// (see the Phase 2 navbar report) — add it back here once the public-site
// phase creates that page, so this never links to a 404.
const MORE_ITEMS: SimpleLink[] = [
  { kind: "link", label: "Projects", href: "/projects" },
  { kind: "link", label: "Buyer’s Guide", href: "/buyers-guide" },
];

const MORE_DROPDOWN: DropdownLink = {
  kind: "dropdown",
  id: "more",
  label: "More",
  items: MORE_ITEMS,
};

// Logged-out visitors: marketing nav only. Full Availability, Summary,
// Compare, and Shortlists are seller/buyer tools and must never appear here
// — /availability itself already renders the capped public preview for
// anonymous visitors (see src/app/availability/page.tsx).
const ANON_LINKS: NavLink[] = [
  { kind: "link", label: "Home", href: "/" },
  { kind: "link", label: "Projects", href: "/projects" },
  { kind: "link", label: "Availability", href: "/availability" },
  { kind: "link", label: "Buyer’s Guide", href: "/buyers-guide" },
];

// Authenticated CLIENT: full buyer toolset, but no Shortlists (seller-only).
const CLIENT_LINKS: NavLink[] = [
  { kind: "link", label: "Dashboard", href: "/dashboard" },
  { kind: "link", label: "Availability", href: "/availability" },
  { kind: "link", label: "Summary", href: "/summary" },
  { kind: "link", label: "Compare", href: "/compare" },
  MORE_DROPDOWN,
];

// AGENT/MANAGER/ADMIN: full seller toolset. Shortlists sits between Summary
// and Compare per the approved nav order.
const SELLER_LINKS: NavLink[] = [
  { kind: "link", label: "Dashboard", href: "/dashboard" },
  { kind: "link", label: "Availability", href: "/availability" },
  { kind: "link", label: "Summary", href: "/summary" },
  { kind: "link", label: "Shortlists", href: "/shortlists" },
  { kind: "link", label: "Compare", href: "/compare" },
  MORE_DROPDOWN,
];

const SELLER_ROLES: Exclude<Role, undefined>[] = ["AGENT", "MANAGER", "ADMIN"];

// Purely presentational — the real access control lives in middleware.ts and
// each page's own server-side guard (see src/app/*/page.tsx). This only
// decides what the navbar *shows*, never what it enforces.
function getMainLinks(isSignedIn: boolean, role: Role): NavLink[] {
  if (!isSignedIn) return ANON_LINKS;

  const effectiveRole = role || "CLIENT";
  return SELLER_ROLES.includes(effectiveRole) ? SELLER_LINKS : CLIENT_LINKS;
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
  const mobileSectionTitle = !isSignedIn ? "EXPLORE" : isSeller ? "SALES TOOLS" : "TOOLS";
  const mobilePrimaryLinks = mainLinks.filter((l): l is SimpleLink => l.kind === "link");
  const mobileMoreLink = mainLinks.find((l): l is DropdownLink => l.kind === "dropdown");

  const shell =
    "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-border";

  const navLinkBase =
    "rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition";

  const navLinkActive =
    "bg-slate-100 text-[color:var(--primary)] border border-slate-200";

  const dropdownPanel =
    "absolute left-0 mt-2 w-56 rounded-2xl border border-slate-100 bg-white text-slate-900 shadow-xl z-40 py-1";

  const profileLabel =
    role === "ADMIN"
      ? "Admin dashboard"
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
                    <Link
                      href="/dashboard"
                      className="block px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => setProfileOpen(false)}
                    >
                      Open dashboard
                    </Link>

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

            {mobileMoreLink && (
              <div className="space-y-1 border-t border-border pt-3">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {mobileMoreLink.label.toUpperCase()}
                </p>
                {mobileMoreLink.items.map((item) => (
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
            )}

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