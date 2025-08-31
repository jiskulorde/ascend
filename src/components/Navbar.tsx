"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [othersDropdownOpen, setOthersDropdownOpen] = useState(false);

  const unitRef = useRef<HTMLDivElement>(null);
  const othersRef = useRef<HTMLDivElement>(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (unitRef.current && !unitRef.current.contains(event.target as Node)) {
        setUnitDropdownOpen(false);
      }
      if (othersRef.current && !othersRef.current.contains(event.target as Node)) {
        setOthersDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuClass =
    "absolute left-0 mt-2 w-48 bg-white text-black rounded shadow-lg z-50 transition-all duration-300 transform origin-top";

  const openMenuClass = "opacity-100 scale-100 pointer-events-auto";
  const closedMenuClass = "opacity-0 scale-95 pointer-events-none";

  return (
    <nav className="backdrop-blur-md bg-[#0a2540]/80 text-white shadow-lg sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Brand */}
        <Link
          href="/"
          className="text-2xl font-bold tracking-wide text-[#ffffff] hover:text-white transition-colors duration-300"
        >
          Ascend
        </Link>

        {/* Desktop Nav */}
        <div className="space-x-6 hidden md:flex items-center">
          <Link href="/dashboard" className="nav-link">
            Dashboard
          </Link>

          <Link href="/projects" className="nav-link">
            Projects
          </Link>

          {/* Unit Availability */}
          <div ref={unitRef} className="relative">
            <button
              onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
              className="flex items-center space-x-1 nav-link"
            >
              <span>Unit Availability</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${unitDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`${menuClass} ${
                unitDropdownOpen ? openMenuClass : closedMenuClass
              }`}
            >
              {["Looker", "Properties", "Summary"].map((item) => (
                <Link
                  key={item}
                  href={`/${item.toLowerCase()}`}
                  className="block px-4 py-2 hover:bg-[#0a2540]/10"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>

          {/* Others */}
          <div ref={othersRef} className="relative">
            <button
              onClick={() => setOthersDropdownOpen(!othersDropdownOpen)}
              className="flex items-center space-x-1 nav-link"
            >
              <span>Others</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${othersDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`${menuClass} ${
                othersDropdownOpen ? openMenuClass : closedMenuClass
              }`}
            >
              {["Compare", "Clients"].map((item) => (
                <Link
                  key={item}
                  href={`/${item.toLowerCase()}`}
                  className="block px-4 py-2 hover:bg-[#0a2540]/10"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden px-6 py-4 space-y-2 bg-[#0a2540]">
          <Link
            href="/dashboard"
            className="block text-lg hover:text-[#d4af37] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Dashboard
          </Link>

          {/* Mobile Unit Availability */}
          <div>
            <button
              onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
              className="w-full flex justify-between items-center text-lg hover:text-[#d4af37] transition-colors"
            >
              Unit Availability
              <ChevronDown
                size={16}
                className={`${unitDropdownOpen ? "rotate-180" : ""} transition-transform`}
              />
            </button>
            {unitDropdownOpen && (
              <div className="pl-4 mt-1 space-y-1">
                {["Looker", "Properties", "Summary"].map((item) => (
                  <Link
                    key={item}
                    href={`/${item.toLowerCase()}`}
                    className="block text-base hover:text-[#d4af37]"
                    onClick={() => setIsOpen(false)}
                  >
                    {item}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Others */}
          <div>
            <button
              onClick={() => setOthersDropdownOpen(!othersDropdownOpen)}
              className="w-full flex justify-between items-center text-lg hover:text-[#d4af37] transition-colors"
            >
              Others
              <ChevronDown
                size={16}
                className={`${othersDropdownOpen ? "rotate-180" : ""} transition-transform`}
              />
            </button>
            {othersDropdownOpen && (
              <div className="pl-4 mt-1 space-y-1">
                {["Compare", "Clients"].map((item) => (
                  <Link
                    key={item}
                    href={`/${item.toLowerCase()}`}
                    className="block text-base hover:text-[#d4af37]"
                    onClick={() => setIsOpen(false)}
                  >
                    {item}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
