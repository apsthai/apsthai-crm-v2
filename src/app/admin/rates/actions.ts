"use server";

import { adminDb, back, num, s } from "../shared";

// New rates from a date. Old rates stay, so past months keep the rate they had.
export async function saveRates(fd: FormData) {
  const sb = await adminDb();
  const asOf = s(fd, "as_of");
  if (!asOf) return back("/admin/rates", "Choose the date the rates start");
  const rows: { currency: string; rate_thb: number; as_of: string }[] = [];
  for (const [key] of fd.entries()) {
    if (!key.startsWith("rate_")) continue;
    const v = num(fd, key);
    if (v && v > 0) rows.push({ currency: key.slice(5), rate_thb: v, as_of: asOf });
  }
  const code = (s(fd, "new_currency") ?? "").toUpperCase();
  const newRate = num(fd, "new_rate");
  if (code || newRate) {
    if (!/^[A-Z]{3}$/.test(code) || !(newRate && newRate > 0)) return back("/admin/rates", "A new currency needs a 3-letter code and a rate");
    rows.push({ currency: code, rate_thb: newRate, as_of: asOf });
  }
  if (!rows.length) return back("/admin/rates", "Type at least one new rate");
  const { error } = await sb.from("exchange_rates").upsert(rows, { onConflict: "currency,as_of" });
  back("/admin/rates", error);
}

// Bound to the Delete button of a currency's newest rate: the one before it is used again.
// A currency's only rate can go only when no amount, invoice or school rate is in that currency.
export async function deleteRate(currency: string, asOf: string) {
  const sb = await adminDb();
  const { count: older } = await sb.from("exchange_rates").select("currency", { count: "exact", head: true }).eq("currency", currency).lt("as_of", asOf);
  if (!older) {
    const used = await Promise.all(["receivables", "invoices", "income_terms"].map((t) =>
      sb.from(t).select("id", { count: "exact", head: true }).eq("currency", currency)));
    if (used.some((u) => u.count)) return back("/admin/rates", `${currency} is already used, so keep at least one rate`);
  }
  const { error } = await sb.from("exchange_rates").delete().eq("currency", currency).eq("as_of", asOf);
  back("/admin/rates", error);
}
