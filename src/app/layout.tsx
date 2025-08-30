// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar"; // import the client NavBar
import Footer from "@/components/Footer"; // import footer

export const metadata: Metadata = {
  title: "Ascend by DMCI Homes",
  description: "Luxury real estate sales team platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f9fafb] text-gray-900 font-[Poppins]">
        <Navbar />   {/* ✅ client navbar */}
        <main className="min-h-screen transition-all">{children}</main>
        <Footer />   {/* ✅ global footer */}
      </body>
    </html>
  );
}
