// What happened in a cycle (Sep to Aug). Read only.
// Owner rule (23 Nov 2026): a case belongs to the cycle of its intake. Its success, its points (KPI) and its revenue
// (money in plus money still to collect) count there, however late the money arrives. Money in by date is cash flow
// and is shown apart. Staff and partner payouts still follow the month the money came in (SOP 001).
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysBetween } from "@/lib/dates";
import { toTHB } from "@/lib/money";

export type Cycle = { start: string; end: string; label: string };
export type Pace = "ahead" | "on" | "behind" | "waiting" | "future" | null;

const ACTIVE = ["not_started", "in_progress"];
const OPEN = ["expected", "invoiced", "partially_paid"];

// Compared with where a straight line from 0 to the target would be today.
export function paceOf(now: number, target: number | null, frac: number): Pace {
  if (!target) return null;
  if (frac <= 0) return "future";
  const expected = target * frac;
  const r = now / expected;
  return r >= 1.1 ? "ahead" : r >= 0.9 ? "on" : "behind";
}

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
}

type CaseRow = { id: string; category_id: string; intake: string | null; overall_status: string; closed_date: string | null; created_at: string };
type RecvRow = {
  case_id: string; amount: number; currency: string; status: string;
  payment_lines: { amount: number; revenue_ex_vat: number; payment: { received_thb: number; revenue_ex_vat: number } | null }[];
};

// The date that puts a case in a cycle.
const cycleDate = (c: CaseRow) => c.intake ?? c.closed_date ?? c.created_at.slice(0, 10);
const inCycle = (d: string, cy: Cycle) => d >= cy.start && d <= cy.end;

