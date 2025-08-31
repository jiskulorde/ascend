"use client";

import { useState, ReactNode } from "react";

type Tab = {
  value: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  defaultValue: string;
  variant?: "primary" | "sub";
};

export default function Tabs({ tabs, defaultValue, variant = "primary" }: TabsProps) {
  const [active, setActive] = useState(defaultValue);

  const isPrimary = variant === "primary";

  return (
    <div>
      {/* Tab headers */}
      <div
        className={`flex flex-wrap justify-center gap-2 ${
          isPrimary
            ? "bg-white p-2 rounded-xl shadow"
            : "bg-transparent p-0"
        }`}
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              active === tab.value
                ? isPrimary
                  ? "bg-[#0a2540] text-white"
                  : "bg-[#d4af37] text-[#0a2540]"
                : isPrimary
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "text-gray-500 hover:text-[#0a2540]"
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
