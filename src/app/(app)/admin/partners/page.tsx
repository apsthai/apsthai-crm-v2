import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { savePartner } from "../actions";

function PartnerForm({ p, schools, t }: { p?: any; schools: any[]; t: (k: string) => string }) {
  return (
    <form action={savePartner} className="grid items-end gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input name="name" defaultValue={p?.name} placeholder={t("name")} className="input lg:col-span-2" required />
      <select name="type" defaultValue={p?.type ?? "sub_agent"} className="input">{["agent", "sub_agent", "individual", "company"].map((x) => <option key={x}>{x}</option>)}</select>
      <input name="default_share_pct" type="number" step="0.01" defaultValue={p?.default_share_pct ?? ""} placeholder={t("defaultShare")} className="input" />
      <select name="school_id" defaultValue={p?.school_id ?? ""} className="input"><option value="">{t("linkedSchool")}: -</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <input name="contact" defaultValue={p?.contact ?? ""} placeholder={t("contact")} className="input" />
      {p && <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> {t("active")}</label>}
      <button className={p ? "btn-ghost" : "btn"}>{p ? t("save") : t("add")}</button>
    </form>
  );
}

export default async function PartnersAdmin() {
  const { supabase: sb } = await requireAdmin();
  const { t } = await getT();
  const [{ data }, { data: schools }] = await Promise.all([
    sb.from("partners").select("*").order("name"),
    sb.from("schools").select("id, name").order("name"),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="h1">{t("partners")}</h1>
      <Card title={t("add")}><PartnerForm schools={schools ?? []} t={t} /></Card>
      <Card><div className="space-y-2">{(data ?? []).map((p: any) => <PartnerForm key={p.id} p={p} schools={schools ?? []} t={t} />)}</div></Card>
    </div>
  );
}
