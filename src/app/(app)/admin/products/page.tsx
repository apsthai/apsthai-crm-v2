import Link from "next/link";
import { Card } from "@/components/ui";
import { NamedSelect } from "@/components/pickers";
import { requireAdmin } from "@/lib/auth";
import { CURRENCIES, fmtMoney } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { addProduct, addTerm, removeTerm, updateProduct } from "../actions";

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<{ open?: string; category?: string }> }) {
  const { supabase: sb } = await requireAdmin();
  const { t, n, lang } = await getT();
  const sp = await searchParams;
  const [{ data: products }, { data: cats }, { data: schools }, { data: partners }, { data: stages }] = await Promise.all([
    (() => {
      let q = sb.from("products").select("id, active, contract_location, category_id, school:schools(name), partner:partners(name), category:categories(name_th, name_en), income_terms(*)").order("created_at");
      if (sp.category) q = q.eq("category_id", sp.category);
      return q;
    })(),
    sb.from("categories").select("id, name_th, name_en").order("sort_order"),
    sb.from("schools").select("id, name").eq("active", true).order("name"),
    sb.from("partners").select("id, name").eq("active", true).order("name"),
    sb.from("stages").select("id, category_id, name_th, name_en, sort_order").order("sort_order"),
  ]);
  const stageName = new Map((stages ?? []).map((s: any) => [s.id, n(s)]));
  const list = ((products ?? []) as any[]).sort((a, b) => (a.school?.name ?? a.partner?.name ?? "").localeCompare(b.school?.name ?? b.partner?.name ?? ""));

  return (
    <div className="space-y-4">
      <h1 className="h1">{t("products")}</h1>
      <Card title={t("addProduct")}>
        <form action={addProduct} className="grid items-end gap-2 sm:grid-cols-4">
          <select name="provider" className="input" required>
            <option value="">{t("product")}</option>
            <optgroup label={t("schools")}>{(schools ?? []).map((s: any) => <option key={s.id} value={`school|${s.id}`}>{s.name}</option>)}</optgroup>
            <optgroup label={t("partners")}>{(partners ?? []).map((p: any) => <option key={p.id} value={`partner|${p.id}`}>{p.name}</option>)}</optgroup>
          </select>
          <NamedSelect name="category_id" items={(cats ?? []) as any} lang={lang} required placeholder={t("category")} />
          <input name="contract_location" placeholder="Contract" className="input" />
          <button className="btn">{t("add")}</button>
        </form>
      </Card>
      <form className="flex gap-2">
        <div className="w-60"><NamedSelect name="category" items={(cats ?? []) as any} value={sp.category} lang={lang} placeholder={t("all")} /></div>
        <button className="btn-ghost">{t("search")}</button>
      </form>
      <Card>
        <div className="space-y-2">
          {list.map((p) => {
            const open = sp.open === p.id;
            const terms = ((p.income_terms ?? []) as any[]).sort((a, b) => a.seq - b.seq);
            const catStages = (stages ?? []).filter((s: any) => s.category_id === p.category_id);
            return (
              <div key={p.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={open ? "/admin/products" : `/admin/products?open=${p.id}`} className="font-medium link">
                    {p.school?.name ?? p.partner?.name} · {n(p.category)}{!p.active ? " (off)" : ""}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {terms.map((x) => `${x.seq}. ${t(x.type)} ${x.rate_pct !== null ? `${Number(x.rate_pct)}%` : fmtMoney(x.amount, x.currency ?? "THB")}`).join(" · ") || t("none")}
                  </span>
                </div>
                {open && (
                  <div className="mt-3 space-y-3">
                    <form action={updateProduct} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="contract_location" defaultValue={p.contract_location ?? ""} placeholder="Contract" className="input w-64" />
                      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> {t("active")}</label>
                      <button className="btn-ghost">{t("save")}</button>
                    </form>
                    <table className="tbl">
                      <thead><tr><th>{t("seq")}</th><th>{t("type")}</th><th>{t("payerType")}</th><th>{t("trigger")}</th><th>{t("repeat")}</th><th>{t("rate")}</th><th /></tr></thead>
                      <tbody>{terms.map((x) => (
                        <tr key={x.id}>
                          <td>{x.seq}</td><td>{t(x.type)}</td><td>{t(x.payer_type)}</td>
                          <td>{x.trigger_stage_id ? stageName.get(x.trigger_stage_id) : `+${x.year_offset} yr`}</td>
                          <td>{t(x.repeat)}</td>
                          <td>{x.rate_pct !== null ? `${Number(x.rate_pct)}%` : fmtMoney(x.amount, x.currency ?? "THB")}</td>
                          <td><form action={removeTerm}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="product_id" value={p.id} /><button className="text-xs text-red-700 hover:underline">{t("remove")}</button></form></td>
                        </tr>))}</tbody>
                    </table>
                    <form action={addTerm} className="grid items-end gap-2 sm:grid-cols-4 lg:grid-cols-9">
                      <input type="hidden" name="product_id" value={p.id} />
                      <label><span className="label">{t("type")}</span><select name="type" className="input"><option value="commission">{t("commission")}</option><option value="service_fee">{t("service_fee")}</option></select></label>
                      <label><span className="label">{t("payerType")}</span><select name="payer_type" className="input"><option value="school">{t("school")}</option><option value="partner">{t("partner")}</option><option value="individual">{t("individual")}</option></select></label>
                      <label><span className="label">{t("partner")}</span><select name="payer_partner_id" className="input"><option value="">-</option>{(partners ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                      <label><span className="label">{t("trigger")}</span><select name="trigger_stage_id" className="input"><option value="">-</option>{catStages.map((s: any) => <option key={s.id} value={s.id}>{n(s)}</option>)}</select></label>
                      <label><span className="label">{t("yearOffset")}</span><input name="year_offset" type="number" min="1" className="input" /></label>
                      <label><span className="label">{t("repeat")}</span><select name="repeat" className="input"><option value="once">{t("once")}</option><option value="yearly">{t("yearly")}</option><option value="termly">{t("termly")}</option></select></label>
                      <label><span className="label">{t("rate")}</span><input name="rate_pct" type="number" step="0.001" className="input" /></label>
                      <label><span className="label">{t("fixedAmount")}</span><input name="amount" type="number" step="0.01" className="input" /></label>
                      <label><span className="label">{t("currency")}</span><select name="currency" className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                      <button className="btn-ghost">{t("addTerm")}</button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
