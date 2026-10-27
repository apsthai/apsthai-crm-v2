import { Card, Empty, Field } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { fmtDate, fmtMoney, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { remaining } from "@/lib/money";
import { recordPayment } from "../../actions";

export default async function NewPayment() {
  const { supabase: sb } = await requireAdmin();
  const { t, lang } = await getT();
  const { data: open } = await sb.from("receivables")
    .select("id, type, amount, currency, expected_date, school:schools(name), partner:partners(name), payer_name, payment_lines(amount), case:cases(student:students(codename), category:categories(name_th, name_en))")
    .in("status", ["expected", "invoiced", "partially_paid"]).order("expected_date").limit(300);

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="h1">{t("recordPayment")}</h1>
      <Card>
        <form action={recordPayment} className="space-y-3">
          <div className="grid-form">
            <Field label={t("receivedDate")}><input name="received_date" type="date" className="input" defaultValue={todayBangkok()} /></Field>
            <Field label={t("receivedThb")}><input name="received_thb" type="number" step="0.01" className="input" required /></Field>
            <Field label={t("wht")}><input name="wht_thb" type="number" step="0.01" className="input" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includes_vat" defaultChecked /> {t("includesVat")}</label>
            <Field label={t("vat")} hint="ว่าง = คำนวณ 7/107 ให้"><input name="vat_thb" type="number" step="0.01" className="input" /></Field>
          </div>
          <p className="label">{t("payFor")}</p>
          {!open?.length ? <Empty text={t("none")} /> : (
            <div className="overflow-x-auto"><table className="tbl">
              <tbody>{open.map((r: any) => (
                <tr key={r.id}>
                  <td><input type="hidden" name="line_receivable" value={r.id} />
                    <input name="line_amount" type="number" step="0.01" className="input w-32 py-1" placeholder={String(remaining(r))} /></td>
                  <td>{r.currency}</td>
                  <td>{r.case?.student?.codename ?? "-"}</td>
                  <td>{r.school?.name ?? r.partner?.name ?? r.payer_name}</td>
                  <td>{t(r.type)}</td>
                  <td>{fmtMoney(remaining(r), r.currency)}</td>
                  <td>{fmtDate(r.expected_date, lang)}</td>
                </tr>))}</tbody>
            </table></div>
          )}
          <button className="btn">{t("recordPayment")}</button>
        </form>
      </Card>
    </div>
  );
}
