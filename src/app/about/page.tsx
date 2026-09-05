// src/app/about/page.tsx
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us • Ascend DMCI Homes",
  description: "What Ascend is, who it's for, and how it helps buyers and authorized DMCI Homes sellers.",
};

export default function AboutPage() {
  return (
    <main className="section">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header */}
        <header className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-semibold">About Ascend</h1>
          <p className="text-muted-foreground">
            Team Ascend built Ascend to make exploring and selling DMCI Homes
            properties simpler, faster, and more transparent.
          </p>
        </header>

        {/* For buyers */}
        <section className="card p-6 space-y-3">
          <h2 className="text-xl font-semibold">For buyers</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Ascend helps you explore DMCI Homes projects and browse a
            selection of currently available units — no account required.
            When you’re ready for more detail, personalized options, or a
            payment estimate, a DMCI-authorized property consultant can walk
            you through the full inventory and financing options available
            to you.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/projects" className="btn btn-outline">
              Browse Projects
            </Link>
            <Link href="/buyers-guide" className="btn btn-outline">
              Buyer’s Guide
            </Link>
          </div>
        </section>

        {/* For authorized sellers */}
        <section className="card p-6 space-y-3">
          <h2 className="text-xl font-semibold">For authorized property sellers</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Authorized DMCI Homes sellers use Ascend as a working tool: the
            full, real-time unit inventory, side-by-side comparisons, a
            lowest-price summary, and payment computations (downpayment,
            financing, and Rent-to-Own where applicable) to prepare accurate,
            client-ready property options.
          </p>
          <p className="text-sm md:text-base text-muted-foreground">
            Access to these tools is account-based and limited to authorized
            sellers — it isn’t something a buyer account unlocks by signing
            up.
          </p>
        </section>

        {/* Why Ascend exists */}
        <section className="card p-6 space-y-3">
          <h2 className="text-xl font-semibold">Why Ascend exists</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Property information changes often — prices, unit status, and
            availability shift day to day. Ascend keeps buyers and sellers
            working from the same up-to-date picture, so conversations about
            a property start from accurate information rather than outdated
            listings.
          </p>
        </section>

        {/* CTA */}
        <section className="rounded-lg bg-[color:var(--primary)] text-[color:var(--primary-foreground)] p-6 md:p-8 text-center space-y-3">
          <h2 className="text-xl font-semibold">Have questions?</h2>
          <p className="opacity-90 text-sm md:text-base">
            Reach out through our Buyer’s Guide to connect with a sales
            consultant.
          </p>
          <Link
            href="/buyers-guide"
            className="inline-flex items-center justify-center rounded-lg bg-white text-foreground px-4 py-2 mt-2 font-medium hover:brightness-95"
          >
            Get in touch
          </Link>
        </section>
      </div>
    </main>
  );
}
