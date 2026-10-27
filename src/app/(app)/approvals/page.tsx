import { A, Card, Empty } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { addDays, fmtDate, fmtMonth, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { decide, revert } from "./actions";

export default async function Approvals() {
  const { supabase: sb } = await requireAdmin();
  const { t, n, lang } = await getT();
  const [{ data: pending }, { data: recent }, { data: staff }] = await Promise.all([
    sb.from("stage_updates")
      .select("id, case_id, date, remark, created_by, stage:stages(name_th, name_en), application:applications(product:products(school:schools(name), partner:partners(name))), case:cases(intake, student:students(codename), category:categories(name_th, name_en, points))")
      .eq("approval", "pending").order("date"),
    sb.from("cases").select("id, intake, closed_date, student:students(codename), category:categories(name_th, name_en)")
      .eq("overall_status", "success").gte("closed_date", addDays(todayBangkok(), -60)).order("closed_date", { ascending: false }),
    sb.from("staff").select("id, codename"),
  ]);
  const who = new Map((staff ?? []).map((s: any) => [s.id, s.codename]));

  return (
    <div className="space-y-4">
      <h1 className="h1">{t("approvals")}</h1>
      <Card title={t("pendingApprovals")}>
        {!pending?.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("student")}</th><th>{t("category")}</th><th>{t("product")}</th><th>{t("stage")}</th><th>{t("date")}</th><th>{t("recordedBy")}</th><th /></tr></thead>
            <tbody>{pending.map((p: any) => (
              <tr key={p.id}>
                <td><A href={`/cases/${p.case_id}`}>{p.case?.student?.codename}</A></td>
                <td>{n(p.case?.category)} · {fmtMonth(p.case?.intake, lang)}</td>
                <td>{p.application?.product?.school?.name ?? p.application?.product?.partner?.name ?? "-"}</td>
                <td>{n(p.stage)}{p.remark ? <span className="block text-xs text-slate-500">{p.remark}</span> : null}</td>
                <td>{fmtDate(p.date, lang)}</td>
                <td>{who.get(p.created_by)}</td>
                <td>
                  <form action={decide} className="flex gap-1">
                    <input type="hidden" name="id" value={p.id} />
                    <button name="approve" value="true" className="btn py-1">{t("approve")}</button>
                    <button name="approve" value="false" className="btn-danger py-1">{t("reject")}</button>
                  </form>
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      <Card title={`${t("success")} (${t("last60")})`}>
        <p className="muted mb-2">{t("revertHint")}</p>
        {!recent?.length ? <Empty text={t("none")} /> : (
          <ul className="space-y-1 text-sm">{recent.map((c: any) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <A href={`/cases/${c.id}`}>{c.student?.codename}</A> · {n(c.category)} · {fmtDate(c.closed_date, lang)}
              <details className="text-xs"><summary className="cursor-pointer text-red-700">{t("revert")}</summary>
                <form action={revert} className="mt-1"><input type="hidden" name="case_id" value={c.id} /><button className="btn-danger py-1 text-xs">{t("revert")}?</button></form></details>
            </li>))}</ul>
        )}
      </Card>
    </div>
  );
}
