import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import QueryProvider from "@/components/QueryProvider";

import { Poppins } from "next/font/google";
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ascend by DMCI Homes",
  description: "Luxury real estate sales team platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.className}><body className="bg-[#f9fafb] text-gray-900">
      <QueryProvider>
        <Navbar />
        <main className="min-h-screen transition-all">{children}</main>
        <Footer />
      </QueryProvider>
    </body></html>
  );
}
