// Everything the Flight Deck (admin dashboard) shows. Read only: it adds nothing to the database.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, daysBetween, monthStart } from "@/lib/dates";
import { toTHB } from "@/lib/money";

type Cycle = { start: string; end: string; label: string };
const ACTIVE = ["not_started", "in_progress"];

export type Pace = "ahead" | "on" | "behind" | "waiting" | null;

// Compared with where a straight line from 0 to the target would be today.
export function paceOf(now: number, target: number | null, frac: number): Pace {
  if (!target) return null;
  const expected = target * frac;
  if (expected <= 0) return "on";
  const r = now / expected;
  return r >= 1.1 ? "ahead" : r >= 0.9 ? "on" : "behind";
}

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
}

export async function loadFlightDeck(sb: SupabaseClient, today: string, cycle: Cycle) {
  const since = `${addDays(today, -1)}T00:00:00+07:00`; // yesterday and today, Bangkok time
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const thisMonth = monthStart(today);
  const lastMonth = addMonths(thisMonth, -1);
  const payFrom = lastMonth < cycle.start ? lastMonth : cycle.start;

  const [cats, targets, cases, pays, invs, recv, rates, pending, progress, flow, staff, links, pts, kpis, tasks, updates] = await Promise.all([
    sb.from("categories").select("id, name_en, sort_order, active").order("sort_order"),
    sb.from("targets").select("category_id, cases, revenue_thb").eq("cycle_start", cycle.start),
    sb.from("cases").select("id, category_id, intake, overall_status, closed_date, created_at, updated_at"),
    sb.from("payments").select("received_date, received_thb, created_at").gte("received_date", payFrom),
    sb.from("invoices").select("id, date, total, currency, bill_to_name").in("status", ["issued", "partially_paid"]).order("date"),
    sb.from("receivables").select("amount, currency, follow_up_on").eq("status", "expected"),
    sb.from("v_latest_rate").select("currency, rate_thb"),
    sb.from("stage_updates").select("id", { count: "exact", head: true }).eq("approval", "pending"),
    sb.from("v_case_progress").select("case_id, furthest_stage_en"),
    sb.from("v_cashflow").select("case_id, amount_thb").eq("kind", "weighted"),
    sb.from("staff").select("id, codename").eq("active", true).eq("handles_cases", true),
    sb.from("case_staff").select("case_id, staff_id").is("end_date", null),
    sb.from("points_ledger").select("staff_id, points").gte("date", cycle.start).lte("date", cycle.end),
    sb.from("kpi_targets").select("staff_id, points").eq("cycle_start", cycle.start),
    sb.from("tasks").select("case_id").is("done_at", null),
    sb.from("stage_updates").select("case_id").gte("created_at", twoWeeksAgo),
  ]);
  for (const [n, r] of Object.entries({ cats, targets, cases, pays, invs, recv, rates, pending, progress, flow, staff, links, pts, kpis, tasks, updates })) fail(n, r.error);

  const total = daysBetween(cycle.start, cycle.end) + 1;
  const day = daysBetween(cycle.start, today) + 1;
  const frac = day / total;
  const rate = new Map((rates.data ?? []).map((r) => [r.currency as string, Number(r.rate_thb)]));

  type C = { id: string; category_id: string; intake: string | null; overall_status: string; closed_date: string | null; created_at: string; updated_at: string };
  const allCases = (cases.data ?? []) as C[];
  const active = allCases.filter((c) => ACTIVE.includes(c.overall_status));
  const activeIds = new Set(active.map((c) => c.id));
  const won = allCases.filter((c) => c.overall_status === "success" && c.closed_date && c.closed_date >= cycle.start && c.closed_date <= cycle.end);
  const newWeek = allCases.filter((c) => c.created_at >= weekAgo);
  const target = new Map((targets.data ?? []).map((t) => [t.category_id as string | null, t]));

  // 1. Year so far, per service.
  const services = ((cats.data ?? []) as { id: string; name_en: string; active: boolean }[]).map((k) => {
    const now = won.filter((c) => c.category_id === k.id).length;
    const mine = active.filter((c) => c.category_id === k.id);
    const t = target.get(k.id)?.cases ?? null;
    // Nothing closed yet and every open case starts later (e.g. Summer): judged at the intake, not by the calendar.
    const waiting = now === 0 && mine.length > 0 && mine.every((c) => (c.intake ?? "") > today);
    return {
      id: k.id, name: k.name_en, target: t, now,
      pct: t ? Math.min(100, (now / t) * 100) : 0,
      pace: (waiting && t ? "waiting" : paceOf(now, t, frac)) as Pace,
      newWeek: newWeek.filter((c) => c.category_id === k.id).length,
      active: mine.length,
      show: k.active && (t !== null || now > 0 || mine.length > 0),
    };
  });

  const payments = (pays.data ?? []) as { received_date: string; received_thb: number; created_at: string }[];
  const sum = (rows: typeof payments) => rows.reduce((a, p) => a + Number(p.received_thb), 0);
  const moneyCycle = sum(payments.filter((p) => p.received_date >= cycle.start && p.received_date <= cycle.end));
  const revenueTarget = target.get(null)?.revenue_thb != null ? Number(target.get(null)!.revenue_thb) : null;

  // 2. Money.
  const overdue = ((invs.data ?? []) as { id: string; date: string; total: number; currency: string; bill_to_name: string }[])
    .filter((i) => daysBetween(i.date, today) > 30);
  let notBilled = 0, toConfirm = 0, missing = false;
  const rv = (recv.data ?? []) as { amount: number; currency: string; follow_up_on: string | null }[];
  for (const r of rv) {
    const t = toTHB(Number(r.amount), r.currency, rate);
    notBilled += t.thb; missing ||= t.missing;
    if (Number(r.amount) === 0) toConfirm++;
  }
  const billSoon = rv.filter((r) => r.follow_up_on && r.follow_up_on <= addDays(today, 7)).length;
  const lastMonthDays = daysBetween(lastMonth, thisMonth);

  // 3. Closing in the next 90 days, by intake month.
  const stageOf = new Map((progress.data ?? []).map((p) => [p.case_id as string, (p.furthest_stage_en as string) ?? "Not started"]));
  const expectedOf = new Map<string, number>();
  for (const f of (flow.data ?? []) as { case_id: string; amount_thb: number }[]) expectedOf.set(f.case_id, (expectedOf.get(f.case_id) ?? 0) + Number(f.amount_thb));
  const soon = active.filter((c) => c.intake && c.intake >= monthStart(today) && c.intake <= addDays(today, 90));
  const byMonth = new Map<string, C[]>();
  for (const c of soon) byMonth.set(monthStart(c.intake!), [...(byMonth.get(monthStart(c.intake!)) ?? []), c]);
  const closing = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, list]) => {
    const st = new Map<string, number>();
    for (const c of list) { const s = stageOf.get(c.id) ?? "Not started"; st.set(s, (st.get(s) ?? 0) + 1); }
    return {
      month, cases: list.length,
      stages: [...st.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => (n > 1 ? `${s} (${n})` : s)).join(", "),
      expected: list.reduce((a, c) => a + (expectedOf.get(c.id) ?? 0), 0),
    };
  });

  // 4. Team against KPI.
  const link = (links.data ?? []) as { case_id: string; staff_id: string }[];
  const pointsBy = new Map<string, number>();
  for (const p of (pts.data ?? []) as { staff_id: string; points: number }[]) pointsBy.set(p.staff_id, (pointsBy.get(p.staff_id) ?? 0) + Number(p.points));
  const kpiBy = new Map((kpis.data ?? []).map((k) => [k.staff_id as string, Number(k.points)]));
  const newIds = new Set(newWeek.map((c) => c.id));
  const team = ((staff.data ?? []) as { id: string; codename: string }[]).map((s) => {
    const mine = link.filter((l) => l.staff_id === s.id);
    const points = pointsBy.get(s.id) ?? 0;
    const kpi = kpiBy.get(s.id) || null;
    return {
      name: s.codename, points, kpi,
      pct: kpi ? Math.min(100, (points / kpi) * 100) : 0,
      pace: paceOf(points, kpi, frac),
      active: mine.filter((l) => activeIds.has(l.case_id)).length,
      newWeek: mine.filter((l) => newIds.has(l.case_id)).length,
    };
  }).sort((a, b) => Number(b.kpi !== null) - Number(a.kpi !== null) || b.points - a.points || a.name.localeCompare(b.name));

  // 5. Warning lights.
  const withTask = new Set(((tasks.data ?? []) as { case_id: string }[]).map((t) => t.case_id));
  const touched = new Set(((updates.data ?? []) as { case_id: string }[]).map((u) => u.case_id));
  const stale = active.filter((c) => c.updated_at < twoWeeksAgo && !touched.has(c.id)).length;
  const quiet = team.filter((s) => s.kpi !== null && s.newWeek === 0).map((s) => s.name);

  return {
    day, total, frac,
    since: {
      newCases: allCases.filter((c) => c.created_at >= since).length,
      successes: allCases.filter((c) => c.overall_status === "success" && c.closed_date && c.closed_date >= addDays(today, -1)).length,
      payments: payments.filter((p) => p.created_at >= since).length,
      paymentsTHB: sum(payments.filter((p) => p.created_at >= since)),
      approvals: pending.count ?? 0,
    },
    year: {
      services: services.filter((s) => s.show), hidden: services.filter((s) => !s.show).length,
      money: moneyCycle, moneyTarget: revenueTarget,
      moneyPct: revenueTarget ? (moneyCycle / revenueTarget) * 100 : 0,
      moneyPace: paceOf(moneyCycle, revenueTarget, frac),
    },
    money: {
      month: sum(payments.filter((p) => p.received_date >= thisMonth)),
      lastMonth: sum(payments.filter((p) => p.received_date >= lastMonth && p.received_date < thisMonth)),
      dayOfMonth: daysBetween(thisMonth, today) + 1, daysInMonth: daysBetween(thisMonth, addMonths(thisMonth, 1)), lastMonthDays,
      overdue: overdue.map((i) => ({ who: i.bill_to_name, amount: Number(i.total), currency: i.currency, date: i.date })),
      billSoon, notBilled, notBilledCount: rv.length, toConfirm, missing,
    },
    closing,
    team,
    lights: { approvals: pending.count ?? 0, overdue: overdue.length, noTask: active.filter((c) => !withTask.has(c.id)).length, quiet, stale, billSoon },
  };
}
