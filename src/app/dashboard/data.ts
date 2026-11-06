import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, daysBetween, fmtMonth, monthStart } from "@/lib/dates";
import { toTHB } from "@/lib/money";

type Cycle = { start: string; end: string; label: string };
const ACTIVE = ["not_started", "in_progress"];
const OPEN_RECEIVABLE = ["expected", "invoiced", "partially_paid"];

export type TaskRow = {
  id: string; title: string; due: string; lateDays: number;
  caseId: string; student: string; service: string; stage: string;
};

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
}

async function stagesFor(sb: SupabaseClient, caseIds: string[]) {
  if (!caseIds.length) return new Map<string, string>();
  const { data, error } = await sb.from("v_case_progress").select("case_id, furthest_stage_en").in("case_id", caseIds);
  fail("case stages", error);
  return new Map((data ?? []).map((r) => [r.case_id as string, (r.furthest_stage_en as string) ?? "Not started"]));
}

// Open tasks of one person that are overdue or due within the next 7 days.
export async function loadTasks(sb: SupabaseClient, staffId: string, today: string) {
  const { data, error } = await sb.from("tasks")
    .select("id, title, due_date, case:cases(id, intake, student:students(codename), category:categories(name_en))")
    .eq("assigned_to", staffId).is("done_at", null).lte("due_date", addDays(today, 7)).order("due_date");
  fail("tasks", error);
  const rows = (data ?? []) as unknown as {
    id: string; title: string; due_date: string;
    case: { id: string; intake: string; student: { codename: string }; category: { name_en: string } };
  }[];
  const stage = await stagesFor(sb, [...new Set(rows.map((r) => r.case.id))]);
  const all: TaskRow[] = rows.map((r) => ({
    id: r.id, title: r.title, due: r.due_date, lateDays: daysBetween(r.due_date, today),
    caseId: r.case.id, student: r.case.student.codename,
    service: `${r.case.category.name_en} · ${fmtMonth(r.case.intake)}`, stage: stage.get(r.case.id) ?? "Not started",
  }));
  return {
    now: all.filter((t) => t.due <= today),
    overdue: all.filter((t) => t.due < today).length,
    dueToday: all.filter((t) => t.due === today).length,
    later: all.filter((t) => t.due > today).length,
  };
}

