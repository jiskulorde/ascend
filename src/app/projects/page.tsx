"use client";

import Link from "next/link";

export default function ProjectsPage() {
  const projects = [
    {
      name: "Allegra Garden Place",
      code: "AGP",
      description: "DMCI Homes project located in Pasig Boulevard, featuring modern high-rise living with resort-inspired amenities.",
      image: "/images/agp-thumbnail.jpg", // replace with your actual thumbnail
    },
    // Add more projects later...
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <h1 className="text-3xl font-bold text-center text-[#0a2540] mb-8">
        DMCI Homes Projects
      </h1>

      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.map((project) => (
          <div
            key={project.code}
            className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
          >
            <img
              src={project.image}
              alt={project.name}
              className="w-full h-48 object-cover"
            />
            <div className="p-6">
              <h2 className="text-xl font-semibold text-[#0a2540] mb-2">
                {project.name}
              </h2>
              <p className="text-gray-600 mb-4">{project.description}</p>
              <Link
                href={`/projects/${project.code}`}
                className="inline-block px-4 py-2 rounded-lg bg-[#d4af37] text-white font-medium hover:bg-[#0a2540] transition-colors"
              >
                View Project
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
