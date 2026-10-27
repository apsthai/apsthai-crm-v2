import Link from "next/link";
import { A, Card, Empty, Pill } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { fmtDate, fmtMoney, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { addReceivable, updateReceivable } from "../cases/actions";
import { deletePayment } from "./actions";
import { loadLookups } from "@/lib/lookups";
import { CURRENCIES } from "@/lib/format";
import { payerKey } from "@/lib/money";

export default async function Money() {
  const { supabase: sb } = await requireAdmin();
  const { t, lang } = await getT();
  const today = todayBangkok();
  const [{ data: recs }, { data: invoices }, { data: payments }, lk] = await Promise.all([
    sb.from("receivables").select("*, school:schools(name), partner:partners(name), case:cases(id, student:students(codename))")
      .in("status", ["expected", "invoiced", "partially_paid"]).order("expected_date").limit(500),
    sb.from("invoices").select("id, invoice_no, date, bill_to_name, currency, total, status").order("date", { ascending: false }).limit(100),
    sb.from("payments").select("id, received_date, received_thb, vat_thb, wht_thb, revenue_ex_vat, invoice:invoices(id, invoice_no), payment_lines(amount, receivable:receivables(case:cases(student:students(codename))))")
      .order("received_date", { ascending: false }).limit(50),
    loadLookups(sb),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">{t("money")}</h1>
        <div className="flex gap-2">
          <Link href="/money/invoices/new" className="btn">{t("newInvoice")}</Link>
          <Link href="/money/payments/new" className="btn-ghost">{t("recordPayment")}</Link>
        </div>
      </div>

      <Card title={`${t("openReceivables")} (${recs?.length ?? 0})`}>
        {!recs?.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("expectedDate")}</th><th>{t("student")}</th><th>{t("payer")}</th><th>{t("type")}</th><th>{t("amount")}</th><th>{t("status")}</th><th /></tr></thead>
            <tbody>{recs.map((r: any) => (
              <tr key={r.id} className={r.expected_date < today ? "bg-red-50/50" : ""}>
                <td>{fmtDate(r.expected_date, lang)}</td>
                <td>{r.case ? <A href={`/cases/${r.case.id}`}>{r.case.student?.codename}</A> : "-"}</td>
                <td>{r.school?.name ?? r.partner?.name ?? r.payer_name}</td>
                <td>{t(r.type)}</td>
                <td className="whitespace-nowrap">{fmtMoney(r.amount, r.currency)}</td>
                <td><Pill status={r.status} label={t(r.status)} /></td>
                <td className="whitespace-nowrap">
                  <Link className="link text-xs" href={`/money/invoices/new?${new URLSearchParams({ payer: payerKey(r), currency: r.currency })}`}>{t("newInvoice")}</Link>
                  {r.status === "partially_paid" && (
                    <form action={updateReceivable} className="inline">
                      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value="/money" />
                      <input type="hidden" name="amount" value={r.amount} /><input type="hidden" name="expected_date" value={r.expected_date} />
                      <button name="status" value="paid" className="ml-2 text-xs link">{t("closePaid")}</button>
                    </form>
                  )}
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm link">{t("addReceivable")} ({t("bonus")})</summary>
          <form action={addReceivable} className="mt-2 grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="back" value="/money" />
            <select name="type" className="input"><option value="bonus">{t("bonus")}</option></select>
            <select name="payer_type" className="input">{["school", "partner", "individual"].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select>
            <select name="school_id" className="input"><option value="">{t("school")}</option>{lk.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select name="partner_id" className="input"><option value="">{t("partner")}</option>{lk.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input name="payer_name" placeholder={t("individual")} className="input" />
            <input name="amount" type="number" step="0.01" placeholder={t("amount")} className="input" required />
            <select name="currency" className="input">{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select>
            <input name="expected_date" type="date" className="input" defaultValue={today} required />
            <button className="btn-ghost">{t("add")}</button>
          </form>
        </details>
      </Card>

      <Card title={t("invoices")}>
        {!invoices?.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("invoiceNo")}</th><th>{t("date")}</th><th>{t("billTo")}</th><th>{t("total")}</th><th>{t("status")}</th></tr></thead>
            <tbody>{invoices.map((i: any) => (
              <tr key={i.id}>
                <td><A href={`/money/invoices/${i.id}`}>{i.invoice_no}</A></td><td>{fmtDate(i.date, lang)}</td><td>{i.bill_to_name}</td>
                <td>{fmtMoney(i.total, i.currency)}</td><td><Pill status={i.status} label={t(i.status)} /></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>

      <Card title={t("payments")}>
        {!payments?.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("receivedDate")}</th><th>{t("invoiceNo")}</th><th>{t("student")}</th><th>{t("receivedThb")}</th><th>{t("vat")}</th><th>{t("wht")}</th><th>{t("revenue")}</th><th /></tr></thead>
            <tbody>{payments.map((p: any) => (
              <tr key={p.id}>
                <td>{fmtDate(p.received_date, lang)}</td>
                <td>{p.invoice ? <A href={`/money/invoices/${p.invoice.id}`}>{p.invoice.invoice_no}</A> : "-"}</td>
                <td className="text-xs">{[...new Set((p.payment_lines ?? []).map((l: any) => l.receivable?.case?.student?.codename).filter(Boolean))].join(", ")}</td>
                <td>{fmtMoney(p.received_thb)}</td><td>{fmtMoney(p.vat_thb)}</td><td>{fmtMoney(p.wht_thb)}</td><td>{fmtMoney(p.revenue_ex_vat)}</td>
                <td>
                  <details className="text-xs"><summary className="cursor-pointer text-red-700">{t("remove")}</summary>
                    <form action={deletePayment}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value="/money" /><button className="btn-danger mt-1 py-1 text-xs">{t("remove")}?</button></form>
                  </details>
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
