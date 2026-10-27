import "server-only";
import { redirect } from "next/navigation";

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
export const num = (fd: FormData, k: string) => {
  const s = str(fd, k);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
// "2026-09" from <input type=month> -> "2026-09-01"
export const monthStart = (fd: FormData, k: string) => {
  const s = str(fd, k);
  return s ? `${s.slice(0, 7)}-01` : null;
};

// Send the user back with a message. Database errors show their message only (never row data).
export function done(path: string, err?: { message: string } | null | string): never {
  const sep = path.includes("?") ? "&" : "?";
  if (err) {
    const msg = typeof err === "string" ? err : err.message;
    redirect(`${path}${sep}err=${encodeURIComponent(msg.slice(0, 300))}`);
  }
  redirect(`${path}${sep}ok=1`);
}
