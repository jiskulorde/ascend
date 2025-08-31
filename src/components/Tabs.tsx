"use client";

import { useState, ReactNode } from "react";

type Tab = {
  value: string;
  label: string;
  content: ReactNode;
};

export default function Tabs({ tabs, defaultValue }: { tabs: Tab[]; defaultValue: string }) {
  const [active, setActive] = useState(defaultValue);

  return (
    <div>
      {/* Tab headers */}
      <div className="flex flex-wrap justify-center gap-2 bg-white p-2 rounded-xl shadow">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              active === tab.value
                ? "bg-[#0a2540] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tabs.find((t) => t.value === active)?.content}
      </div>
    </div>
  );
}
