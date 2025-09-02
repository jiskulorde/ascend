"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown, User } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/client";

/** Link types */
type SimpleLink = { label: string; href: string };
type DropdownLink = { label: string; dropdown: SimpleLink[] };
type NavLink = SimpleLink | DropdownLink;

type Props = {
  initialSignedIn: boolean;
  initialRole?: "CLIENT" | "AGENT" | "MANAGER";
};

export default function NavbarClient({ initialSignedIn, initialRole }: Props) {
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(initialSignedIn);
  const [role, setRole] = useState<"CLIENT" | "AGENT" | "MANAGER" | undefined>(initialRole);
  const [loading, setLoading] = useState(false);

  // Supabase client
  const supabase = browserSupabase();

  // Live auth updates (no refresh needed)
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
        setRole(profile?.role as any);
      } else {
        setIsSignedIn(false);
        setRole(undefined);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Dropdown
  const [isOpen, setIsOpen] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const unitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (unitRef.current && !unitRef.current.contains(event.target as Node)) {
        setUnitDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  // Styles
  const dropdownPanel =
    "absolute left-0 mt-2 w-56 rounded-xl border border-border bg-card text-card-foreground shadow-lg z-50 transition-all duration-150 origin-top";
  const dropdownOpen = "opacity-100 scale-100 pointer-events-auto";
  const dropdownClosed = "opacity-0 scale-95 pointer-events-none";
  const pillLink =
    "rounded-full px-3 py-2 text-sm font-medium transition hover:bg-[color:var(--secondary)] hover:text-foreground";
  const activePill =
    "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-sm";
  const brandBlue = "text-[color:var(--primary)]";
  const borderShell =
    "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-border";

  // Shimmer pill
  const SkeletonPill = () => (
    <div className="animate-pulse rounded-full bg-gray-200 h-7 w-20" />
  );

  // ---- Role-based nav configs ----
  const clientLinks: NavLink[] = [
    { label: "Home", href: "/" },
    { label: "Projects", href: "/projects" },
    { label: "Buyer’s Guide", href: "/buyers-guide" },
    { label: "Availability", href: "/availability" },
    { label: "Properties", href: "/properties" },
  ];

  const agentLinks: NavLink[] = [
    { label: "Dashboard", href: "/dashboard" },
    {
      label: "Availability",
      dropdown: [
        { label: "Looker", href: "/looker" },
        { label: "Availability", href: "/availability" },
        { label: "Summary", href: "/summary" },
      ],
    },
    { label: "Compare", href: "/compare" },
    { label: "Clients", href: "/clients" },
    { label: "Projects", href: "/projects" },
    { label: "Buyer’s Guide", href: "/buyers-guide" },
  ];

  const managerLinks: NavLink[] = [
    ...agentLinks,
    { label: "Reports", href: "/dashboard/reports" },
    { label: "Team", href: "/dashboard/team" },
  ];

  const getLinksForRole = (): NavLink[] => {
    if (!isSignedIn) return clientLinks.slice(0, 3); // Home / Projects / Guide for logged-out
    if (role === "CLIENT") return clientLinks;
    if (role === "AGENT") return agentLinks;
    if (role === "MANAGER") return managerLinks;
    return [];
  };

  const links = getLinksForRole();

  return (
    <nav className={`sticky top-0 z-50 ${borderShell}`}>
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[color:var(--primary)]" />
            <span className="text-lg md:text-xl font-semibold tracking-tight">
              <span className={brandBlue}>Ascend</span> • DMCI
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            {loading ? (
              <>
                <SkeletonPill />
                <SkeletonPill />
              </>
            ) : (
              links.map((link) =>
                "dropdown" in link ? (
                  <div key={link.label} ref={unitRef} className="relative">
                    <button
                      onClick={() => setUnitDropdownOpen((v) => !v)}
                      className={`${pillLink} inline-flex items-center gap-1`}
                    >
                      {link.label}
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${
                          unitDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <div
                      className={`${dropdownPanel} ${
                        unitDropdownOpen ? dropdownOpen : dropdownClosed
                      }`}
                    >
                      {link.dropdown.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="block px-3 py-2 text-sm hover:bg-muted rounded-lg mx-2 my-1"
                          onClick={() => setUnitDropdownOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`${pillLink} ${
                      isActive(link.href) ? activePill : ""
                    }`}
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
            onClick={() => setIsOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="md:hidden border-t border-border bg-white">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {loading ? (
              <>
                <div className="animate-pulse h-8 bg-gray-200 rounded-md" />
                <div className="animate-pulse h-8 bg-gray-200 rounded-md" />
              </>
            ) : (
              links.map((link) =>
                "dropdown" in link ? (
                  <details key={link.label} className="rounded-lg">
                    <summary className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted cursor-pointer">
                      {link.label} <ChevronDown size={16} />
                    </summary>
                    <div className="pl-3">
                      {link.dropdown.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="block rounded-md px-3 py-2 hover:bg-muted"
                          onClick={() => setIsOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="block rounded-lg px-3 py-2 hover:bg-muted"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              )
            )}

            {/* Mobile auth */}
            <div className="pt-2">
              {loading ? (
                <div className="animate-pulse h-9 bg-gray-200 rounded-md" />
              ) : isSignedIn ? (
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
