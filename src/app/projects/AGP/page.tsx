// src/app/projects/AGP/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Tabs from "@/components/Tabs";
import Link from "next/link";

/* ---------------- Helpers ---------------- */

type UnitRow = {
  Property: string;
  BuildingUnit: string;
  Tower: string;
  Floor: string;
  Status: string;
  Type: string;
  GrossAreaSQM: number;
  Amenities: string;
  Facing: string;
  RFODate: string;
  ListPrice: number;
  PerSQM: number;
};

const parseNumber = (raw: string) =>
  parseFloat((raw || "").toString().replace(/[^\d.-]/g, "")) || 0;

const currencyPH = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

/* ---------------- Lightbox ---------------- */

function Lightbox({
  images,
  index,
  onClose,
}: {
  images: string[];
  index: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")
        setCurrent((c) => (c - 1 + images.length) % images.length);
      if (e.key === "ArrowRight")
        setCurrent((c) => (c + 1) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  if (!images.length) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white text-3xl"
        aria-label="Close"
      >
        ✕
      </button>

      <button
        onClick={() => setCurrent((c) => (c - 1 + images.length) % images.length)}
        className="absolute left-6 text-white text-4xl"
        aria-label="Previous"
      >
        ‹
      </button>

      <Image
        src={images[current]}
        alt={`Preview ${current + 1}`}
        width={1200}
        height={800}
        className="rounded-xl shadow max-h-[90vh] object-contain"
      />

      <button
        onClick={() => setCurrent((c) => (c + 1) % images.length)}
        className="absolute right-6 text-white text-4xl"
        aria-label="Next"
      >
        ›
      </button>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function AGPPage() {
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/availability");
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        const normalized: UnitRow[] = json.data.map((p: any) => ({
          Property: p.Property || "",
          BuildingUnit: p["Building Unit"] || "",
          Tower: p.Tower || "",
          Floor: p.Floor || "",
          Status: p.Status || "",
          Type: p.Type || "",
          GrossAreaSQM: Number(p["Gross Area(SQM)"] || 0),
          Amenities: p.Amenities || "",
          Facing: p.Facing || "",
          RFODate: p["RFO Date"] || "",
          ListPrice: parseNumber(p["List Price"]),
          PerSQM: parseNumber(p["per SQM"]),
        }));
        setUnits(normalized);
      }
    })();
  }, []);

  const lowestByType = useMemo(() => {
    const agpUnits = units.filter((u) =>
      u.Property.toLowerCase().includes("allegra")
    );
    const map = new Map<string, UnitRow>();
    for (const u of agpUnits) {
      const key = `${u.Type}__${u.Tower}`;
      const current = map.get(key);
      if (!current || u.ListPrice < current.ListPrice) map.set(key, u);
    }
    return Array.from(map.values());
  }, [units]);

  const renderGallery = (images: string[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {images.map((src, i) => (
        <motion.button
          key={i}
          whileHover={{ scale: 1.03 }}
          className="cursor-pointer relative aspect-[4/3] overflow-hidden rounded-xl border border-border"
          onClick={() => setLightbox({ images, index: i })}
        >
          <Image
            src={src}
            alt={`Gallery ${i + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </motion.button>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-background">
      {/* Project hero */}
      <section className="relative overflow-hidden">
        <div className="brand-hero absolute inset-0 opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 pt-10 pb-8 text-center">
          <Image
            src="/images/agp/agp-logo.png"
            alt="AGP Logo"
            width={96}
            height={96}
            className="mx-auto mb-3"
          />
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Allegra Garden Place
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Floor plans, layouts, visuals, computation, and promos — all in one page.
          </p>

          <div className="mt-5 relative rounded-2xl overflow-hidden border border-border">
            <div className="relative aspect-[16/7]">
              <Image
                src="/images/agp/agp-bldg.png"
                alt="Allegra Garden Place"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
            </div>
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium">
                Pasig Blvd
              </span>
              <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium">
                High-rise
              </span>
              <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium">
                Lumiventt®
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <Link href="/projects" className="btn btn-ghost">Back to projects</Link>
            <Link href="/availability" className="btn btn-primary">Check availability</Link>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <Tabs
            defaultValue="info"
            tabs={[
              {
                value: "info",
                label: "Info",
                content: (
                  <div className="card p-6 space-y-4 text-sm md:text-base">
                    <div className="grid md:grid-cols-2 gap-4">
                      <InfoRow label="Location" value="Pasig Boulevard, Pasig City" />
                      <InfoRow label="Developer" value="DMCI Homes" />
                      <InfoRow label="RFO (Amina)" value="Q4 2024" />
                      <InfoRow label="RFO (Soraya)" value="Q3 2025" />
                    </div>
                    <div className="mt-4">
                      <Image
                        src="/images/agp/agp-map.png"
                        alt="AGP Map"
                        width={960}
                        height={560}
                        className="rounded-xl border border-border"
                      />
                    </div>
                  </div>
                ),
              },
              {
                value: "visuals",
                label: "Visuals",
                content: (
                  <div className="space-y-6">
                    <SubSection title="Amenities">
                      {renderGallery([
                        "/images/agp/Allegra-Garden-Place-Entrance-Gate-large.png",
                        "/images/agp/Allegra-Garden-Place-Reception-Lobby-large.png",
                        "/images/agp/Allegra-Garden-Place-Lounge-Area-large.png",
                        "/images/agp/Allegra-Garden-Place-Jogging-Path-large.png",
                        "/images/agp/Allegra-Garden-Place-Sky-Promenade-large.png",
                        "/images/agp/Allegra-Garden-Place-Sky-Patio-Lumiventt-Technology-large.png",
                        "/images/agp/Allegra-Garden-Place-Leisure-Pool-large.png",
                        "/images/agp/Allegra-Garden-Place-Lap-Pool-large.png",
                        "/images/agp/playground.jpg",
                      ])}
                    </SubSection>

                    <SubTabs
                      title="Unit Layouts"
                      items={[
                        {
                          label: "Studio",
                          content: renderGallery([
                            "/images/agp/AGP_Studio-Unit-A-30sqm.png",
                            "/images/agp/AGP_Studio-Unit-B-34sqm.png",
                          ]),
                        },
                        {
                          label: "1BR",
                          content: renderGallery([
                            "/images/agp/AGP_1BR-A-30sqm.png",
                            "/images/agp/AGP_1BR-B-33sqm.png",
                            "/images/agp/AGP_1BR-C-36sqm.png",
                            "/images/agp/AGP_1BR-D-41-sqm.png",
                            "/images/agp/AGP_1BR-F-38-sqm.png",
                          ]),
                        },
                        {
                          label: "2BR",
                          content: renderGallery([
                            "/images/agp/2BR-A-54sqm.png",
                            "/images/agp/AGP_2BR-B-55sqm.png",
                          ]),
                        },
                        {
                          label: "3BR",
                          content: renderGallery([
                            "/images/agp/AGP_3BR-A-65sqm.png",
                            "/images/agp/AGP_3BR-B-75sqm.png",
                          ]),
                        },
                      ]}
                    />

                    <SubTabs
                      title="Floor Plans"
                      items={[
                        {
                          label: "Amina Tower",
                          content: renderGallery([
                            "/images/agp/Amina-2-12-23-33-43-53-Floorplan.png",
                            "/images/agp/Amina-3-4-14-15-24-25-34-35-44-45-54-55-Floorplan.png",
                            "/images/agp/Amina-5-6-10-11-16-17-21-22-26-27-31-32-36-37-41-42-46-47-51-52-56-PH-Floorplan.png",
                            "/images/agp/Amina-7-18-28-38-48-Floorplan.png",
                          ]),
                        },
                        {
                          label: "Soraya Tower",
                          content: renderGallery([
                            "/images/agp/Soraya_2-3-12-14-23-24-33-34-43-44-53-54-Floorplan.png",
                            "/images/agp/Soraya_5-15-25-35-45-Floorplan.png",
                            "/images/agp/Soraya_6-16-26-36-46-Floorplan.png",
                          ]),
                        },
                      ]}
                    />

                    <SubSection title="Bedrooms">
                      {renderGallery([
                        "/images/agp/bedroom-1.jpg",
                        "/images/agp/bedroom-2.jpg",
                        "/images/agp/bedroom-3.jpg",
                      ])}
                    </SubSection>
                  </div>
                ),
              },
              {
                value: "computation",
                label: "Computation",
                content: (
                  <div className="card overflow-hidden">
                    <table className="w-full border-separate border-spacing-0">
                      <thead className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)]">
                        <tr>
                          {["Unit Type", "Tower", "Lowest Price"].map((h) => (
                            <th key={h} className="px-4 py-2 text-left text-sm font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lowestByType.map((u, i) => (
                          <tr key={`${u.Type}-${u.Tower}-${i}`} className="odd:bg-muted/40">
                            <td className="px-4 py-2">{u.Type}</td>
                            <td className="px-4 py-2">{u.Tower}</td>
                            <td className="px-4 py-2 font-semibold">{currencyPH(u.ListPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-4 border-t border-border text-sm text-muted-foreground">
                      Pricing is indicative. Check live availability for up-to-date unit pricing.
                    </div>
                    <div className="p-4 flex gap-2">
                      <Link href="/availability" className="btn btn-primary">Check availability</Link>
                    </div>
                  </div>
                ),
              },
              {
                value: "promo",
                label: "Promo",
                content: (
                  <div className="card p-6 space-y-3">
                    <h3 className="text-lg font-semibold">Rent-to-Own Promo</h3>
                    <p className="text-sm md:text-base text-muted-foreground">
                      Flexible payment options on select 2BR and 3BR units. Terms subject to change. Contact a consultant for current offers.
                    </p>
                    <div>
                      <Link href="/clients" className="btn btn-outline">Talk to a consultant</Link>
                    </div>
                  </div>
                ),
              },
              {
                value: "downloads",
                label: "Downloads",
                content: (
                  <div className="card p-6">
                    <ul className="list-disc list-inside space-y-2 text-sm md:text-base">
                      <li><a href="/downloads/agp-brochure.pdf" className="text-[color:var(--primary)] hover:underline">Brochure (PDF)</a></li>
                      <li><a href="/downloads/agp-factsheet.pdf" className="text-[color:var(--primary)] hover:underline">Fact Sheet</a></li>
                      <li><a href="/downloads/agp-presentation.pptx" className="text-[color:var(--primary)] hover:underline">Presentation Deck</a></li>
                    </ul>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </main>
  );
}

/* ---------- small presentational helpers ---------- */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-base md:text-lg font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function SubTabs({
  title,
  items,
}: {
  title: string;
  items: { label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base md:text-lg font-semibold">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <button
              key={it.label}
              onClick={() => setActive(i)}
              className={`rounded-full px-3 py-1 text-sm border ${
                active === i
                  ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] border-transparent"
                  : "hover:bg-muted"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
      <div>{items[active]?.content}</div>
    </div>
  );
}
