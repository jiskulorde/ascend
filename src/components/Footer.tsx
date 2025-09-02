import Link from "next/link";
import { Facebook, Mail, MapPin, ArrowUpRight } from "lucide-react";

const BRAND =
  process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "Ascend • DMCI Homes";

const year = new Date().getFullYear();

// TODO: swap these with your real links when ready
const LINKS = {
  facebookPage: "https://facebook.com/",       // ← your FB page
  facebookGroup: "https://facebook.com/groups/", // ← your FB group (if any)
  emailHub: "mailto:team.ascend@example.com",  // ← replace or remove if N/A
};

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-white">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        {/* Top row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand + mission */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[color:var(--primary)]" />
              <span className="text-lg font-semibold tracking-tight">
                {BRAND}
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-prose">
              A team-first real estate platform for sales consultants and
              managers. Browse inventory, compare units, and manage client
              inquiries—all in one place.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Badge>Trusted Team</Badge>
              <Badge>Real-time Inventory</Badge>
              <Badge>Agent Tools</Badge>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <SectionTitle>Explore</SectionTitle>
            <ul className="space-y-2 text-sm">
              <Li href="/projects">Projects</Li>
              <Li href="/properties">Properties</Li>
              <Li href="/compare">Compare</Li>
              <Li href="/summary">Summary</Li>
              <Li href="/looker">Availability (Looker)</Li>
              <Li href="/clients">Clients</Li>
              <Li href="/dashboard">Dashboard</Li>
            </ul>
          </div>

          {/* Team & Contact */}
          <div>
            <SectionTitle>Team & Contact</SectionTitle>
            <ul className="space-y-2 text-sm">
              <LiIcon
                href={LINKS.facebookPage}
                icon={<Facebook className="h-4 w-4" />}
                label="Facebook Page"
                external
              />
              <LiIcon
                href={LINKS.facebookGroup}
                icon={<Facebook className="h-4 w-4" />}
                label="Sales Group"
                external
              />
              <LiIcon
                href="/clients"
                icon={<ArrowUpRight className="h-4 w-4" />}
                label="Find an Agent"
              />
              <LiIcon
                href="/manager"
                icon={<ArrowUpRight className="h-4 w-4" />}
                label="Manager Console"
              />
              {/* keep email link if you have a central inbox; otherwise remove */}
              <LiIcon
                href={LINKS.emailHub}
                icon={<Mail className="h-4 w-4" />}
                label="Email the Team"
                external
              />
              <LiIcon
                href="#"
                icon={<MapPin className="h-4 w-4" />}
                label="DMCI Offices"
              />
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-border" />

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {year} {BRAND}. For internal sales enablement use only.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>Built on Next.js & Supabase</span>
            <Dot />
            <Link className="hover:underline" href="/privacy">
              Privacy
            </Link>
            <Dot />
            <Link className="hover:underline" href="/terms">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Small presentational helpers ---------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold mb-3">{children}</h3>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full 
      bg-[color:var(--primary)]/10 text-[color:var(--primary)] 
      px-2.5 py-1 text-xs font-medium">
      {children}
    </span>
  );
}


function Dot() {
  return <span className="mx-1.5 opacity-40">•</span>;
}

function Li({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {children}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={href} className="hover:underline">
        {children}
      </Link>
    </li>
  );
}

function LiIcon({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  const content = (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span>{label}</span>
    </span>
  );

  if (external) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {content}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link href={href} className="hover:underline">
        {content}
      </Link>
    </li>
  );
}
