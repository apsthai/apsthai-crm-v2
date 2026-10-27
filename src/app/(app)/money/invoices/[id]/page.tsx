import Link from "next/link";
import { notFound } from "next/navigation";
import { A, Card, Field, Pill } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { fmtDate, fmtMoney, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { remaining } from "@/lib/money";
import { deletePayment, recordPayment, setInvoiceStatus, updateInvoiceHeader, updateInvoiceLine } from "../../actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase: sb } = await requireAdmin();
  const { t, lang } = await getT();
  const { data: inv } = await sb.from("invoices")
    .select("*, invoice_lines(id, description, amount, receivable:receivables(id, amount, status, case_id, payment_lines(amount))), payments(id, received_date, received_thb, vat_thb, wht_thb, revenue_ex_vat)")
    .eq("id", id).maybeSingle();
  if (!inv) notFound();
  const lines = (inv.invoice_lines ?? []) as any[];
  const draft = inv.status === "draft";
  const open = !["paid", "cancelled"].includes(inv.status);

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">{inv.invoice_no} <Pill status={inv.status} label={t(inv.status)} /></h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/money/invoices/${id}/print`} className="btn-ghost" target="_blank">{t("print")}</Link>
          {draft && <form action={setInvoiceStatus}><input type="hidden" name="id" value={id} /><button name="status" value="issued" className="btn">{t("issue")}</button></form>}
          {open && (
            <details><summary className="btn-danger cursor-pointer list-none">{t("cancelled")}</summary>
              <form action={setInvoiceStatus} className="mt-1"><input type="hidden" name="id" value={id} /><button name="status" value="cancelled" className="btn-danger py-1 text-xs">{t("cancelled")}?</button></form>
            </details>
          )}
        </div>
      </div>

      <Card>
        <form action={updateInvoiceHeader} className="grid-form">
          <input type="hidden" name="id" value={id} />
          <Field label={t("billTo")}><input name="bill_to_name" className="input" defaultValue={inv.bill_to_name} required /></Field>
          <Field label={t("billToAddress")}><textarea name="bill_to_address" rows={2} className="input" defaultValue={inv.bill_to_address ?? ""} /></Field>
          <Field label="FlowAccount"><input name="external_doc_no" className="input" defaultValue={inv.external_doc_no ?? ""} /></Field>
          <Field label={t("date")}><input name="date" type="date" className="input" defaultValue={inv.date} /></Field>
          <Field label={t("dueDate")}><input name="due_date" type="date" className="input" defaultValue={inv.due_date ?? ""} /></Field>
          <div className="flex items-end"><button className="btn-ghost">{t("save")}</button></div>
        </form>
      </Card>

      <Card title={`${t("total")} ${fmtMoney(inv.total, inv.currency)}`}>
        <div className="overflow-x-auto"><table className="tbl">
          <thead><tr><th>#</th><th>{t("notes")}</th><th>{t("amount")}</th><th>{t("status")}</th></tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={l.id}>
              <td>{i + 1}</td>
              <td colSpan={draft ? 2 : 1}>
                {draft ? (
                  <form action={updateInvoiceLine} className="flex flex-wrap gap-1">
                    <input type="hidden" name="id" value={l.id} /><input type="hidden" name="invoice_id" value={id} />
                    <input name="description" className="input flex-1 py-1" defaultValue={l.description ?? ""} />
                    <input name="amount" type="number" step="0.01" className="input w-32 py-1" defaultValue={l.amount} />
                    <button className="btn-ghost py-1">{t("save")}</button>
                  </form>
                ) : <>{l.description} {l.receivable?.case_id && <A href={`/cases/${l.receivable.case_id}`}>→</A>}</>}
              </td>
              {!draft && <td>{fmtMoney(l.amount, inv.currency)}</td>}
              <td><Pill status={l.receivable?.status} label={t(l.receivable?.status ?? "")} /></td>
            </tr>))}</tbody>
        </table></div>
      </Card>

      {open && (
        <Card title={t("recordPayment")}>
          <form action={recordPayment} className="space-y-3">
            <input type="hidden" name="invoice_id" value={id} />
            <div className="grid-form">
              <Field label={t("receivedDate")}><input name="received_date" type="date" className="input" defaultValue={todayBangkok()} /></Field>
              <Field label={t("receivedThb")}><input name="received_thb" type="number" step="0.01" className="input" required /></Field>
              <Field label={t("wht")}><input name="wht_thb" type="number" step="0.01" className="input" /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includes_vat" defaultChecked /> {t("includesVat")}</label>
              <Field label={t("vat")} hint="ว่าง = คำนวณ 7/107 ให้"><input name="vat_thb" type="number" step="0.01" className="input" /></Field>
            </div>
            <p className="label">{t("payFor")}</p>
            <div className="space-y-1">
              {lines.filter((l) => l.receivable && !["paid", "cancelled"].includes(l.receivable.status)).map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <input type="hidden" name="line_receivable" value={l.receivable.id} />
                  <input name="line_amount" type="number" step="0.01" className="input w-36 py-1" defaultValue={remaining(l.receivable)} />
                  <span>{inv.currency} · {l.description}</span>
                </div>
              ))}
            </div>
            <button className="btn">{t("recordPayment")}</button>
          </form>
        </Card>
      )}

      {(inv.payments ?? []).length > 0 && (
        <Card title={t("payments")}>
          <table className="tbl">
            <thead><tr><th>{t("receivedDate")}</th><th>{t("receivedThb")}</th><th>{t("vat")}</th><th>{t("wht")}</th><th>{t("revenue")}</th><th /></tr></thead>
            <tbody>{inv.payments.map((p: any) => (
              <tr key={p.id}><td>{fmtDate(p.received_date, lang)}</td><td>{fmtMoney(p.received_thb)}</td><td>{fmtMoney(p.vat_thb)}</td><td>{fmtMoney(p.wht_thb)}</td><td>{fmtMoney(p.revenue_ex_vat)}</td>
                <td><details className="text-xs"><summary className="cursor-pointer text-red-700">{t("remove")}</summary>
                  <form action={deletePayment}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={`/money/invoices/${id}`} /><button className="btn-danger mt-1 py-1 text-xs">{t("remove")}?</button></form></details></td>
              </tr>))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
