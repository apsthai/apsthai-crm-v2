import Link from "next/link";
import { A, Card, Empty, Pill } from "@/components/ui";
import { NamedSelect } from "@/components/pickers";
import { getMe } from "@/lib/auth";
import { fmtDate, fmtMonth } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { loadLookups } from "@/lib/lookups";

export default async function Cases({ searchParams }: { searchParams: Promise<{ category?: string; status?: string; staff?: string; from?: string }> }) {
  const me = await getMe();
  const sb = me.supabase;
  const { t, n, lang } = await getT();
  const sp = await searchParams;
  const lk = await loadLookups(sb);
  const status = sp.status ?? "open";
  const staffFilter = sp.staff ?? (me.handles_cases ? me.id : "");

  let ids: string[] | null = null;
  if (staffFilter) {
    const { data: mine } = await sb.from("case_staff").select("case_id").eq("staff_id", staffFilter).is("end_date", null);
    ids = [...new Set((mine ?? []).map((m: any) => m.case_id as string))];
  }
  let q = sb.from("cases")
    .select("id, intake, overall_status, next_action, next_action_date, student:students(codename), category:categories(name_th, name_en), case_staff(end_date, staff(codename))")
    .order("intake", { ascending: true }).limit(300);
  if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (sp.category) q = q.eq("category_id", sp.category);
  if (status === "open") q = q.in("overall_status", ["not_started", "in_progress"]);
  else if (status !== "all") q = q.eq("overall_status", status);
  if (sp.from) q = q.gte("intake", `${sp.from}-01`);
  const { data, error } = await q;
  const rows = (data ?? []) as any[];
  const { data: prog } = rows.length
    ? await sb.from("v_case_progress").select("case_id, furthest_stage_th, furthest_stage_en, probability_pct").in("case_id", rows.map((r) => r.id))
    : { data: [] };
  const progress = new Map((prog ?? []).map((p: any) => [p.case_id, p]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">{t("cases")}</h1>
        <Link href="/cases/new" className="btn">{t("newCase")}</Link>
      </div>
      <form className="flex flex-wrap gap-2">
        <div className="w-48"><NamedSelect name="category" items={lk.categories} value={sp.category} lang={lang} placeholder={t("all")} /></div>
        <select name="status" defaultValue={status} className="input w-40">
          <option value="open">{t("in_progress")}</option><option value="success">{t("success")}</option>
          <option value="fail">{t("fail")}</option><option value="all">{t("all")}</option>
        </select>
        <select name="staff" defaultValue={staffFilter} className="input w-36">
          <option value="">{t("all")}</option>{lk.staff.filter((s) => s.handles_cases).map((s) => <option key={s.id} value={s.id}>{s.codename}</option>)}
        </select>
        <input type="month" name="from" defaultValue={sp.from} className="input w-40" title={t("intake")} />
        <button className="btn-ghost">{t("search")}</button>
      </form>
      <Card>
        {error && <p className="text-sm text-red-700">{error.message}</p>}
        {rows.length === 0 ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("student")}</th><th>{t("category")}</th><th>{t("intake")}</th><th>{t("stage")}</th><th>{t("staff")}</th><th>{t("nextAction")}</th><th>{t("status")}</th></tr></thead>
            <tbody>{rows.map((c) => {
              const p: any = progress.get(c.id);
              return (
                <tr key={c.id}>
                  <td><A href={`/cases/${c.id}`}>{c.student?.codename}</A></td>
                  <td>{n(c.category)}</td>
                  <td>{fmtMonth(c.intake, lang)}</td>
                  <td>{p ? `${lang === "en" ? p.furthest_stage_en ?? "-" : p.furthest_stage_th ?? "-"} (${Number(p.probability_pct)}%)` : "-"}</td>
                  <td>{(c.case_staff ?? []).filter((x: any) => !x.end_date && x.staff).map((x: any) => x.staff.codename).join(", ")}</td>
                  <td className="text-xs">{c.next_action}{c.next_action_date ? ` · ${fmtDate(c.next_action_date, lang)}` : ""}</td>
                  <td><Pill status={c.overall_status} label={t(c.overall_status)} /></td>
                </tr>);
            })}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
