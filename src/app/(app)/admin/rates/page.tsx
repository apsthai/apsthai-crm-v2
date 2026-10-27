import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { fmtDate, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { addRate } from "../actions";

export default async function RatesAdmin() {
  const { supabase: sb } = await requireAdmin();
  const { t, lang } = await getT();
  const { data } = await sb.from("exchange_rates").select("*").order("as_of", { ascending: false }).limit(60);
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="h1">{t("rates")}</h1>
      <Card>
        <form action={addRate} className="flex flex-wrap items-end gap-2">
          <select name="currency" className="input w-28">{["GBP", "USD", "SGD", "EUR", "AUD"].map((c) => <option key={c}>{c}</option>)}</select>
          <input name="rate_thb" type="number" step="0.0001" placeholder="1 = ? THB" className="input w-36" required />
          <input name="as_of" type="date" defaultValue={todayBangkok()} className="input w-auto" required />
          <button className="btn">{t("save")}</button>
        </form>
      </Card>
      <Card>
        <table className="tbl"><thead><tr><th>{t("currency")}</th><th>THB</th><th>{t("date")}</th></tr></thead>
          <tbody>{(data ?? []).map((r: any) => <tr key={r.id}><td>{r.currency}</td><td>{Number(r.rate_thb)}</td><td>{fmtDate(r.as_of, lang)}</td></tr>)}</tbody></table>
      </Card>
    </div>
  );
}
