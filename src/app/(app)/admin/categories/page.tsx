import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { saveCategory, saveStage } from "../actions";

export default async function CategoriesAdmin() {
  const { supabase: sb } = await requireAdmin();
  const { t } = await getT();
  const { data: cats } = await sb.from("categories").select("*, stages(*)").order("sort_order");
  return (
    <div className="space-y-4">
      <h1 className="h1">{t("categories")} / {t("stages")}</h1>
      {(cats ?? []).map((c: any) => (
        <Card key={c.id}>
          <form action={saveCategory} className="grid items-end gap-2 sm:grid-cols-6">
            <input type="hidden" name="id" value={c.id} />
            <label><span className="label">ไทย</span><input name="name_th" defaultValue={c.name_th} className="input" /></label>
            <label><span className="label">English</span><input name="name_en" defaultValue={c.name_en} className="input" /></label>
            <label><span className="label">{t("points")}</span><input name="points" type="number" step="0.01" defaultValue={c.points ?? ""} className="input" /></label>
            <label><span className="label">{t("estimatedValue")}</span><input name="estimated_value_thb" type="number" defaultValue={c.estimated_value_thb ?? ""} className="input" /></label>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={c.active} /> {t("active")}</label>
            <button className="btn-ghost">{t("save")}</button>
          </form>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm link">{t("stages")} ({c.stages.length})</summary>
            <div className="mt-2 space-y-1">
              {[...c.stages].sort((a: any, b: any) => a.sort_order - b.sort_order).map((s: any) => (
                <form key={s.id} action={saveStage} className="grid items-center gap-2 sm:grid-cols-6">
                  <input type="hidden" name="id" value={s.id} />
                  <span className="text-xs text-slate-500">{s.sort_order}. {s.level}{s.milestone === "success" ? " ★" : ""}</span>
                  <input name="name_th" defaultValue={s.name_th} className="input py-1" />
                  <input name="name_en" defaultValue={s.name_en} className="input py-1" />
                  <label className="flex items-center gap-1 text-sm">{t("probability")} <input name="probability_pct" type="number" step="0.01" defaultValue={s.probability_pct} className="input w-20 py-1" /></label>
                  <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} /> {t("active")}</label>
                  <button className="btn-ghost py-1">{t("save")}</button>
                </form>
              ))}
            </div>
          </details>
        </Card>
      ))}
    </div>
  );
}
