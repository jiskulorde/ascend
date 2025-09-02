import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buyer’s Guide • Ascend DMCI Homes",
  description: "Prepare the necessary requirements and documents when buying a DMCI Homes property.",
};

export default function BuyersGuidePage() {
  return (
    <main className="section">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header */}
        <header className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-semibold">
            Buyer’s Guide
          </h1>
          <p className="text-muted-foreground">
            A quick reference for clients on the documents and requirements
            needed when purchasing a DMCI Homes property.
          </p>
        </header>

        {/* Basic Requirements */}
        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Basic Requirements</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm md:text-base">
            <li>Two (2) government-issued IDs with three specimen signatures (buyer/s)</li>
            <li>Selfie photo holding one government-issued ID (buyer/s)</li>
            <li>Latest proof of billing <span className="muted">(within 2 months — credit card, Meralco, etc.)</span></li>
            <li>Proof of TIN (TIN card)</li>
            <li>Proof of bank account <span className="muted">(for auto-debit monthly down payment)</span></li>
          </ul>
        </section>

        {/* Proof of Income */}
        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Proof of Income</h2>
          <p className="text-sm text-muted-foreground">
            Submit at least three (3) of the following if employed, or the
            equivalent if self-employed/business owner.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-medium mb-2">For Employed Buyers:</h3>
              <ul className="list-disc pl-6 space-y-2 text-sm md:text-base">
                <li>Bank statement (last 3 months)</li>
                <li>Latest ITR</li>
                <li>Latest payslip</li>
                <li>Certificate of Employment with salary details</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">For Business Owners:</h3>
              <ul className="list-disc pl-6 space-y-2 text-sm md:text-base">
                <li>Bank statement (last 3 months)</li>
                <li>Latest business ITR</li>
                <li>Business permit/s</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Down Payment Options */}
        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Monthly Down Payment Options</h2>
          <p className="text-sm text-muted-foreground">
            For clients based abroad, payments can be made conveniently through:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm md:text-base">
            <li>
              <strong>Online Bills Payments or Auto Debit enrollment</strong>{" "}
              via PH bank accounts (BPI, BDO, EastWest, UnionBank, Security Bank).
            </li>
            <li>
              <strong>Remittance centers</strong> available in your country (a
              list of accepted centers will be provided).
            </li>
          </ul>
        </section>

        {/* CTA */}
        <section className="rounded-lg bg-[color:var(--primary)] text-[color:var(--primary-foreground)] p-6 md:p-8 text-center space-y-3">
          <h2 className="text-xl font-semibold">Need assistance?</h2>
          <p className="opacity-90 text-sm md:text-base">
            Connect with one of our sales consultants or your assigned manager
            for personalized guidance.
          </p>
          <a
            href="/clients"
            className="inline-flex items-center justify-center rounded-lg bg-white text-foreground px-4 py-2 mt-2 font-medium hover:brightness-95"
          >
            Find an Agent
          </a>
        </section>
      </div>
    </main>
  );
}
