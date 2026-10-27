import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { CURRENCIES } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { saveSchool } from "../actions";

const TYPES = ["boarding_school", "university", "summer_provider", "thai_school", "in_house", "other"];

function SchoolForm({ s, t }: { s?: any; t: (k: string) => string }) {
  return (
    <form action={saveSchool} className="grid items-end gap-2 sm:grid-cols-4 lg:grid-cols-9">
      {s && <input type="hidden" name="id" value={s.id} />}
      <input name="name" defaultValue={s?.name} placeholder={t("name")} className="input lg:col-span-2" required />
      <input name="country" defaultValue={s?.country ?? "UK"} placeholder={t("country")} className="input" required />
      <select name="type" defaultValue={s?.type ?? "boarding_school"} className="input">{TYPES.map((x) => <option key={x}>{x}</option>)}</select>
      <select name="default_currency" defaultValue={s?.default_currency ?? "GBP"} className="input">{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select>
      <input name="invoice_contact" defaultValue={s?.invoice_contact ?? ""} placeholder={t("invoiceContact")} className="input" />
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="is_partner" defaultChecked={s?.is_partner} /> {t("isPartner")}</label>
      {s && <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} /> {t("active")}</label>}
      <button className={s ? "btn-ghost" : "btn"}>{s ? t("save") : t("add")}</button>
    </form>
  );
}

export default async function SchoolsAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase: sb } = await requireAdmin();
  const { t } = await getT();
  const q = ((await searchParams).q ?? "").trim();
  let query = sb.from("schools").select("*").order("name").limit(300);
  if (q) query = query.ilike("name", `%${q.replace(/[%,()]/g, " ")}%`);
  const { data } = await query;
  return (
    <div className="space-y-4">
      <h1 className="h1">{t("schools")}</h1>
      <Card title={t("add")}><SchoolForm t={t} /></Card>
      <form className="flex gap-2"><input name="q" defaultValue={q} className="input max-w-sm" placeholder={t("search")} /><button className="btn-ghost">{t("search")}</button></form>
      <Card><div className="space-y-2">{(data ?? []).map((s: any) => <SchoolForm key={s.id} s={s} t={t} />)}</div></Card>
    </div>
  );
}
