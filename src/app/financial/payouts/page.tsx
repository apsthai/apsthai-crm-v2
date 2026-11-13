import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DatePick } from "@/components/date-pick";
import { Field, inputCls } from "@/components/fields";
import { Flash } from "@/components/flash";
import { Submit } from "@/components/submit";
import { getMe } from "@/lib/auth";
import { addMonths, fmtDate, fmtMonth, monthStart, todayBangkok } from "@/lib/dates";
import { n2 } from "@/lib/fin";
import { markPaid, markRoundChecked, refreshRound } from "../actions";
import { FinHeader } from "../tabs";
import { MonthSelect, PrintRound } from "./month-select";

type One<T> = T | T[] | null;
const one = <T,>(x: One<T>): T | null => (Array.isArray(x) ? x[0] ?? null : x);
type LineRaw = {
  id: string; line_type: string; base_thb: number | null; share: number | null; amount: number; note: string | null;
  rule: One<{ method: string; value: number | null }>;
  kase: One<{ id: string; student: One<{ codename: string }> }>;
  pl: One<{ payment: One<{ invoice: One<{ id: string; invoice_no: string | null }> }> }>;
};
type PayoutRaw = {
  id: string; recipient_type: string; pay_date: string; status: string; total: number; paid_date: string | null; paid_amount: number | null;
  note: string | null; staff: One<{ codename: string }>; partner: One<{ name: string }>; lines: LineRaw[];
};

