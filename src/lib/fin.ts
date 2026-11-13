// Money helpers for the Financial pages. Amounts are kept to 2 decimals.

export const n2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (amount: number, currency: string) => `${currency} ${n2(amount)}`;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Thai invoices show the date as dd/mm/yyyy in the Buddhist year.
export const thaiDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${Number(iso.slice(0, 4)) + 543}`;

// Billed amounts include 7% VAT. A Thai invoice shows the subtotal before VAT, the VAT and withholding.
export function thaiTotals(total: number, whtPct: number) {
  const sub = round2((total * 100) / 107);
  const vat = round2(total - sub);
  const wht = round2((sub * whtPct) / 100);
  return { sub, vat, total, wht, net: round2(total - wht) };
}

export const STATUS_LOOK: Record<string, [string, string]> = {
  draft: ["Draft", "bg-slate-100 text-slate-600"],
  issued: ["Waiting", "bg-amber-50 text-amber-800"],
  partially_paid: ["Part paid", "bg-amber-50 text-amber-800"],
  paid: ["Paid", "bg-emerald-50 text-emerald-700"],
  cancelled: ["Cancelled", "bg-slate-100 text-slate-500 line-through"],
};

export const COUNTRIES = ["United Kingdom", "Thailand", "Singapore", "Australia", "New Zealand", "United States", "Canada", "Switzerland", "Ireland", "Netherlands", "Germany", "France", "Spain", "Italy", "Hong Kong", "Malaysia"];
