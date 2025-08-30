// src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="backdrop-blur-md bg-[#0a2540]/80 text-white shadow-lg sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Brand */}
        <Link
          href="/"
          className="text-2xl font-bold tracking-wide text-[#d4af37] hover:text-white transition-colors duration-300"
        >
          Ascend
        </Link>

        {/* Desktop Nav */}
        <div className="space-x-6 hidden md:flex">
          {["Dashboard", "Looker", "Properties", "Summary", "Compare", "Clients"].map((item) => (
            <Link
              key={item}
              href={`/${item.toLowerCase()}`}
              className="nav-link relative after:absolute after:left-0 after:-bottom-1 after:w-0 after:h-[2px] after:bg-[#d4af37] after:transition-all hover:after:w-full"
            >
              {item}
            </Link>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden px-6 py-4 space-y-4 bg-[#0a2540]">
          {["Dashboard", "Looker", "Properties", "Summary", "Compare", "Clients"].map((item) => (
            <Link
              key={item}
              href={`/${item.toLowerCase()}`}
              className="block text-lg hover:text-[#d4af37] transition-colors"
              onClick={() => setIsOpen(false)}
            >
              {item}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