const STATUS: Record<string, [string, string]> = {
  draft: ["Not checked", "bg-amber-50 text-amber-800"],
  reviewed: ["Checked", "bg-navy-50 text-navy"],
  paid: ["Paid", "bg-emerald-50 text-emerald-700"],
};

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ m?: string; ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const today = todayBangkok();

  const { data: scheds } = await sb.from("payout_schedules").select("period_start, pay_date, partner_pay_date")
    .eq("cycle", "next_month").lte("period_start", monthStart(today)).order("period_start", { ascending: false });
  const list = scheds ?? [];
  // Default: last month's money, which is checked this month.
  const want = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? `${sp.m}-01` : addMonths(today, -1);
  const sched = list.find((s) => s.period_start === want) ?? list[0];
  if (!sched) return <AppShell active="/financial"><FinHeader active="/financial/payouts" /><p>No pay dates are set up yet.</p></AppShell>;
  const teamDate = sched.pay_date as string;
  const partnerDate = (sched.partner_pay_date ?? sched.pay_date) as string;
  const period = sched.period_start as string;

  const { data, error } = await sb.from("payouts")
    .select(`id, recipient_type, pay_date, status, total, paid_date, paid_amount, note,
      staff:staff!payouts_staff_id_fkey(codename), partner:partners(name),
      lines:payout_lines(id, line_type, base_thb, share, amount, note, rule:payout_rules(method, value),
        kase:cases(id, student:students(codename)),
        pl:payment_lines(payment:payments(invoice:invoices(id, invoice_no))))`)
    .in("pay_date", [teamDate, partnerDate]).order("created_at");
  if (error) throw new Error(error.message);
  const payouts = (data ?? []) as unknown as PayoutRaw[];
  const team = payouts.filter((p) => p.recipient_type === "staff" && p.pay_date === teamDate)
    .sort((a, b) => (one(a.staff)?.codename ?? "").localeCompare(one(b.staff)?.codename ?? ""));
  const partners = payouts.filter((p) => p.recipient_type === "partner" && p.pay_date === partnerDate);
  const all = [...team, ...partners];
  const step = !all.length ? 0 : all.every((p) => p.status === "paid") ? 3 : all.every((p) => p.status !== "draft") ? 2 : 1;
  const sum = (ps: PayoutRaw[]) => ps.reduce((s, p) => s + Number(p.total), 0);

  return (
    <AppShell active="/financial">
      <FinHeader active="/financial/payouts" />
      <Flash ok={sp.ok} err={sp.err} />
      <section className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelect value={period.slice(0, 7)} options={list.map((s) => ({ value: s.period_start.slice(0, 7), label: fmtMonth(s.period_start) }))} />
          <span className="text-sm text-slate-600">Check in <b className="text-slate-900">{fmtMonth(addMonths(period, 1))}</b></span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span>Team paid <b>{fmtDate(teamDate)}</b></span>
          <span>Partners paid <b>{fmtDate(partnerDate)}</b></span>
        </div>
      </section>

      <div className="no-print flex flex-wrap gap-2 text-[13px]">
        {["1. Worked out from money in", "2. Checked", "3. Paid"].map((s, i) => (
          <span key={s} className={`rounded-full px-3 py-1.5 ${step >= i + 1 ? "bg-navy font-semibold text-white" : "bg-slate-200 text-slate-700"}`}>{s}</span>
        ))}
      </div>

      <Group title={`Team · paid ${fmtDate(teamDate)}`} sub="5% of money in before VAT (or the service's own rate), split equally between the case's staff."
        total={sum(team)} payouts={team} period={period} kind="team" />
      <Group title={`Partners · paid ${fmtDate(partnerDate)}`} sub="Their % of the THB that came in, VAT included. Paid on the last day of the next month; in December, on 27 Dec."
        total={sum(partners)} payouts={partners} period={period} kind="partner" />

      <section className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p className="flex-[1_1_420px] text-[13px] text-slate-500">
          Checking locks the amounts for this round. Money that comes in later goes to the next round. After you transfer, mark each person paid with the real date and amount.
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={refreshRound}><input type="hidden" name="period" value={period} /><Submit variant="ghost">Work out again</Submit></form>
          <PrintRound />
          {all.some((p) => p.status === "draft") && (
            <form action={markRoundChecked}>
              <input type="hidden" name="period" value={period} />
              <input type="hidden" name="dates" value={`${teamDate},${partnerDate}`} />
              <Submit>Mark round as checked</Submit>
            </form>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Group({ title, sub, total, payouts, period, kind }:
  { title: string; sub: string; total: number; payouts: PayoutRaw[]; period: string; kind: "team" | "partner" }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>
        </div>
        <span className="text-base font-semibold">฿{n2(total)}</span>
      </div>
      {payouts.length === 0 ? <p className="px-5 pb-5 text-sm text-slate-500">Nothing in this round.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">{kind === "team" ? "Person" : "Partner"} · student</th>
                <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">Invoice</th>
                <th className="border-b border-slate-200 px-4 py-2.5 text-right font-semibold">{kind === "team" ? "Before VAT" : "THB in"}</th>
                <th className="border-b border-slate-200 px-4 py-2.5 text-right font-semibold">Share</th>
                <th className="border-b border-slate-200 px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const who = kind === "team" ? one(p.staff)?.codename : one(p.partner)?.name;
                const st = STATUS[p.status];
                return [
                  <tr key={p.id} className="bg-slate-50">
                    <td className="border-b border-slate-100 px-4 py-2.5 font-semibold">{who}</td>
                    <td className="border-b border-slate-100 px-4 py-2.5 text-slate-500">{p.lines.length} {p.lines.length === 1 ? "line" : "lines"}</td>
                    <td className="border-b border-slate-100" /><td className="border-b border-slate-100" />
                    <td className="border-b border-slate-100 px-4 py-2.5 text-right font-semibold">฿{n2(Number(p.total))}</td>
                    <td className="border-b border-slate-100 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st[1]}`}>{st[0]}</span>
                        {p.status === "paid" && <span className="text-xs text-slate-500">{fmtDate(p.paid_date)} · ฿{n2(Number(p.paid_amount ?? p.total))}</span>}
                        {p.status === "reviewed" && <PayForm payout={p} period={period} />}
                      </div>
                    </td>
                  </tr>,
                  ...p.lines.map((l) => {
                    const kase = one(l.kase);
                    const inv = one(one(one(l.pl)?.payment ?? null)?.invoice ?? null);
                    const rule = one(l.rule);
                    const share = kind === "team"
                      ? rule?.method === "percent" ? `${Number(rule.value)}% × ${fmtShare(l.share)}` : `fixed × ${fmtShare(l.share)}`
                      : `${round(Number(l.share ?? 0) * 100)}%`;
                    return (
                      <tr key={l.id}>
                        <td className="border-b border-slate-100 py-2 pr-4 pl-8">
                          {kase ? <Link href={`/cases/${kase.id}`} className="text-navy hover:underline">{one(kase.student)?.codename}</Link> : l.note}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-2 text-slate-600">
                          {inv ? <Link href={`/financial/invoices/${inv.id}`} className="hover:underline">{inv.invoice_no}</Link> : l.line_type === "commission" ? "Stage" : ""}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-2 text-right text-slate-600">{l.base_thb != null ? `฿${n2(Number(l.base_thb))}` : ""}</td>
                        <td className="border-b border-slate-100 px-4 py-2 text-right text-slate-600">{share}</td>
                        <td className="border-b border-slate-100 px-4 py-2 text-right">฿{n2(Number(l.amount))}</td>
                        <td className="border-b border-slate-100" />
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
function fmtShare(s: number | null) {
  const n = s ? Math.round(1 / Number(s)) : 1;
  return `1/${n}`;
}

function PayForm({ payout, period }: { payout: PayoutRaw; period: string }) {
  return (
    <details className="no-print relative">
      <summary className="cursor-pointer list-none rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-navy hover:border-navy">Mark paid</summary>
      <form action={markPaid} className="absolute right-0 z-10 mt-1 flex w-72 flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <input type="hidden" name="payout_id" value={payout.id} />
        <input type="hidden" name="period" value={period} />
        <Field label="Date transferred"><DatePick name="paid_date" defaultValue={payout.pay_date} label="Date transferred" /></Field>
        <Field label="Amount transferred (THB)">
          <input name="paid_amount" defaultValue={n2(Number(payout.total))} inputMode="decimal" className={`${inputCls} text-right`} />
        </Field>
        <Field label="Note (optional)"><input name="note" className={inputCls} /></Field>
        <Submit>Save as paid</Submit>
      </form>
    </details>
  );
}
