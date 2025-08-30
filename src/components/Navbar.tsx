"use client";

import Link from "next/link";
import { useState } from "react";
import { FaBars, FaTimes } from "react-icons/fa";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: "/properties", label: "Properties" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/clients", label: "Clients" },
    { href: "/compare", label: "Compare Units" },
  ];

  return (
    <nav className="bg-deepBlue/95 text-offWhite shadow-lg sticky top-0 z-50 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold tracking-wide text-luxuryGold hover:text-deepGold transition-colors duration-300">
          Ascend
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex space-x-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="relative text-offWhite hover:text-luxuryGold transition-colors duration-300 after:absolute after:left-0 after:-bottom-1 after:w-0 after:h-[2px] after:bg-luxuryGold after:transition-all hover:after:w-full">
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile Menu */}
        <button className="md:hidden text-offWhite text-xl focus:outline-none" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-deepBlue/95 px-6 py-4 flex flex-col space-y-4">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-offWhite hover:text-luxuryGold transition-colors duration-300" onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
