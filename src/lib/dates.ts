// All dates are calendar dates in Asia/Bangkok, as ISO strings (YYYY-MM-DD).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function bangkokParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export const todayBangkok = () => bangkokParts().date;
export const hourBangkok = () => bangkokParts().hour;

const toUTC = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const toISO = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, days: number) {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function addMonths(iso: string, months: number) {
  const d = toUTC(iso);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  return toISO(d);
}

export const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((toUTC(toIso).getTime() - toUTC(fromIso).getTime()) / 86400000);
}

// The cycle runs September to August.
export function cycleOf(iso: string) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const startYear = m >= 9 ? y : y - 1;
  return {
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-08-31`,
    label: `Sep ${startYear} - Aug ${startYear + 1}`,
  };
}

export function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = toUTC(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtMonth(iso?: string | null) {
  if (!iso) return "";
  const d = toUTC(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtMonthShort(iso: string) {
  const d = toUTC(iso);
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

export function fmtLongDate(iso: string) {
  const d = toUTC(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
