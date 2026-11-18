import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DatePick } from "@/components/date-pick";
import { Flash } from "@/components/flash";
import { Submit } from "@/components/submit";
import { getMe, seesAll } from "@/lib/auth";
import { fmtDate, todayBangkok } from "@/lib/dates";
import { AdminHeader } from "../tabs";
import { DeleteButton } from "@/components/delete-button";
import { deleteRate, saveRates } from "./actions";

export default async function RatesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (!seesAll(me)) redirect("/dashboard");
  const sp = await searchParams;
  const [{ data }, ...usedRes] = await Promise.all([
    sb.from("exchange_rates").select("currency, rate_thb, as_of").order("as_of", { ascending: false }),
    sb.from("receivables").select("currency"), sb.from("invoices").select("currency"), sb.from("income_terms").select("currency"),
  ]);
  // A currency's only rate can be deleted only while nothing is in that currency.
  const used = new Set(usedRes.flatMap((u) => (u.data ?? []).map((x) => x.currency as string)));
  const latest = new Map<string, { rate: number; asOf: string; prev?: number }>();
  for (const r of data ?? []) {
    const cur = latest.get(r.currency);
    if (!cur) latest.set(r.currency, { rate: Number(r.rate_thb), asOf: r.as_of });
    else if (cur.prev === undefined) cur.prev = Number(r.rate_thb);
  }
  const order = ["GBP", "USD", "EUR", "AUD", "NZD", "CAD", "CHF", "SGD"];
  const rank = (c: string) => (order.includes(c) ? order.indexOf(c) : 99);
  const rows = [...latest.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
  const today = todayBangkok();

  return (
    <AppShell active="/admin/rates">
      <AdminHeader active="/admin/rates" />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveRates} className="max-w-3xl rounded-xl border border-slate-200 bg-white">
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold text-slate-900">Exchange rates</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            THB for 1 unit. Used for the Dashboard and the To collect totals, not for invoices or money in (those use the real THB).
            Type only the rates that change. Old rates are kept, so past months keep the rate they had.
          </p>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="border-b border-slate-200 px-5 py-2.5 font-semibold">Currency</th>
              <th className="border-b border-slate-200 px-5 py-2.5 text-right font-semibold">Now</th>
              <th className="border-b border-slate-200 px-5 py-2.5 font-semibold">Since</th>
              <th className="border-b border-slate-200 px-5 py-2.5 font-semibold">New rate</th>
              <th className="border-b border-slate-200 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map(([cur, r]) => (
              <tr key={cur}>
                <td className="border-b border-slate-100 px-5 py-2.5 font-medium">{cur}</td>
                <td className="border-b border-slate-100 px-5 py-2.5 text-right">
                  ฿{r.rate.toFixed(2)}
                  {r.prev !== undefined && r.prev !== r.rate && <span className={`ml-1 text-xs ${r.rate > r.prev ? "text-emerald-700" : "text-brand-red"}`}>{r.rate > r.prev ? "▲" : "▼"} from {r.prev.toFixed(2)}</span>}
                </td>
                <td className="border-b border-slate-100 px-5 py-2.5 text-slate-500">{fmtDate(r.asOf)}</td>
                <td className="border-b border-slate-100 px-5 py-2.5">
                  <input name={`rate_${cur}`} inputMode="decimal" placeholder={r.rate.toFixed(2)} aria-label={`New rate for ${cur}`}
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right" />
                </td>
                <td className="border-b border-slate-100 px-3 py-2.5 text-right">
                  {(r.prev !== undefined || !used.has(cur)) && <DeleteButton inForm small action={deleteRate.bind(null, cur, r.asOf)}
                    question={r.prev !== undefined ? `Delete this rate? ${r.prev.toFixed(2)} is used again.` : `Delete ${cur}?`} />}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-5 py-2.5"><input name="new_currency" placeholder="New, e.g. JPY" maxLength={3} aria-label="New currency code" className="w-32 rounded-lg border border-slate-300 px-2 py-1 uppercase" /></td>
              <td className="px-5 py-2.5 text-right text-slate-400">-</td>
              <td className="px-5 py-2.5" />
              <td className="px-5 py-2.5"><input name="new_rate" inputMode="decimal" aria-label="Rate for the new currency" className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right" /></td>
              <td />
            </tr>
          </tbody>
        </table>
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-slate-600">New rates start on
            <DatePick name="as_of" defaultValue={today} label="New rates start on" />
          </label>
          <Submit>Save new rates</Submit>
        </div>
      </form>
    </AppShell>
  );
}
