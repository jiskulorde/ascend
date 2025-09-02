// src/app/projects/page.tsx
import Image from "next/image";
import Link from "next/link";

type Project = {
  name: string;
  code: string;
  description: string;
  img: string;
  tags?: string[];
  status?: "Pre-selling" | "RFO" | "Ongoing";
};

const projects: Project[] = [
  {
    name: "Allegra Garden Place",
    code: "AGP",
    description:
      "High-rise living along Pasig Boulevard with resort-inspired amenities and Lumiventt® design.",
    img: "/images/agp/agp-bldg.png", // Replace with your actual thumbnail
    tags: ["Pasig", "High-rise", "Lumiventt"],
    status: "Ongoing",
  },
  // Add more projects here later…
];

export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="brand-hero absolute inset-0 opacity-20" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-10 md:py-14">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            DMCI Homes Projects
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">
            Explore current developments, browse visuals, and view unit availability per project.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="pb-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <Link
                key={p.code}
                href={`/projects/${p.code}`}
                className="group rounded-2xl overflow-hidden border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition"
              >
                <div className="relative aspect-[16/10]">
                  <Image
                    src={p.img}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
                  {p.status && (
                    <span className="absolute left-3 top-3 inline-flex rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium">
                      {p.status}
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base md:text-lg font-semibold">
                      {p.name}
                    </h2>
                    <span className="text-xs rounded-full bg-[color:var(--secondary)] px-2 py-1">
                      {p.code}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                    {p.description}
                  </p>

                  {p.tags && p.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded-full bg-[color:var(--secondary)] px-2.5 py-1 text-[11px]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      View details & visuals
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--primary)] group-hover:underline">
                      View project →
                    </span>
                  </div>
                </div>

                {/* accent hover bar */}
                <div className="h-1 bg-transparent group-hover:bg-[color:var(--primary)] transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
