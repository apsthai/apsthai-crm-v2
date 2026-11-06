export const fmtTHB = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;

export function fmtTHBShort(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `฿${Math.round(n / 1_000)}k`;
  return fmtTHB(n);
}

export const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

// Converts an amount to THB with the latest rate per currency. A missing rate counts as zero and is reported.
export function toTHB(amount: number, currency: string, rates: Map<string, number>) {
  if (currency === "THB") return { thb: amount, missing: false };
  const r = rates.get(currency);
  return { thb: r ? amount * r : 0, missing: !r };
}
