// src/app/projects/ALD/page.tsx

import Link from "next/link";

export default function ALDProjectPage() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Project</div>
          <h1 className="mt-1 text-2xl font-semibold">Alder Residences</h1>

          <p className="mt-3 text-sm text-muted-foreground">
            View available units, lowest prices, price per sqm, and computation options from the inventory summary.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn btn-outline" href="/summary">
              View Inventory Summary
            </Link>

            <Link className="btn btn-ghost" href="/">
              Back to Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}