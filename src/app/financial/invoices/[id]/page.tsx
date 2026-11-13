import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Flash } from "@/components/flash";
import { Submit } from "@/components/submit";
import { getMe } from "@/lib/auth";
import { fmtDate, todayBangkok } from "@/lib/dates";
import { money, n2, round2, STATUS_LOOK, thaiTotals } from "@/lib/fin";
import { flatRv, RV_SELECT, teamRules, type RvRaw } from "@/lib/fin-data";
import { cancelInvoice, deleteDraft, deletePayment, issueInvoice } from "../../actions";
import { MoneyIn } from "./money-in";

export default async function InvoicePage({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;

  const { data: inv } = await sb.from("invoices")
    .select("id, invoice_no, date, status, currency, total, bill_to_name, bill_to_address, bill_to_country, bill_to_tax_id, thai_vat, wht_pct, note, invoice_lines(id, receivable_id, description, amount, created_at), payments(id, received_date, received_thb, wht_thb, vat_thb, revenue_ex_vat, payment_lines(receivable_id, amount))")
    .eq("id", id).maybeSingle();
  if (!inv) notFound();
  const lines = [...(inv.invoice_lines ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const payments = [...(inv.payments ?? [])].sort((a, b) => a.received_date.localeCompare(b.received_date));
  const rvIds = lines.map((l) => l.receivable_id);

  const [rvRes, schedRes, ruleOf] = await Promise.all([
    sb.from("receivables").select(RV_SELECT).in("id", rvIds.length ? rvIds : ["00000000-0000-0000-0000-000000000000"]),
    sb.from("payout_schedules").select("period_start, pay_date, partner_pay_date").eq("cycle", "next_month"),
    teamRules(sb),
  ]);
  const rvs = new Map(((rvRes.data ?? []) as unknown as RvRaw[]).map((r) => [r.id, flatRv(r)]));
  const paidOf = (rid: string) => payments.flatMap((p) => p.payment_lines ?? []).filter((l) => l.receivable_id === rid)
    .reduce((s, l) => s + Number(l.amount), 0);

  const total = Number(inv.total ?? 0);
  const t = thaiTotals(total, Number(inv.wht_pct));
  const look = STATUS_LOOK[inv.status];
  const open = inv.status === "issued" || inv.status === "partially_paid";
  const moneyLines = lines.map((l) => {
    const r = rvs.get(l.receivable_id);
    const rule = r ? ruleOf(r) : { pct: 0, note: "" };
    return {
      receivableId: l.receivable_id, student: r?.student ?? "", left: round2(Number(l.amount) - paidOf(l.receivable_id)),
      staff: r?.staff ?? [], teamPct: rule.pct, teamNote: rule.note, partner: r?.partner ?? null, partnerPct: r?.partnerPct ?? 0,
    };
  }).filter((l) => l.left > 0);

  return (
    <AppShell active="/financial">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/financial/invoices" className="text-sm text-navy hover:underline">← Invoices</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold text-slate-900">
            {inv.invoice_no ?? "Draft invoice"}
            <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${look[1]}`}>{look[0]}</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {inv.status !== "cancelled" && (
            <Link href={`/financial/invoices/${inv.id}/print`} target="_blank"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-navy hover:border-navy">
              {inv.status === "draft" ? "Preview" : "Print / PDF"}
            </Link>
          )}
          {inv.status === "draft" && (
            <>
              <form action={deleteDraft}><input type="hidden" name="id" value={inv.id} /><Submit variant="danger">Delete draft</Submit></form>
              <form action={issueInvoice}><input type="hidden" name="id" value={inv.id} /><Submit>Issue invoice</Submit></form>
            </>
          )}
          {inv.status === "issued" && payments.length === 0 && (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-brand-red hover:bg-red-50">Cancel invoice</summary>
              <form action={cancelInvoice} className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                <input type="hidden" name="id" value={inv.id} />
                <p className="mb-2 text-[13px] text-slate-600">The number {inv.invoice_no} is not used again. The students go back to To collect.</p>
                <Submit variant="danger" className="w-full">Yes, cancel it</Submit>
              </form>
            </details>
          )}
        </div>
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap justify-between gap-4 text-sm">
              <div>
                <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Bill to</div>
                <div className="mt-1 font-semibold text-slate-900">{inv.bill_to_name}</div>
                {inv.bill_to_address && <div className="whitespace-pre-line text-slate-600">{inv.bill_to_address}</div>}
                <div className="text-slate-600">{inv.bill_to_country}</div>
                {inv.bill_to_tax_id && <div className="text-slate-600">Tax ID {inv.bill_to_tax_id}</div>}
              </div>
              <div className="text-right text-slate-600">
                <div>Date <b className="text-slate-900">{fmtDate(inv.date)}</b></div>
                <div>{inv.thai_vat ? "Thai invoice" : "English invoice"}{Number(inv.wht_pct) ? " · WHT 3%" : ""}</div>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <tbody>
                  {lines.map((l, i) => {
                    const r = rvs.get(l.receivable_id);
                    const paid = paidOf(l.receivable_id);
                    return (
                      <tr key={l.id}>
                        <td className="w-8 border-b border-slate-100 py-2.5 align-top text-slate-500">{i + 1}</td>
                        <td className="border-b border-slate-100 py-2.5 pr-3">
                          {l.description}
                          {r && <div className="text-xs text-slate-500">Case <Link href={`/cases/${r.caseId}`} className="text-navy hover:underline">{r.student}</Link>{r.staff.length ? ` · ${r.staff.join(", ")}` : ""}{paid > 0 && ` · paid ${n2(paid)}`}</div>}
                        </td>
                        <td className="border-b border-slate-100 py-2.5 text-right align-top whitespace-nowrap">{n2(Number(l.amount))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 ml-auto flex max-w-xs flex-col gap-1 text-sm">
              {inv.thai_vat && <>
                <div className="flex justify-between text-slate-600"><span>Before VAT</span><span>{n2(t.sub)}</span></div>
                <div className="flex justify-between text-slate-600"><span>VAT 7%</span><span>{n2(t.vat)}</span></div>
              </>}
              <div className="flex justify-between font-semibold"><span>Total ({inv.currency})</span><span>{n2(total)}</span></div>
              {Number(inv.wht_pct) > 0 && <>
                <div className="flex justify-between text-slate-600"><span>WHT 3%</span><span>-{n2(t.wht)}</span></div>
                <div className="flex justify-between font-semibold"><span>Net to pay</span><span>{n2(t.net)}</span></div>
              </>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Money in</h2>
            {payments.length === 0 ? <p className="mt-1 text-sm text-slate-500">Nothing has come in yet.</p> : (
              <div className="mt-2 flex flex-col">
                {payments.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-2.5 text-sm last:border-b-0">
                    <div>
                      <b>{fmtDate(p.received_date)}</b> · ฿{n2(Number(p.received_thb))}
                      {Number(p.wht_thb) > 0 && <span className="text-slate-500"> + WHT ฿{n2(Number(p.wht_thb))}</span>}
                      <div className="text-xs text-slate-500">
                        Before VAT ฿{n2(Number(p.revenue_ex_vat))} · pays {money((p.payment_lines ?? []).reduce((s, l) => s + Number(l.amount), 0), inv.currency)}
                      </div>
                    </div>
                    <details className="relative">
                      <summary className="cursor-pointer list-none text-xs text-slate-500 hover:text-brand-red">Delete</summary>
                      <form action={deletePayment} className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                        <input type="hidden" name="invoice_id" value={inv.id} />
                        <input type="hidden" name="payment_id" value={p.id} />
                        <p className="mb-2 text-[13px] text-slate-600">Delete this money in? Commission worked out from it is taken off too. Not possible once that commission is paid.</p>
                        <Submit variant="danger" className="w-full">Yes, delete</Submit>
                      </form>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {open && moneyLines.length > 0 && (
          <MoneyIn invoiceId={inv.id} invoiceNo={inv.invoice_no ?? ""} payer={inv.bill_to_name} currency={inv.currency}
            whtPct={Number(inv.wht_pct)} lines={moneyLines} schedules={schedRes.data ?? []} today={todayBangkok()} />
        )}
        {inv.status === "draft" && (
          <aside className="flex-[1_1_300px] rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            This is a draft. It has no number yet and the students stay off To collect while it exists.
            Issue it to give it a number, or delete it to send the students back.
          </aside>
        )}
      </div>
    </AppShell>
  );
}
