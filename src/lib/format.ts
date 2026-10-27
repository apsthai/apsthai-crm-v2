const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ISO date "2026-09-22" -> "22 ก.ย. 2026"
export function fmtDate(iso?: string | null, lang: "th" | "en" = "th") {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${(lang === "en" ? EN_MONTHS : TH_MONTHS)[m - 1]} ${y}`;
}
export function fmtMonth(iso?: string | null, lang: "th" | "en" = "th") {
  if (!iso) return "";
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  return `${(lang === "en" ? EN_MONTHS : TH_MONTHS)[m - 1]} ${y}`;
}

const SYMBOL: Record<string, string> = { THB: "฿", GBP: "£", USD: "$", SGD: "S$", EUR: "€", AUD: "A$" };
export function fmtMoney(v?: number | string | null, currency = "THB") {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const sym = SYMBOL[currency] ?? `${currency} `;
  return `${n < 0 ? "-" : ""}${sym}${s}`;
}

// today in Bangkok as ISO date
export function todayBangkok() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}
export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// Sep-Aug cycle label for a date, e.g. 2026-10-01 -> "2026-27"
export function cycleOf(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  const start = m >= 9 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
export const CURRENCIES = ["THB", "GBP", "USD", "SGD", "EUR", "AUD"];
