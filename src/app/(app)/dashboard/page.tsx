import { Card, Empty } from "@/components/ui";
import { getMe } from "@/lib/auth";
import { cycleOf, fmtMoney, fmtMonth, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const me = await getMe();
  const sb = me.supabase;
  const isAdmin = me.role === "admin";
  const { t, n, lang } = await getT();
  const today = todayBangkok();
  const cycle = (await searchParams).cycle ?? cycleOf(today);
  const y = Number(cycle.slice(0, 4));
  const from = `${y}-09-01`, to = `${y + 1}-08-31`;
  const cycles = [-2, -1, 0, 1].map((k) => cycleOf(`${Number(cycleOf(today).slice(0, 4)) + k}-10-01`));

  const [{ data: cases }, { data: points }, { data: staff }, { data: cats }, { data: channels }, cash] = await Promise.all([
    sb.from("cases").select("id, category_id, overall_status, lead_channel_id").gte("intake", from).lte("intake", to).limit(5000),
    sb.from("points_ledger").select("staff_id, points, case_id").gte("date", from).lte("date", to),
    sb.from("staff").select("id, codename, handles_cases").eq("active", true).order("codename"),
    sb.from("categories").select("id, name_th, name_en, sort_order").order("sort_order"),
    sb.from("lead_channels").select("id, name_th, name_en").order("sort_order"),
    isAdmin ? sb.from("v_cashflow").select("month, kind, amount_thb, missing_rate").gte("month", today.slice(0, 7) + "-01").order("month") : Promise.resolve({ data: [] as any[] }),
  ]);
  const ids = (cases ?? []).map((c: any) => c.id);
  const { data: prog } = ids.length ? await sb.from("v_case_progress").select("case_id, furthest_stage_th, furthest_stage_en").in("case_id", ids) : { data: [] };
  const stageOf = new Map((prog ?? []).map((p: any) => [p.case_id, lang === "en" ? p.furthest_stage_en : p.furthest_stage_th]));

  // funnel per category
  const funnel = (cats ?? []).map((c: any) => {
    const list = (cases ?? []).filter((x: any) => x.category_id === c.id);
    const open = list.filter((x: any) => ["not_started", "in_progress"].includes(x.overall_status));
    const byStage = new Map<string, number>();
    open.forEach((x: any) => { const s = stageOf.get(x.id) ?? "-"; byStage.set(s, (byStage.get(s) ?? 0) + 1); });
    const success = list.filter((x: any) => x.overall_status === "success").length;
    const fail = list.filter((x: any) => x.overall_status === "fail").length;
    return { c, total: list.length, open: open.length, success, fail, byStage };
  }).filter((f) => f.total > 0);

  const team = (staff ?? []).filter((s: any) => s.handles_cases).map((s: any) => {
    const mine = (points ?? []).filter((p: any) => p.staff_id === s.id);
    return { s, points: mine.reduce((a: number, p: any) => a + Number(p.points), 0), cases: new Set(mine.map((p: any) => p.case_id)).size };
  }).sort((a, b) => b.points - a.points);

  const leads = (channels ?? []).map((ch: any) => ({ ch, count: (cases ?? []).filter((x: any) => x.lead_channel_id === ch.id).length })).filter((l) => l.count > 0);

  const months = new Map<string, { confirmed: number; weighted: number }>();
  let missing = false;
  for (const r of (cash.data ?? []) as any[]) {
    const m = months.get(r.month) ?? { confirmed: 0, weighted: 0 };
    m[r.kind as "confirmed" | "weighted"] += Number(r.amount_thb);
    months.set(r.month, m);
    if (r.missing_rate) missing = true;
  }
  const monthRows = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 18);
  const maxM = Math.max(1, ...monthRows.map(([, v]) => v.confirmed + v.weighted));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">{t("dashboard")}</h1>
        <form className="flex gap-2">
          <select name="cycle" defaultValue={cycle} className="input w-32">{cycles.map((c) => <option key={c}>{c}</option>)}</select>
          <button className="btn-ghost">{t("fiscalYear")}</button>
        </form>
      </div>

      <Card title={`${t("funnel")} ${cycle}`}>
        {!funnel.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("category")}</th><th>{t("total")}</th><th>{t("in_progress")}</th><th>{t("success")}</th><th>{t("fail")}</th><th>{t("stage")}</th></tr></thead>
            <tbody>{funnel.map((f) => (
              <tr key={f.c.id}>
                <td>{n(f.c)}</td><td>{f.total}</td><td>{f.open}</td><td className="text-emerald-700">{f.success}</td><td className="text-red-700">{f.fail}</td>
                <td className="text-xs">{[...f.byStage.entries()].map(([s, k]) => `${s}: ${k}`).join(" · ")}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`${t("team")} ${cycle}`}>
          <table className="tbl">
            <thead><tr><th>{t("staff")}</th><th>{t("points")}</th><th>{t("enrolledCount")}</th></tr></thead>
            <tbody>{team.map((r) => (
              <tr key={r.s.id} className={r.s.id === me.id ? "bg-sky-50" : ""}><td>{r.s.codename}</td><td>{Math.round(r.points * 100) / 100}</td><td>{r.cases}</td></tr>
            ))}</tbody>
          </table>
        </Card>
        <Card title={`${t("leadChannel")} ${cycle}`}>
          {!leads.length ? <Empty text={t("none")} /> : (
            <ul className="space-y-1 text-sm">{leads.sort((a, b) => b.count - a.count).map((l) => <li key={l.ch.id} className="flex justify-between"><span>{n(l.ch)}</span><span>{l.count}</span></li>)}</ul>
          )}
        </Card>
      </div>

      {isAdmin && (
        <Card title={t("cashflow")}>
          {missing && <p className="mb-2 text-sm text-amber-700">{t("missingRate")}</p>}
          {!monthRows.length ? <Empty text={t("none")} /> : (
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th>{t("month")}</th><th>{t("confirmed")}</th><th>{t("weighted")}</th><th className="w-1/2" /></tr></thead>
              <tbody>{monthRows.map(([m, v]) => (
                <tr key={m}>
                  <td>{fmtMonth(m, lang)}</td><td>{fmtMoney(Math.round(v.confirmed))}</td><td className="text-slate-500">{fmtMoney(Math.round(v.weighted))}</td>
                  <td><div className="flex h-3 overflow-hidden rounded bg-slate-100">
                    <div className="bg-sky-700" style={{ width: `${(v.confirmed / maxM) * 100}%` }} />
                    <div className="bg-sky-300" style={{ width: `${(v.weighted / maxM) * 100}%` }} />
                  </div></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </div>
  );
}
