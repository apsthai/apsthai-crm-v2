import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Flash } from "@/components/flash";
import { Submit } from "@/components/submit";
import { getMe } from "@/lib/auth";
import { cycleOf, todayBangkok } from "@/lib/dates";
import { fmtTHB } from "@/lib/money";
import { AdminHeader } from "../tabs";
import { saveTargets } from "./actions";

// Targets for the Flight Deck: money in for the company, and successful cases per service, per cycle (Sep to Aug).
export default async function TargetsPage({ searchParams }: { searchParams: Promise<{ cycle?: string; ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const current = cycleOf(todayBangkok()).start;
  const cycle = /^\d{4}$/.test(sp.cycle ?? "") ? `${sp.cycle}-09-01` : current;
  const end = `${Number(cycle.slice(0, 4)) + 1}-08-31`;
  const y = Number(current.slice(0, 4));

  const [catsRes, targetsRes, wonRes, payRes] = await Promise.all([
    sb.from("categories").select("id, name_en, active").order("sort_order"),
    sb.from("targets").select("category_id, cases, revenue_thb").eq("cycle_start", cycle),
    sb.from("cases").select("category_id").eq("overall_status", "success").gte("closed_date", cycle).lte("closed_date", end),
    sb.from("payments").select("received_thb").gte("received_date", cycle).lte("received_date", end),
  ]);
  if (catsRes.error) throw new Error(catsRes.error.message);
  const t = new Map((targetsRes.data ?? []).map((r) => [r.category_id as string | null, r]));
  const won = new Map<string, number>();
  for (const c of wonRes.data ?? []) won.set(c.category_id, (won.get(c.category_id) ?? 0) + 1);
  const moneyIn = (payRes.data ?? []).reduce((a, p) => a + Number(p.received_thb), 0);
  // Hidden services show only if they already have a target or a result this cycle.
  const cats = (catsRes.data ?? []).filter((c) => c.active || t.has(c.id) || won.has(c.id));
  const company = t.get(null);
  const box = "w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-sm";
  const label = (c: string) => `${c.slice(0, 4)}-${String(Number(c.slice(2, 4)) + 1).padStart(2, "0")}`;

  return (
    <AppShell active="/admin/targets">
      <AdminHeader active="/admin/targets" />
      <Flash ok={sp.ok} err={sp.err} />
      <section className="flex max-w-3xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Targets {label(cycle)}</h2>
            <p className="text-[13px] text-slate-500">Shown on the Flight Deck. Leave a box blank for no target.</p>
          </div>
          <form className="flex items-center gap-2 text-sm" action="/admin/targets">
            <select name="cycle" defaultValue={cycle.slice(0, 4)} aria-label="Cycle" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5">
              {[y + 1, y, y - 1].map((v) => <option key={v} value={v}>{label(`${v}-09-01`)}</option>)}
            </select>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-navy">Show</button>
          </form>
        </div>
        <form action={saveTargets} className="flex flex-col gap-4">
          <input type="hidden" name="cycle" value={cycle} />
          <input type="hidden" name="services" value={cats.map((c) => c.id).join(",")} />
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <span className="w-56 font-medium">Money in, whole company (THB, incl. VAT)</span>
            <input name="revenue" inputMode="decimal" defaultValue={company?.revenue_thb ?? ""} className={box} aria-label="Money-in target" />
            <span className="text-[13px] text-slate-500">So far {fmtTHB(moneyIn)}</span>
          </label>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="border-b border-slate-200 px-2 py-2 font-semibold">Service</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold">Target (successful cases)</th>
                <th className="border-b border-slate-200 px-2 py-2 text-right font-semibold">So far</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td className="border-b border-slate-100 px-2 py-2">{c.name_en}{!c.active && <span className="ml-2 text-xs text-slate-400">Hidden</span>}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-right">
                    <input name={`cases_${c.id}`} inputMode="numeric" defaultValue={t.get(c.id)?.cases ?? ""} aria-label={`Target for ${c.name_en}`} className={box} />
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2 text-right">{won.get(c.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div><Submit>Save targets</Submit></div>
        </form>
      </section>
    </AppShell>
  );
}
