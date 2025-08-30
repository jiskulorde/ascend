export default function Footer() {
  return (
    <footer className="bg-[#0a2540] text-white py-8 mt-12">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Brand */}
        <div>
          <h2 className="text-2xl font-bold text-[#d4af37]">Ascend</h2>
          <p className="mt-2 text-sm text-gray-300">
            DMCI Homes real estate sales team platform by Team Ascend.
          </p>
        </div>

        {/* Column 2: Links */}
        <div>
          <h3 className="font-semibold text-lg mb-3 text-[#d4af37]">Quick Links</h3>
          <ul className="space-y-2">
            <li><a href="/dashboard" className="hover:text-[#d4af37] transition">Dashboard</a></li>
            <li><a href="/properties" className="hover:text-[#d4af37] transition">Properties</a></li>
            <li><a href="/clients" className="hover:text-[#d4af37] transition">Clients</a></li>
            <li><a href="/compare" className="hover:text-[#d4af37] transition">Compare</a></li>
          </ul>
        </div>

        {/* Column 3: Contact */}
        <div>
          <h3 className="font-semibold text-lg mb-3 text-[#d4af37]">Contact Us</h3>
          <p className="text-sm text-gray-300">123 DMCI Ave, Manila, Philippines</p>
          <p className="text-sm text-gray-300">Email: support@ascend.com</p>
          <p className="text-sm text-gray-300">Phone: +63 912 345 6789</p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700 mt-6 pt-4 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Team Ascend. All rights reserved.
      </div>
    </footer>
  );
}