// Everything the personal part of the dashboard needs.
export async function loadMine(sb: SupabaseClient, staffId: string, today: string, cycle: Cycle) {
  const [tasks, cs, pts, kpi, team] = await Promise.all([
    loadTasks(sb, staffId, today),
    sb.from("case_staff").select("case_id, case:cases(id, overall_status, category_id)").eq("staff_id", staffId).is("end_date", null),
    sb.from("points_ledger").select("points, case:cases(category:categories(name_en))")
      .eq("staff_id", staffId).gte("date", cycle.start).lte("date", cycle.end),
    sb.from("kpi_targets").select("points").eq("staff_id", staffId).eq("cycle_start", cycle.start).maybeSingle(),
    sb.rpc("team_points", { p_from: cycle.start, p_to: cycle.end }),
  ]);
  fail("my cases", cs.error); fail("my points", pts.error); fail("KPI", kpi.error); fail("team points", team.error);

  const myCases = ((cs.data ?? []) as unknown as { case: { id: string; overall_status: string; category_id: string } }[])
    .map((r) => r.case).filter((c) => ACTIVE.includes(c.overall_status));
  const ids = myCases.map((c) => c.id);
  const stage = await stagesFor(sb, ids);
  const byStage = new Map<string, number>();
  for (const id of ids) { const s = stage.get(id) ?? "Not started"; byStage.set(s, (byStage.get(s) ?? 0) + 1); }

  const byService = new Map<string, number>();
  let points = 0;
  for (const p of (pts.data ?? []) as unknown as { points: number; case: { category: { name_en: string } } }[]) {
    const v = Number(p.points); points += v;
    byService.set(p.case.category.name_en, (byService.get(p.case.category.name_en) ?? 0) + v);
  }

  const { data: waiting, error: wErr } = ids.length
    ? await sb.from("stage_updates").select("id, date, case:cases(id, intake, student:students(codename), category:categories(name_en))")
      .eq("approval", "pending").in("case_id", ids).order("date")
    : { data: [], error: null };
  fail("approvals", wErr);

  return {
    tasks,
    activeCases: ids.length,
    services: new Set(myCases.map((c) => c.category_id)).size,
    stages: [...byStage.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    points,
    pointsByService: [...byService.entries()].map(([name, pts]) => ({ name, pts })).sort((a, b) => b.pts - a.pts),
    kpi: kpi.data ? Number(kpi.data.points) : null,
    teamPoints: Number(team.data ?? 0),
    waiting: (waiting ?? []) as unknown as { id: string; date: string; case: { id: string; intake: string; student: { codename: string }; category: { name_en: string } } }[],
  };
}

// Company direction without money: for every staff member.
export async function loadCompany(sb: SupabaseClient, cycle: Cycle) {
  const [won, active] = await Promise.all([
    sb.from("cases").select("id", { count: "exact", head: true }).eq("overall_status", "success")
      .gte("closed_date", cycle.start).lte("closed_date", cycle.end),
    sb.from("cases").select("id", { count: "exact", head: true }).in("overall_status", ACTIVE),
  ]);
  fail("successful cases", won.error); fail("active cases", active.error);
  return { successful: won.count ?? 0, active: active.count ?? 0 };
}

// Admin only: money, forecast, pipeline and the team. RLS returns nothing to anyone else.
export async function loadAdmin(sb: SupabaseClient, today: string, cycle: Cycle) {
  const [rates, recv, pays, weighted, cats, payouts, pending, cases, openTasks, staff, links, pts, kpis] = await Promise.all([
    sb.from("v_latest_rate").select("currency, rate_thb"),
    sb.from("receivables").select("amount, currency, expected_date, payment_lines(amount)").in("status", OPEN_RECEIVABLE),
    sb.from("payments").select("received_date, revenue_ex_vat").gte("received_date", cycle.start).lte("received_date", cycle.end),
    sb.from("v_cashflow").select("month, category_id, amount_thb, case_id, missing_rate").eq("kind", "weighted"),
    sb.from("categories").select("id, name_en, sort_order"),
    sb.from("payouts").select("pay_date, total, status").in("status", ["draft", "reviewed"]).order("pay_date"),
    sb.from("stage_updates").select("id, case:cases(category:categories(name_en))").eq("approval", "pending"),
    sb.from("cases").select("id, overall_status, closed_date"),
    sb.from("tasks").select("case_id, assigned_to, due_date").is("done_at", null),
    sb.from("staff").select("id, codename, employment").eq("active", true).eq("handles_cases", true).order("codename"),
    sb.from("case_staff").select("case_id, staff_id, end_date"),
    sb.from("points_ledger").select("staff_id, points").gte("date", cycle.start).lte("date", cycle.end),
    sb.from("kpi_targets").select("staff_id, points").eq("cycle_start", cycle.start),
  ]);
  for (const [n, r] of Object.entries({ rates, recv, pays, weighted, cats, payouts, pending, cases, openTasks, staff, links, pts, kpis })) fail(n, r.error);

  const rate = new Map((rates.data ?? []).map((r) => [r.currency as string, Number(r.rate_thb)]));
  let missingRate = false;

  // Money still owed to us, in THB, net of part payments.
  const owed = ((recv.data ?? []) as { amount: number; currency: string; expected_date: string; payment_lines: { amount: number }[] }[])
    .map((r) => {
      const left = Number(r.amount) - r.payment_lines.reduce((a, p) => a + Number(p.amount), 0);
      const { thb, missing } = toTHB(left, r.currency, rate);
      if (missing) missingRate = true;
      return { thb, due: r.expected_date };
    }).filter((r) => r.thb !== 0);
  const overdue = owed.filter((r) => r.due < today);
  const next60 = owed.filter((r) => r.due >= today && r.due <= addDays(today, 60));
  const owedInCycle = owed.filter((r) => r.due <= cycle.end).reduce((a, r) => a + r.thb, 0);

  const received = (pays.data ?? []) as { received_date: string; revenue_ex_vat: number }[];
  const thisMonth = monthStart(today);

  const w = (weighted.data ?? []) as { month: string; category_id: string; amount_thb: number; case_id: string; missing_rate: boolean }[];
  if (w.some((r) => r.missing_rate)) missingRate = true;
  const weightedInCycle = w.filter((r) => r.month <= cycle.end).reduce((a, r) => a + Number(r.amount_thb), 0);

  // Six months from this month: confirmed (owed) and pipeline x probability.
  const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth, i));
  const forecast = months.map((m) => {
    const next = addMonths(m, 1);
    const confirmed = owed.filter((r) => r.due >= m && r.due < next).reduce((a, r) => a + r.thb, 0);
    const pipeline = w.filter((r) => r.month >= m && r.month < next).reduce((a, r) => a + Number(r.amount_thb), 0);
    return { month: m, confirmed, pipeline };
  });

  const catName = new Map((cats.data ?? []).map((c) => [c.id as string, c.name_en as string]));
  const pipeByCat = new Map<string, { cases: Set<string>; thb: number }>();
  for (const r of w) {
    const g = pipeByCat.get(r.category_id) ?? { cases: new Set<string>(), thb: 0 };
    g.cases.add(r.case_id); g.thb += Number(r.amount_thb); pipeByCat.set(r.category_id, g);
  }
  const pipeline = [...pipeByCat.entries()]
    .map(([id, g]) => ({ name: catName.get(id) ?? "Other", cases: g.cases.size, thb: g.thb }))
    .sort((a, b) => b.thb - a.thb);

  // Payout round: the earliest pay date that is not paid yet.
  const openPayouts = (payouts.data ?? []) as { pay_date: string; total: number; status: string }[];
  const nextPay = openPayouts[0]?.pay_date;
  const round = nextPay ? openPayouts.filter((p) => p.pay_date === nextPay) : [];

  const allCases = (cases.data ?? []) as { id: string; overall_status: string; closed_date: string | null }[];
  const activeIds = new Set(allCases.filter((c) => ACTIVE.includes(c.overall_status)).map((c) => c.id));
  const won = new Set(allCases.filter((c) => c.overall_status === "success" && c.closed_date && c.closed_date >= cycle.start && c.closed_date <= cycle.end).map((c) => c.id));
  const tasksOpen = (openTasks.data ?? []) as { case_id: string; assigned_to: string; due_date: string }[];
  const withTask = new Set(tasksOpen.map((t) => t.case_id));
  const noTask = [...activeIds].filter((id) => !withTask.has(id)).length;

  const pend = (pending.data ?? []) as unknown as { case: { category: { name_en: string } } }[];

  // Team table. Pipeline of a case is split equally between its current staff.
  const link = (links.data ?? []) as { case_id: string; staff_id: string; end_date: string | null }[];
  const current = link.filter((l) => !l.end_date);
  const staffOn = new Map<string, string[]>();
  for (const l of current) staffOn.set(l.case_id, [...(staffOn.get(l.case_id) ?? []), l.staff_id]);
  const pipeByStaff = new Map<string, number>();
  for (const r of w) {
    const who = staffOn.get(r.case_id) ?? [];
    for (const s of who) pipeByStaff.set(s, (pipeByStaff.get(s) ?? 0) + Number(r.amount_thb) / who.length);
  }
  const pointsBy = new Map<string, number>();
  for (const p of (pts.data ?? []) as { staff_id: string; points: number }[]) pointsBy.set(p.staff_id, (pointsBy.get(p.staff_id) ?? 0) + Number(p.points));
  const kpiBy = new Map((kpis.data ?? []).map((k) => [k.staff_id as string, Number(k.points)]));

  const team = ((staff.data ?? []) as { id: string; codename: string; employment: string }[]).map((s) => {
    const mine = current.filter((l) => l.staff_id === s.id && activeIds.has(l.case_id)).length;
    const myTasks = tasksOpen.filter((t) => t.assigned_to === s.id);
    const points = pointsBy.get(s.id) ?? 0;
    const kpi = kpiBy.get(s.id) ?? null;
    return {
      name: s.codename, partTime: s.employment === "part_time",
      active: mine,
      today: myTasks.filter((t) => t.due_date === today).length,
      overdue: myTasks.filter((t) => t.due_date < today).length,
      successful: new Set(link.filter((l) => l.staff_id === s.id && won.has(l.case_id)).map((l) => l.case_id)).size,
      points, kpi, toGo: kpi === null ? null : Math.max(0, kpi - points),
      pipeline: pipeByStaff.get(s.id) ?? 0,
    };
  }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  return {
    missingRate,
    attention: {
      approvals: pend.length,
      approvalServices: [...new Set(pend.map((p) => p.case.category.name_en))],
      overdueCount: overdue.length,
      overdueTHB: overdue.reduce((a, r) => a + r.thb, 0),
      payout: nextPay ? { date: nextPay, total: round.reduce((a, p) => a + Number(p.total), 0), people: round.length, reviewed: round.filter((p) => p.status === "reviewed").length } : null,
      noTask,
    },
    money: {
      receivedMonth: received.filter((p) => p.received_date >= thisMonth).reduce((a, p) => a + Number(p.revenue_ex_vat), 0),
      receivedCycle: received.reduce((a, p) => a + Number(p.revenue_ex_vat), 0),
      next60: next60.reduce((a, r) => a + r.thb, 0),
      owedInCycle, weightedInCycle,
    },
    forecast, pipeline, team,
    teamPoints: [...pointsBy.values()].reduce((a, b) => a + b, 0),
  };
}
