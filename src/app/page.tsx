"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import gsap from "gsap";
import { useRouter } from "next/navigation";

type Property = {
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

export default function Home() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    gsap.fromTo(
      ".hero-text",
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
    );
    gsap.fromTo(
      ".hero-image",
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 1.2, ease: "power3.out", delay: 0.2 }
    );
  }, []);

  useEffect(() => {
    async function fetchProperties() {
      setLoading(true);
      try {
        const res = await fetch("/api/availability");
        if (!res.ok) throw new Error("Failed to fetch properties");

        const json = await res.json();
        if (!json.success) throw new Error(json.error || "API returned error");

        const rows = json.data;
        const normalized: Property[] = rows.map((p: any) => ({
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
          ListPrice:
            parseFloat((p["List Price"] ? String(p["List Price"]) : "0").replace(/[^0-9.-]+/g, "")) || 0,
          PerSQM:
            parseFloat((p["per SQM"] ? String(p["per SQM"]) : "0").replace(/[^0-9.-]+/g, "")) || 0,
        }));

        setProperties(normalized.slice(0, 3));
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchProperties();
  }, []);

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="section flex flex-col md:flex-row items-center justify-between bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 text-yellow-400">
        <div className="hero-text max-w-xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Find Your Perfect <span className="text-yellow-500">DMCI Home</span>
          </h1>
          <p className="text-lg md:text-xl mb-8 text-yellow-300/90">
            Explore our premium condominiums and communities designed to fit your lifestyle. Live in comfort, luxury, and convenience.
          </p>
          <div className="flex gap-4">
            <button
              className="primary"
              onClick={() => router.push("/properties")}
            >
              Browse Properties
            </button>
            <button
              className="secondary"
            >
              Contact Us
            </button>
          </div>
        </div>

        <div className="hero-image mt-12 md:mt-0 md:ml-12 flex-shrink-0">
          <Image
            src="/hero-condo.jpg"
            alt="DMCI Homes"
            width={500}
            height={500}
            className="rounded-2xl shadow-2xl"
            priority
          />
        </div>
      </section>

      {/* Featured Properties */}
      <section className="section bg-white text-blue-900">
        <h2 className="text-3xl font-bold text-center mb-10">
          Featured Properties
        </h2>

        {loading && <p className="text-center text-gray-400">⏳ Loading properties...</p>}
        {error && <p className="text-center text-red-500">❌ {error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {!loading && !error && properties.map((p, i) => (
            <div key={i} className="card">
              <Image
                src={`/property${i + 1}.jpg`}
                alt={p.Property}
                width={400}
                height={250}
                className="rounded-xl mb-4"
              />
              <h3 className="text-xl font-semibold mb-2">{p.Property}</h3>
              <p className="mb-4">{p.Type} · {p.GrossAreaSQM} sqm</p>
              <button
                className="primary"
                onClick={() => router.push("/properties")}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
