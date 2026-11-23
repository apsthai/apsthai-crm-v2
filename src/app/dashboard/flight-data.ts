// The parts of the Flight Deck about today (not about a cycle). Read only: it adds nothing to the database.
// The cycle parts (where are we, team against KPI) come from loadCycles in lib/cycle-data.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, daysBetween, monthStart } from "@/lib/dates";
import { toTHB } from "@/lib/money";
import type { Cycle } from "@/lib/cycle-data";

const ACTIVE = ["not_started", "in_progress"];

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
}

export async function loadFlightDeck(sb: SupabaseClient, today: string, cycle: Cycle) {
  const since = `${addDays(today, -1)}T00:00:00+07:00`; // yesterday and today, Bangkok time
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const thisMonth = monthStart(today);
  const lastMonth = addMonths(thisMonth, -1);

  const [cases, pays, invs, recv, rates, pending, progress, flow, staff, links, kpis, tasks, updates] = await Promise.all([
    sb.from("cases").select("id, category_id, intake, overall_status, closed_date, created_at, updated_at, student:students(pdpa_consent_date)"),
    sb.from("payments").select("received_date, received_thb, created_at").gte("received_date", lastMonth),
    sb.from("invoices").select("id, date, total, currency, bill_to_name").in("status", ["issued", "partially_paid"]).order("date"),
    sb.from("receivables").select("amount, currency, follow_up_on").eq("status", "expected"),
    sb.from("v_latest_rate").select("currency, rate_thb"),
    sb.from("stage_updates").select("id", { count: "exact", head: true }).eq("approval", "pending"),
    sb.from("v_case_progress").select("case_id, furthest_stage_en"),
    sb.from("v_cashflow").select("case_id, amount_thb").eq("kind", "weighted"),
    sb.from("staff").select("id, codename").eq("active", true).eq("handles_cases", true),
    sb.from("case_staff").select("case_id, staff_id").is("end_date", null),
    sb.from("kpi_targets").select("staff_id, points").eq("cycle_start", cycle.start),
    sb.from("tasks").select("case_id").is("done_at", null),
    sb.from("stage_updates").select("case_id").gte("created_at", twoWeeksAgo),
  ]);
  for (const [n, r] of Object.entries({ cases, pays, invs, recv, rates, pending, progress, flow, staff, links, kpis, tasks, updates })) fail(n, r.error);

  const rate = new Map((rates.data ?? []).map((r) => [r.currency as string, Number(r.rate_thb)]));

  type C = { id: string; category_id: string; intake: string | null; overall_status: string; closed_date: string | null; created_at: string; updated_at: string;
    student: { pdpa_consent_date: string | null } | null };
  const allCases = (cases.data ?? []) as unknown as C[];
  const active = allCases.filter((c) => ACTIVE.includes(c.overall_status));
  const newWeek = allCases.filter((c) => c.created_at >= weekAgo);

  const payments = (pays.data ?? []) as { received_date: string; received_thb: number; created_at: string }[];
  const sum = (rows: typeof payments) => rows.reduce((a, p) => a + Number(p.received_thb), 0);

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

  // Who has a KPI this cycle but opened no case this week (any intake).
  const link = (links.data ?? []) as { case_id: string; staff_id: string }[];
  const kpiIds = new Set((kpis.data ?? []).filter((k) => Number(k.points) > 0).map((k) => k.staff_id as string));
  const newIds = new Set(newWeek.map((c) => c.id));
  const quiet = ((staff.data ?? []) as { id: string; codename: string }[])
    .filter((s) => kpiIds.has(s.id) && !link.some((l) => l.staff_id === s.id && newIds.has(l.case_id)))
    .map((s) => s.codename).sort();

  // 5. Warning lights.
  const withTask = new Set(((tasks.data ?? []) as { case_id: string }[]).map((t) => t.case_id));
  const touched = new Set(((updates.data ?? []) as { case_id: string }[]).map((u) => u.case_id));
  const stale = active.filter((c) => c.updated_at < twoWeeksAgo && !touched.has(c.id)).length;

  return {
    since: {
      newCases: allCases.filter((c) => c.created_at >= since).length,
      successes: allCases.filter((c) => c.overall_status === "success" && c.closed_date && c.closed_date >= addDays(today, -1)).length,
      payments: payments.filter((p) => p.created_at >= since).length,
      paymentsTHB: sum(payments.filter((p) => p.created_at >= since)),
      approvals: pending.count ?? 0,
    },
    money: {
      month: sum(payments.filter((p) => p.received_date >= thisMonth)),
      lastMonth: sum(payments.filter((p) => p.received_date >= lastMonth && p.received_date < thisMonth)),
      dayOfMonth: daysBetween(thisMonth, today) + 1, daysInMonth: daysBetween(thisMonth, addMonths(thisMonth, 1)), lastMonthDays,
      overdue: overdue.map((i) => ({ who: i.bill_to_name, amount: Number(i.total), currency: i.currency, date: i.date })),
      billSoon, notBilled, notBilledCount: rv.length, toConfirm, missing,
    },
    closing,
    lights: { noConsent: active.filter((c) => !c.student?.pdpa_consent_date).length, approvals: pending.count ?? 0, overdue: overdue.length, noTask: active.filter((c) => !withTask.has(c.id)).length, quiet, stale, billSoon },
  };
}
