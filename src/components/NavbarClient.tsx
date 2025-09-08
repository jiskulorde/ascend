"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown, User } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/client";
import PreviewSwitch from "@/components/PreviewSwitch";

/** Link types */
type SimpleLink = { kind: "link"; label: string; href: string };
type DropdownLink = { kind: "dropdown"; id: string; label: string; items: SimpleLink[] };
type NavLink = SimpleLink | DropdownLink;

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN" | undefined;

type Props = {
  initialSignedIn: boolean;
  initialRole?: Exclude<Role, undefined>;
};

export default function NavbarClient({ initialSignedIn, initialRole }: Props) {
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(initialSignedIn);
  const [role, setRole] = useState<Role>(initialRole);
  const [loading, setLoading] = useState(false);

  const supabase = browserSupabase();

  // Keep auth state live
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true);
      if (session) {
        setIsSignedIn(true);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        setRole(profile?.role as Role);
      } else {
        setIsSignedIn(false);
        setRole(undefined);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  // Styles
  const pill =
    "rounded-full px-3 py-2 text-sm font-medium transition hover:bg-[color:var(--secondary)] hover:text-foreground";
  const activePill = "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-sm";
  const shell = "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-border";
  const dropdownPanel =
    "absolute left-0 mt-2 w-56 rounded-xl border border-border bg-card text-card-foreground shadow-lg z-50 transition-all duration-150 origin-top";
  const dropdownOpen = "opacity-100 scale-100 pointer-events-auto";
  const dropdownClosed = "opacity-0 scale-95 pointer-events-none";

  const SkeletonPill = () => <div className="animate-pulse rounded-full bg-gray-200 h-7 w-20" />;

  // ---------- Menus (decluttered) ----------
  const AVAILABILITY_DROPDOWN: DropdownLink = {
    kind: "dropdown",
    id: "availability",
    label: "Availability",
    items: [
      { kind: "link", label: "Availability", href: "/availability" },
      { kind: "link", label: "Compare", href: "/compare" },
      { kind: "link", label: "Summary", href: "/summary" },
    ],
  };

  const MANAGER_DROPDOWN: DropdownLink = {
    kind: "dropdown",
    id: "manager",
    label: "Manager",
    items: [
      // You can change this path later when you add the page
      { kind: "link", label: "Appearance", href: "/dashboard/appearance" },
      { kind: "link", label: "Reports", href: "/dashboard/reports" },
      { kind: "link", label: "Team", href: "/dashboard/team" },
    ],
  };

  // Public/client
  const clientLinks: NavLink[] = [
    { kind: "link", label: "Home", href: "/" },
    { kind: "link", label: "Availability", href: "/availability" },
    { kind: "link", label: "Projects", href: "/projects" },
    { kind: "link", label: "Buyer’s Guide", href: "/buyers-guide" },
  ];

  // Agent
  const agentLinks: NavLink[] = [
    AVAILABILITY_DROPDOWN,
    { kind: "link", label: "Projects", href: "/projects" },
    { kind: "link", label: "Buyer’s Guide", href: "/buyers-guide" },
  ];

  // Manager/Admin
  const managerLinks: NavLink[] = [
    AVAILABILITY_DROPDOWN,
    MANAGER_DROPDOWN,
    { kind: "link", label: "Clients", href: "/clients" },
    { kind: "link", label: "Projects", href: "/projects" },
    { kind: "link", label: "Buyer’s Guide", href: "/buyers-guide" },
  ];

  const links: NavLink[] = (() => {
    if (loading) return [];
    if (!isSignedIn) return clientLinks;
    if (role === "CLIENT") return clientLinks;
    if (role === "AGENT") return agentLinks;
    if (role === "MANAGER" || role === "ADMIN") return managerLinks;
    return clientLinks;
  })();

  // ---------- Dropdown handling ----------
  const [openDropdown, setOpenDropdown] = useState<null | string>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <nav className={`sticky top-0 z-50 ${shell}`}>
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[color:var(--primary)]" />
            <span className="text-lg md:text-xl font-semibold tracking-tight">
              <span className="text-[color:var(--primary)]">Ascend</span> • DMCI
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2" ref={ddRef}>
            {loading ? (
              <>
                <SkeletonPill />
                <SkeletonPill />
              </>
            ) : (
              links.map((link) =>
                link.kind === "dropdown" ? (
                  <div key={link.id} className="relative">
                    <button
                      onClick={() => setOpenDropdown((v) => (v === link.id ? null : link.id))}
                      className={`${pill} inline-flex items-center gap-1`}
                    >
                      {link.label}
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${openDropdown === link.id ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div className={`${dropdownPanel} ${openDropdown === link.id ? dropdownOpen : dropdownClosed}`}>
                      {link.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`block px-3 py-2 text-sm rounded-lg mx-2 my-1 hover:bg-muted ${
                            isActive(item.href) ? "bg-muted font-medium" : ""
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
                    className={`${pill} ${isActive(link.href) ? activePill : ""}`}
                  >
                    {link.label}
                  </Link>
                )
              )
            )}
          </div>

          {/* Right side auth */}
          <div className="hidden md:flex items-center gap-2">
            {loading ? (
              <SkeletonPill />
            ) : isSignedIn ? (
              <>
                {role && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--secondary)] px-3 py-1 text-xs text-foreground">
                    <User size={14} /> {role}
                  </span>
                )}
                {(role === "MANAGER" || role === "ADMIN") && <PreviewSwitch show={true} />}
                <form action="/auth/signout" method="post">
                  <button className="btn btn-outline">Sign out</button>
                </form>
              </>
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

          {/* Mobile toggle */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-full p-2 hover:bg-muted"
            onClick={() => setIsOpenMobile((v) => !v)}
            aria-label="Toggle navigation"
          >
            {isOpenMobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {isOpenMobile && (
        <div className="md:hidden border-t border-border bg-white">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {links.map((link) =>
              link.kind === "dropdown" ? (
                <details key={link.id} className="rounded-lg">
                  <summary className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted cursor-pointer">
                    {link.label} <ChevronDown size={16} />
                  </summary>
                  <div className="pl-3">
                    {link.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block rounded-md px-3 py-2 hover:bg-muted"
                        onClick={() => setIsOpenMobile(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </details>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg px-3 py-2 hover:bg-muted"
                  onClick={() => setIsOpenMobile(false)}
                >
                  {link.label}
                </Link>
              )
            )}

            {/* Mobile auth */}
            <div className="pt-2">
              {isSignedIn ? (
                <>
                  {(role === "MANAGER" || role === "ADMIN") && (
                    <div className="mb-2">
                      <PreviewSwitch show={true} />
                    </div>
                  )}
                  <form action="/auth/signout" method="post">
                    <button className="btn btn-outline btn-block">Sign out</button>
                  </form>
                </>
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
