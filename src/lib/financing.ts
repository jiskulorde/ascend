// src/lib/financing.ts
//
// Single source of truth for the shared quote-math (TCP → downpayment → net DP →
// DP monthly → closing fee → bank balance → 15/20yr amortization) and the
// rtoTypeCandidates() unit-type mapping. Used by:
//   - src/app/compare/page.tsx
//   - src/app/computation/[unitID]/page.tsx
//   - src/components/shortlists/* (shortlist detail page)
//
// Formulas, constants, and rounding are unchanged from what Compare and Computation
// each hardcoded locally before this module existed — this is a straight extraction,
// not a reimplementation. Do not change any value/formula here without re-reading
// CLAUDE.md's guidance on financial calculations; all three call sites depend on
// this file producing byte-identical output to before.

import { RESERVATION_FEE_DEFAULT, DOWNPAYMENT_PERCENT_DEFAULT } from "@/lib/quoteDefaults";

export { RESERVATION_FEE_DEFAULT, DOWNPAYMENT_PERCENT_DEFAULT };

export const DEFAULT_DISCOUNT_PCT = 0;
export const DEFAULT_MONTHS_TO_PAY = 36;
export const DEFAULT_CLOSING_FEE_PCT = 10.5;
export const DEFAULT_RATE_15YR = 6;
export const DEFAULT_RATE_20YR = 6;

export type QuoteInputs = {
  listPrice: number;
  discountPct?: number;
  downPct?: number;
  reservationFee?: number;
  monthsToPay?: number;
  closingFeePct?: number;
  rate15yr?: number;
  rate20yr?: number;
};

export type QuoteResult = {
  TCP: number;
  dpAmount: number;
  netDp: number;
  dpMonthly: number;
  closingFee: number;
  bankBalance: number;
  monthly15: number;
  monthly20: number;
};

function amortize(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  return r === 0 ? principal / n : principal * (r / (1 - Math.pow(1 + r, -n)));
}

export function computeQuote({
  listPrice,
  discountPct = DEFAULT_DISCOUNT_PCT,
  downPct = DOWNPAYMENT_PERCENT_DEFAULT,
  reservationFee = RESERVATION_FEE_DEFAULT,
  monthsToPay = DEFAULT_MONTHS_TO_PAY,
  closingFeePct = DEFAULT_CLOSING_FEE_PCT,
  rate15yr = DEFAULT_RATE_15YR,
  rate20yr = DEFAULT_RATE_20YR,
}: QuoteInputs): QuoteResult {
  const TCP = (listPrice || 0) * (1 - discountPct / 100);
  const dpAmount = (TCP * downPct) / 100;
  const netDp = Math.max(0, dpAmount - reservationFee);
  const dpMonthly = monthsToPay > 0 ? netDp / monthsToPay : 0;
  const closingFee = (TCP * closingFeePct) / 100;
  const bankBalance = Math.max(0, TCP - dpAmount);

  return {
    TCP,
    dpAmount,
    netDp,
    dpMonthly,
    closingFee,
    bankBalance,
    monthly15: amortize(bankBalance, rate15yr, 15),
    monthly20: amortize(bankBalance, rate20yr, 20),
  };
}

// The RTO unit-type mapping used by Compare, Computation, and the shortlist
// detail page, so /api/rto-rate is always queried with the same candidate type
// strings regardless of caller.
export function rtoTypeCandidates(rawType: string): string[] {
  const t = (rawType || "").toUpperCase().replace(/\s+/g, "");
  const out: string[] = [];
  if (t.includes("STUDIO")) out.push("STUDIO");
  if (t.includes("1BR") || t.includes("1BED")) out.push("1BR");
  if (t.includes("2BR") || t.includes("2BED")) out.push("2BR");
  if (t.includes("3BR") || t.includes("3BED")) {
    if (t.includes("LOFT") && t.includes("INNER")) out.push("3BR LOFT INNER");
    if (t.includes("LOFT") && t.includes("END")) out.push("3BR LOFT END");
    out.push("3BR");
  }
  if (t.includes("4BR") || t.includes("4BED")) out.push("4BR");
  if (out.length === 0) out.push(rawType.toUpperCase());
  return out;
}

export function fmtPhp(n: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(n);
}
