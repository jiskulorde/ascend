"use client";

import PreviewSwitch from "@/components/PreviewSwitch";

export default function ManagerBarClient({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-2">
      <a
        href="/dashboard/appearance"
        className="btn btn-primary shadow-lg"
        aria-label="Edit homepage layout"
      >
        Edit homepage
      </a>

      {/* re-use your existing preview toggle */}
      <PreviewSwitch show />
    </div>
  );
}
