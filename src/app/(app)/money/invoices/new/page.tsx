import { Card, Empty, Field } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { addDays, fmtDate, fmtMoney, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { payerKey, remaining } from "@/lib/money";
import { createInvoice } from "../../actions";

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ payer?: string; currency?: string }> }) {
  const { supabase: sb } = await requireAdmin();
  const { t, lang } = await getT();
  const sp = await searchParams;
  const today = todayBangkok();

  const { data: open } = await sb.from("receivables")
    .select("id, type, amount, currency, expected_date, status, payer_type, school_id, partner_id, payer_name, school:schools(name, invoice_contact), partner:partners(name, contact), payment_lines(amount), invoice_lines(invoice:invoices(status)), case:cases(intake, student:students(codename))")
    .in("status", ["expected", "invoiced", "partially_paid"]).order("expected_date");
  // not already on an open invoice
  const free = (open ?? []).filter((r: any) => !(r.invoice_lines ?? []).some((l: any) => l.invoice && l.invoice.status !== "cancelled"));

  const groups = new Map<string, { key: string; currency: string; label: string; rows: any[] }>();
  for (const r of free as any[]) {
    const k = `${payerKey(r)}|${r.currency}`;
    if (!groups.has(k)) groups.set(k, { key: payerKey(r), currency: r.currency, label: `${r.school?.name ?? r.partner?.name ?? r.payer_name} · ${r.currency}`, rows: [] });
    groups.get(k)!.rows.push(r);
  }
  const chosen = sp.payer ? groups.get(`${sp.payer}|${sp.currency}`) : undefined;
  const sample = chosen?.rows[0];

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="h1">{t("newInvoice")}</h1>
      <Card>
        <form className="flex flex-wrap gap-2">
          <select name="pick" className="input max-w-md" defaultValue={chosen ? `${chosen.key}|${chosen.currency}` : ""}>
            <option value="">{t("payer")}</option>
            {[...groups.entries()].map(([k, g]) => <option key={k} value={k}>{g.label} ({g.rows.length})</option>)}
          </select>
          <button className="btn-ghost" formAction="/money/invoices/new/pick">{t("search")}</button>
        </form>
      </Card>
      {chosen && (
        <Card title={chosen.label}>
          <form action={createInvoice} className="space-y-4">
            <input type="hidden" name="payer_key" value={chosen.key} />
            <input type="hidden" name="currency" value={chosen.currency} />
            <p className="label">{t("selectReceivables")}</p>
            <div className="overflow-x-auto"><table className="tbl">
              <tbody>{chosen.rows.map((r: any) => (
                <tr key={r.id}>
                  <td><input type="checkbox" name="receivable_id" value={r.id} defaultChecked /></td>
                  <td>{r.case?.student?.codename ?? "-"}</td><td>{r.case?.intake?.slice(0, 7)}</td><td>{t(r.type)}</td>
                  <td>{fmtDate(r.expected_date, lang)}</td><td>{fmtMoney(remaining(r), r.currency)}</td>
                </tr>))}</tbody>
            </table></div>
            <div className="grid-form">
              <Field label={t("billTo")}><input name="bill_to_name" className="input" required defaultValue={sample?.school?.name ?? sample?.partner?.name ?? sample?.payer_name ?? ""} /></Field>
              <Field label={t("billToAddress")}><textarea name="bill_to_address" className="input" rows={2} defaultValue={sample?.school?.invoice_contact ?? sample?.partner?.contact ?? ""} /></Field>
              <div />
              <Field label={t("date")}><input name="date" type="date" className="input" defaultValue={today} /></Field>
              <Field label={t("dueDate")}><input name="due_date" type="date" className="input" defaultValue={addDays(today, 30)} /></Field>
            </div>
            <button className="btn">{t("create")}</button>
          </form>
        </Card>
      )}
      {groups.size === 0 && <Empty text={t("none")} />}
    </div>
  );
}