export async function loadCycles(sb: SupabaseClient, today: string, cycles: Cycle[]) {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const from = cycles.map((c) => c.start).sort()[0];
  const to = cycles.map((c) => c.end).sort().reverse()[0];
  const starts = cycles.map((c) => c.start);

  const [cats, targets, cases, recv, rates, flow, pays, staff, links, pts, kpis] = await Promise.all([
    sb.from("categories").select("id, name_en, sort_order, active").order("sort_order"),
    sb.from("targets").select("cycle_start, category_id, cases, revenue_thb").in("cycle_start", starts),
    sb.from("cases").select("id, category_id, intake, overall_status, closed_date, created_at"),
    sb.from("receivables").select("case_id, amount, currency, status, payment_lines(amount, revenue_ex_vat, payment:payments(received_thb, revenue_ex_vat))").neq("status", "cancelled"),
    sb.from("v_latest_rate").select("currency, rate_thb"),
    sb.from("v_cashflow").select("case_id, amount_thb").eq("kind", "weighted"),
    sb.from("payments").select("received_date, received_thb").gte("received_date", from).lte("received_date", to),
    sb.from("staff").select("id, codename, active, handles_cases"),
    sb.from("case_staff").select("case_id, staff_id").is("end_date", null),
    sb.from("points_ledger").select("staff_id, points, date").gte("date", from).lte("date", to),
    sb.from("kpi_targets").select("cycle_start, staff_id, points").in("cycle_start", starts),
  ]);
  for (const [n, r] of Object.entries({ cats, targets, cases, recv, rates, flow, pays, staff, links, pts, kpis })) fail(n, r.error);

  const rate = new Map((rates.data ?? []).map((r) => [r.currency as string, Number(r.rate_thb)]));
  const allCases = (cases.data ?? []) as CaseRow[];
  const receivables = (recv.data ?? []) as unknown as RecvRow[];
  const expectedOf = new Map<string, number>();
  for (const f of (flow.data ?? []) as { case_id: string; amount_thb: number }[]) expectedOf.set(f.case_id, (expectedOf.get(f.case_id) ?? 0) + Number(f.amount_thb));
  const link = (links.data ?? []) as { case_id: string; staff_id: string }[];

  return cycles.map((cy) => {
    const total = daysBetween(cy.start, cy.end) + 1;
    const frac = today < cy.start ? 0 : today > cy.end ? 1 : (daysBetween(cy.start, today) + 1) / total;
    const mineCases = allCases.filter((c) => inCycle(cycleDate(c), cy));
    const won = mineCases.filter((c) => c.overall_status === "success");
    const active = mineCases.filter((c) => ACTIVE.includes(c.overall_status));
    const newWeek = mineCases.filter((c) => c.created_at >= weekAgo);
    const tRows = (targets.data ?? []).filter((t) => t.cycle_start === cy.start);
    const target = new Map(tRows.map((t) => [t.category_id as string | null, t]));

    // Revenue of the cycle: money in and money still to collect for its cases, THB incl. VAT.
    const ids = new Set(mineCases.map((c) => c.id));
    let received = 0, toCollect = 0, toConfirm = 0, missing = false;
    const withAmount = new Set<string>();
    for (const r of receivables.filter((x) => ids.has(x.case_id))) {
      if (Number(r.amount) > 0) withAmount.add(r.case_id);
      let paidInCurrency = 0;
      for (const l of r.payment_lines) {
        paidInCurrency += Number(l.amount);
        const p = l.payment;
        if (p && Number(p.revenue_ex_vat) > 0) received += (Number(l.revenue_ex_vat) / Number(p.revenue_ex_vat)) * Number(p.received_thb);
      }
      if (OPEN.includes(r.status)) {
        if (Number(r.amount) === 0) toConfirm++;
        const t = toTHB(Math.max(0, Number(r.amount) - paidInCurrency), r.currency, rate);
        toCollect += t.thb; missing ||= t.missing;
      }
    }
    const revenue = received + toCollect;
    const pipeline = active.reduce((a, c) => a + (expectedOf.get(c.id) ?? 0), 0);
    const revenueTarget = target.get(null)?.revenue_thb != null ? Number(target.get(null)!.revenue_thb) : null;
    const moneyIn = ((pays.data ?? []) as { received_date: string; received_thb: number }[])
      .filter((p) => inCycle(p.received_date, cy)).reduce((a, p) => a + Number(p.received_thb), 0);

    const services = ((cats.data ?? []) as { id: string; name_en: string; active: boolean }[]).map((k) => {
      const now = won.filter((c) => c.category_id === k.id).length;
      const open = active.filter((c) => c.category_id === k.id);
      const t = target.get(k.id)?.cases ?? null;
      // Nothing closed yet and every open case starts later (e.g. Summer): judged at the intake, not by the calendar.
      const waiting = frac > 0 && now === 0 && open.length > 0 && open.every((c) => (c.intake ?? "") > today);
      return {
        id: k.id, name: k.name_en, target: t, now,
        pct: t ? Math.min(100, (now / t) * 100) : 0,
        pace: (waiting && t ? "waiting" : paceOf(now, t, frac)) as Pace,
        newWeek: newWeek.filter((c) => c.category_id === k.id).length,
        active: open.length,
        show: k.active && (t !== null || now > 0 || open.length > 0),
      };
    });

    // Team: points and KPI of this cycle, cases of this cycle.
    const pointsBy = new Map<string, number>();
    for (const p of (pts.data ?? []) as { staff_id: string; points: number; date: string }[]) {
      if (inCycle(p.date, cy)) pointsBy.set(p.staff_id, (pointsBy.get(p.staff_id) ?? 0) + Number(p.points));
    }
    const kpiBy = new Map((kpis.data ?? []).filter((k) => k.cycle_start === cy.start).map((k) => [k.staff_id as string, Number(k.points)]));
    const activeIds = new Set(active.map((c) => c.id));
    const newIds = new Set(newWeek.map((c) => c.id));
    const team = ((staff.data ?? []) as { id: string; codename: string; active: boolean; handles_cases: boolean }[])
      .filter((s) => (s.active && s.handles_cases) || pointsBy.has(s.id) || kpiBy.has(s.id))
      .map((s) => {
        const mine = link.filter((l) => l.staff_id === s.id);
        const points = pointsBy.get(s.id) ?? 0;
        const kpi = kpiBy.get(s.id) || null;
        return {
          id: s.id, name: s.codename, points, kpi,
          pct: kpi ? Math.min(100, (points / kpi) * 100) : 0,
          pace: paceOf(points, kpi, frac),
          active: mine.filter((l) => activeIds.has(l.case_id)).length,
          newWeek: mine.filter((l) => newIds.has(l.case_id)).length,
        };
      })
      .sort((a, b) => Number(b.kpi !== null) - Number(a.kpi !== null) || b.points - a.points || a.name.localeCompare(b.name));

    return {
      cycle: cy, frac, day: Math.round(frac * total), total,
      services: services.filter((s) => s.show), hidden: services.filter((s) => !s.show).length,
      wonByService: new Map(services.map((s) => [s.id, s.now])),
      successful: won.length, active: active.length,
      revenue, received, toCollect, toConfirm, missing, pipeline, revenueTarget,
      revenuePct: revenueTarget ? (revenue / revenueTarget) * 100 : 0,
      revenuePace: paceOf(revenue, revenueTarget, frac),
      noAmount: won.filter((c) => !withAmount.has(c.id)).length,
      moneyIn,
      team, teamPoints: [...pointsBy.values()].reduce((a, b) => a + b, 0),
    };
  });
}

export type CycleData = Awaited<ReturnType<typeof loadCycles>>[number];
