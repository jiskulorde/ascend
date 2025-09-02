import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 brand-hero" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
                Find your next <span className="accent">DMCI Homes</span> address.
              </h1>
              <p className="mt-4 text-base md:text-lg text-muted-foreground">
                Explore projects, compare units, and connect with a sales consultant.
                Team Ascend built this for buyers and partners—simple, fast, and mobile-friendly.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/projects" className="btn btn-primary">
                  Browse Projects
                </Link>
                <Link href="/availability" className="btn btn-outline">
                  View Properties
                </Link>
                <Link href="/auth/login" className="btn btn-ghost">
                  Sign in
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Public preview: projects & properties are viewable without an account.
              </p>
            </div>

            <div className="card p-0 overflow-hidden">
              {/* Simple visual mock (replace with a real image later) */}
              <div className="aspect-[16/10] bg-gradient-to-br from-[color:var(--primary)]/10 to-[color:var(--primary)]/30 grid place-items-center">
                <div className="rounded-xl border border-border bg-white/70 backdrop-blur p-4 shadow-sm text-center">
                  <div className="text-sm text-muted-foreground">Project Spotlight</div>
                  <div className="mt-2 text-lg font-medium">Your next home in the city</div>
                  <div className="mt-3 flex gap-2 justify-center">
                    <span className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-xs">Near CBD</span>
                    <span className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-xs">Resort amenities</span>
                    <span className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-xs">Secure & serene</span>
                  </div>
                </div>
              </div>
            </div>
          </div>{/* end grid */}
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="section">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Feature
              title="Project directory"
              desc="All current DMCI Homes projects in one place. Filter by location, status, and timeline."
            />
            <Feature
              title="Property search"
              desc="Browse by tower, facing, size, or RFO date. Save units to compare side-by-side."
            />
            <Feature
              title="Talk to a consultant"
              desc="Reach our sales team to get advised options, promos, and next steps—no pushy sales."
            />
          </div>
        </div>
      </section>

      {/* FEATURED PROJECTS (static placeholders; link to your pages) */}
      <section className="section pt-0">
        <div className="mx-auto max-w-7xl">
          <header className="flex items-end justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-semibold">Featured projects</h2>
            <Link href="/projects" className="text-sm hover:underline">See all</Link>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProjectCard
              title="Allegra Garden Place (AGP)"
              href="/projects/AGP"
              tags={["Pasig", "Pre-selling", "Near BGC"]}
            />
            <ProjectCard
              title="Alder Residences (ALD)"
              href="/projects/ALD"
              tags={["Taguig", "Mid-rise", "Family-friendly"]}
            />
            <ProjectCard
              title="More soon"
              href="/projects"
              tags={["Directory", "Filters", "Map view"]}
            />
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="section border-t-4 border-[color:var(--primary)]/10">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="rounded-[var(--radius-lg)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg md:text-xl font-semibold">New to DMCI Homes?</h3>
              <p className="text-sm opacity-90">
                Read our upcoming Buyer’s Guide and talk to a consultant for a stress-free buying experience.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/projects" className="btn bg-white text-foreground hover:brightness-95">
                Browse Projects
              </Link>
              <Link href="/auth/login" className="btn btn-ghost">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* --- tiny presentational helpers --- */
function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card p-6">
      <h3 className="text-base md:text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function ProjectCard({
  title,
  href,
  tags,
}: {
  title: string;
  href: string;
  tags: string[];
}) {
  return (
    <Link href={href} className="card p-0 overflow-hidden group">
      <div className="aspect-[16/10] bg-muted/50 grid place-items-center">
        <div className="rounded-md border border-border bg-white/70 backdrop-blur px-3 py-2 text-sm shadow-sm">
          Project image
        </div>
      </div>
      <div className="p-4">
        <div className="font-medium">{title}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-[11px]">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="h-1 bg-transparent group-hover:bg-[color:var(--primary)] transition-all" />
    </Link>
  );
}
