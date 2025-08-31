"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Tabs from "@/components/Tabs";

// ---- Lightbox Modal ----
function Lightbox({ images, index, onClose }: { images: string[], index: number, onClose: () => void }) {
  const [current, setCurrent] = useState(index);

  if (!images.length) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white text-3xl"
      >
        ✕
      </button>
      <button
        onClick={() => setCurrent((c) => (c - 1 + images.length) % images.length)}
        className="absolute left-6 text-white text-4xl"
      >
        ‹
      </button>
      <Image
        src={images[current]}
        alt={`Preview ${current}`}
        width={1000}
        height={700}
        className="rounded-xl shadow max-h-[90vh] object-contain"
      />
      <button
        onClick={() => setCurrent((c) => (c + 1) % images.length)}
        className="absolute right-6 text-white text-4xl"
      >
        ›
      </button>
    </div>
  );
}

// ---- Types ----
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

// ---- Main Component ----
export default function AGPPage() {
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  useEffect(() => {
    const fetchUnits = async () => {
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
    };
    fetchUnits();
  }, []);

  const lowestByType = useMemo(() => {
    const agpUnits = units.filter((u) =>
      u.Property.toLowerCase().includes("allegra")
    );
    const map = new Map<string, UnitRow>();
    for (const u of agpUnits) {
      const key = `${u.Type}__${u.Tower}`;
      const current = map.get(key);
      if (!current || u.ListPrice < current.ListPrice) {
        map.set(key, u);
      }
    }
    return Array.from(map.values());
  }, [units]);

  // 🔹 Helper to render a gallery grid
  const renderGallery = (images: string[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {images.map((src, i) => (
        <motion.div
          key={i}
          whileHover={{ scale: 1.05 }}
          className="cursor-pointer"
          onClick={() => setLightbox({ images, index: i })}
        >
          <Image
            src={src}
            alt={`Gallery ${i}`}
            width={600}
            height={400}
            className="rounded-xl shadow object-cover"
          />
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-12">
        <Image
          src="/images/agp/agp-logo.png"
          alt="AGP Logo"
          width={120}
          height={120}
          className="mx-auto mb-4"
        />
        <h1 className="text-4xl font-bold text-[#0a2540] mb-4">
          Allegra Garden Place
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          One-stop hub for floor plans, layouts, visuals, computation, and promos.
        </p>
        <Image
          src="/images/agp/agp-bldg.png"
          alt="AGP Main"
          width={800}
          height={400}
          className="mx-auto rounded-xl shadow"
        />
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto">
        <Tabs
          defaultValue="info"
          tabs={[
            {
              value: "info",
              label: "Info",
              content: (
                <div className="space-y-4 text-gray-700">
                  <p>
                    <strong>Location:</strong> Pasig Boulevard, Pasig City
                  </p>
                  <p>
                    <strong>RFO Date:</strong> Tower A – Q4 2024, Tower B – Q3
                    2025
                  </p>
                  <p>
                    <strong>Developer:</strong> DMCI Homes
                  </p>
                  <Image
                    src="/images/agp/agp-map.png"
                    alt="AGP Map"
                    width={600}
                    height={400}
                    className="rounded-xl shadow mt-6"
                  />
                </div>
              ),
            },
            {
              value: "visuals",
              label: "Visuals",
              content: (
                <Tabs
                  defaultValue="amenities"
                  variant="sub"
                  tabs={[
                    
                    {
                      value: "amenities",
                      label: "Amenities",
                      content: renderGallery([
                        "/images/agp/Allegra-Garden-Place-Entrance-Gate-large.png",
                        "/images/agp/Allegra-Garden-Place-Reception-Lobby-large.png",
                        "/images/agp/Allegra-Garden-Place-Lounge-Area-large.png",
                        "/images/agp/Allegra-Garden-Place-Jogging-Path-large.png",
                        "/images/agp/Allegra-Garden-Place-Sky-Promenade-large.png",
                        "/images/agp/Allegra-Garden-Place-Sky-Patio-Lumiventt-Technology-large.png",
                        "/images/agp/Allegra-Garden-Place-Leisure-Pool-large.png",
                        "/images/agp/Allegra-Garden-Place-Lap-Pool-large.png",
                        "/images/agp/playground.jpg",
                      ]),
                    },
                    {
  value: "layouts",
  label: "Unit Layouts",
  content: (
    <Tabs
      defaultValue="studio"
      variant="sub"
      tabs={[
        {
          value: "studio",
          label: "Studio",
          content: renderGallery([
            "/images/agp/AGP_Studio-Unit-A-30sqm.png",
            "/images/agp/AGP_Studio-Unit-B-34sqm.png",
          ]),
        },
        {
          value: "1br",
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
          value: "2br",
          label: "2BR",
          content: renderGallery([
            "/images/agp/2BR-A-54sqm.png",
            "/images/agp/AGP_2BR-B-55sqm.png",
          ]),
        },
        {
          value: "3br",
          label: "3BR",
          content: renderGallery([
            "/images/agp/AGP_3BR-A-65sqm.png",
            "/images/agp/AGP_3BR-B-75sqm.png",
          ]),
        },
      ]}
    />
  ),
},
{
  value: "floorplans",
  label: "Floor Plans",
  content: (
    <Tabs
      defaultValue="amina"
      variant="sub"
      tabs={[
        {
          value: "amina",
          label: "Amina Tower",
          content: renderGallery([
            "/images/agp/Amina-2-12-23-33-43-53-Floorplan.png",
            "/images/agp/Amina-3-4-14-15-24-25-34-35-44-45-54-55-Floorplan.png",
            "/images/agp/Amina-5-6-10-11-16-17-21-22-26-27-31-32-36-37-41-42-46-47-51-52-56-PH-Floorplan.png",
            "/images/agp/Amina-7-18-28-38-48-Floorplan.png",
          ]),
        },
        {
          value: "soraya",
          label: "Soraya Tower",
          content: renderGallery([
            "/images/agp/Soraya_2-3-12-14-23-24-33-34-43-44-53-54-Floorplan.png",
            "/images/agp/Soraya_5-15-25-35-45-Floorplan.png",
            "/images/agp/Soraya_6-16-26-36-46-Floorplan.png",
          ]),
        },
      ]}
    />
  ),
},

                    {
                      value: "bedrooms",
                      label: "Bedrooms",
                      content: renderGallery([
                        "/images/agp/bedroom-1.jpg",
                        "/images/agp/bedroom-2.jpg",
                        "/images/agp/bedroom-3.jpg",
                      ]),
                    },
                  ]}
                />
              ),
            },
            {
              value: "computation",
              label: "Computation",
              content: (
                <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-[#0a2540] text-white">
                    <tr>
                      <th className="px-4 py-2">Unit Type</th>
                      <th className="px-4 py-2">Tower</th>
                      <th className="px-4 py-2">Lowest Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowestByType.map((u, i) => (
                      <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                        <td className="px-4 py-2">{u.Type}</td>
                        <td className="px-4 py-2">{u.Tower}</td>
                        <td className="px-4 py-2">
                          {currencyPH(u.ListPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
            },
            {
              value: "promo",
              label: "Promo",
              content: (
                <div className="text-gray-700">
                  <h2 className="text-2xl font-semibold text-[#0a2540] mb-4">
                    Rent-to-Own Promo
                  </h2>
                  <p>
                    Enjoy flexible payment terms under our Rent-To-Own promo for
                    select 2BR and 3BR units. Contact us for updated terms.
                  </p>
                </div>
              ),
            },
            {
      value: "downloads",
      label: "Downloads",
      content: (
        <ul className="list-disc list-inside text-gray-700 space-y-2">
          <li><a href="/downloads/agp-brochure.pdf" className="text-[#d4af37] hover:underline">Brochure (PDF)</a></li>
          <li><a href="/downloads/agp-factsheet.pdf" className="text-[#d4af37] hover:underline">Fact Sheet</a></li>
          <li><a href="/downloads/agp-presentation.pptx" className="text-[#d4af37] hover:underline">Presentation Deck</a></li>
        </ul>
      ),
    },
          ]}
        />
      </div>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
