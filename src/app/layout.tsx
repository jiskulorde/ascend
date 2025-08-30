import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ascend by DMCI Homes",
  description: "Luxury real estate sales team platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f9fafb] text-gray-900 font-[Poppins]">
        <nav className="backdrop-blur-md bg-[#0a2540]/80 text-white shadow-lg sticky top-0 z-50 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            {/* Brand */}
            <Link
              href="/"
              className="text-2xl font-bold tracking-wide text-[#d4af37] hover:text-white transition-colors duration-300"
            >
              Ascend
            </Link>

            {/* Navigation */}
            <div className="space-x-6 hidden md:flex">
             <Link
                href="/dashboard"
                className="nav-link relative after:absolute after:left-0 after:-bottom-1 after:w-0 after:h-[2px] after:bg-[#d4af37] after:transition-all hover:after:w-full"
              >
                Dashboard
              </Link>
              
              <Link
                href="/looker"
                className="nav-link relative after:absolute after:left-0 after:-bottom-1 after:w-0 after:h-[2px] after:bg-[#d4af37] after:transition-all hover:after:w-full"
              >
                Looker
              </Link>

              <Link
                href="/properties"
                className="nav-link relative after:absolute after:left-0 after:-bottom-1 after:w-0 after:h-[2px] after:bg-[#d4af37] after:transition-all hover:after:w-full"
              >
                Properties
              </Link>
              
              <Link
                href="/summary"
                className="nav-link relative after:absolute after:left-0 after:-bottom-1 after:w-0 after:h-[2px] after:bg-[#d4af37] after:transition-all hover:after:w-full"
              >
                Best Units
              </Link>
              
              <Link
                href="/compare"
                className="nav-link relative after:absolute after:left-0 after:-bottom-1 after:w-0 after:h-[2px] after:bg-[#d4af37] after:transition-all hover:after:w-full"
              >
                Compare
              </Link>
              
              <Link
                href="/clients"
                className="nav-link relative after:absolute after:left-0 after:-bottom-1 after:w-0 after:h-[2px] after:bg-[#d4af37] after:transition-all hover:after:w-full"
              >
                Clients
              </Link>
            </div>
          </div>
        </nav>

        <main className="min-h-screen transition-all">{children}</main>
      </body>
    </html>
  );
}
