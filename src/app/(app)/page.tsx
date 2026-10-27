import { A, Card, Empty, Pill } from "@/components/ui";
import { currentAcademicYear } from "@/components/pickers";
import { getMe } from "@/lib/auth";
import { addDays, fmtDate, fmtMoney, fmtMonth, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";

export default async function MyWork() {
  const me = await getMe();
  const sb = me.supabase;
  const { t, n, lang } = await getT();
  const today = todayBangkok();
  const isAdmin = me.role === "admin";

  const { data: mine } = await sb.from("case_staff").select("case_id").eq("staff_id", me.id).is("end_date", null);
  const ids = (mine ?? []).map((m: any) => m.case_id);
  const none = ["00000000-0000-0000-0000-000000000000"];

  const [{ data: cases }, { data: recs }, { data: pending }] = await Promise.all([
    sb.from("cases").select("id, intake, next_action, next_action_date, overall_status, student:students(codename), category:categories(name_th, name_en)")
      .in("id", ids.length ? ids : none).in("overall_status", ["not_started", "in_progress"])
      .order("next_action_date", { ascending: true, nullsFirst: false }).limit(200),
    (() => {
      let rq = sb.from("receivables").select("id, type, amount, currency, expected_date, status, case_id, school:schools(name), partner:partners(name), payer_name, case:cases(student:students(codename))")
        .in("status", ["expected", "invoiced", "partially_paid"]).lte("expected_date", addDays(today, 60));
      if (!isAdmin) rq = rq.in("case_id", ids.length ? ids : none);
      return rq.order("expected_date").limit(100);
    })(),
    isAdmin
      ? sb.from("stage_updates").select("id, case_id, date, case:cases(student:students(codename), category:categories(name_th, name_en))").eq("approval", "pending").order("date")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const soon = (cases ?? []).filter((c: any) => c.next_action_date && c.next_action_date <= addDays(today, 7));

  let needLevel: any[] = [];
  if (isAdmin) {
    const ay = currentAcademicYear(today);
    const prevStart = Number(ay.slice(0, 4)) - 1;
    const prev = `${prevStart}/${String((prevStart + 1) % 100).padStart(2, "0")}`;
    const [{ data: lastYear }, { data: thisYear }] = await Promise.all([
      sb.from("education").select("student_id, student:students(id, codename, anonymized_at, merged_into), level:levels(is_final, next_level_id)").eq("academic_year", prev),
      sb.from("education").select("student_id").eq("academic_year", ay),
    ]);
    const has = new Set((thisYear ?? []).map((e: any) => e.student_id));
    const seen = new Set<string>();
    needLevel = (lastYear ?? []).filter((e: any) => {
      if (has.has(e.student_id) || seen.has(e.student_id) || !e.level || e.level.is_final || e.student?.anonymized_at || e.student?.merged_into) return false;
      seen.add(e.student_id);
      return true;
    }).slice(0, 50);
  }

  return (
    <div className="space-y-4">
      <h1 className="h1">{t("myWork")}</h1>
      {isAdmin && (pending ?? []).length > 0 && (
        <Card title={`${t("pendingApprovals")} (${pending!.length})`} right={<A href="/approvals">{t("approvals")}</A>}>
          <ul className="space-y-1 text-sm">{pending!.slice(0, 10).map((p: any) => (
            <li key={p.id}><A href={`/cases/${p.case_id}`}>{p.case?.student?.codename}</A> · {n(p.case?.category)} · {fmtDate(p.date, lang)}</li>
          ))}</ul>
        </Card>
      )}

      <Card title={t("dueSoon")}>
        {soon.length === 0 ? <Empty text={t("none")} /> : (
          <ul className="space-y-1 text-sm">{soon.map((c: any) => (
            <li key={c.id} className={c.next_action_date < today ? "text-red-700" : ""}>
              {fmtDate(c.next_action_date, lang)} · <A href={`/cases/${c.id}`}>{c.student?.codename}</A> · {n(c.category)} · {c.next_action}
            </li>))}</ul>
        )}
      </Card>

      <Card title={`${t("myOpenCases")} (${cases?.length ?? 0})`}>
        {!cases?.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("student")}</th><th>{t("category")}</th><th>{t("intake")}</th><th>{t("nextAction")}</th><th>{t("status")}</th></tr></thead>
            <tbody>{cases.map((c: any) => (
              <tr key={c.id}>
                <td><A href={`/cases/${c.id}`}>{c.student?.codename}</A></td><td>{n(c.category)}</td><td>{fmtMonth(c.intake, lang)}</td>
                <td className="text-xs">{c.next_action}{c.next_action_date ? ` · ${fmtDate(c.next_action_date, lang)}` : ""}</td>
                <td><Pill status={c.overall_status} label={t(c.overall_status)} /></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>

      <Card title={t("moneyComing")}>
        {!recs?.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("expectedDate")}</th><th>{t("student")}</th><th>{t("payer")}</th><th>{t("type")}</th><th>{t("amount")}</th><th>{t("status")}</th></tr></thead>
            <tbody>{recs.map((r: any) => (
              <tr key={r.id} className={r.expected_date < today ? "text-red-700" : ""}>
                <td>{fmtDate(r.expected_date, lang)}</td>
                <td>{r.case_id ? <A href={`/cases/${r.case_id}`}>{r.case?.student?.codename}</A> : "-"}</td>
                <td>{r.school?.name ?? r.partner?.name ?? r.payer_name}</td><td>{t(r.type)}</td>
                <td>{fmtMoney(r.amount, r.currency)}</td><td><Pill status={r.status} label={t(r.status)} /></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>

      {isAdmin && needLevel.length > 0 && (
        <Card title={t("needLevel")}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{needLevel.map((e: any) => <li key={e.student_id}><A href={`/students/${e.student_id}`}>{e.student?.codename}</A></li>)}</ul>
        </Card>
      )}
    </div>
  );
}
