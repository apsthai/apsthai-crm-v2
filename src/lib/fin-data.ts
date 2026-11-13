// Server-side loaders shared by the Financial pages.
import type { SupabaseClient } from "@supabase/supabase-js";
import { n2 } from "./fin";

// Latest rate to THB per currency.
export async function latestRates(sb: SupabaseClient) {
  const { data } = await sb.from("exchange_rates").select("currency, rate_thb, as_of").order("as_of", { ascending: false });
  const m = new Map<string, number>();
  for (const r of data ?? []) if (!m.has(r.currency)) m.set(r.currency, Number(r.rate_thb));
  return m;
}

export const RV_SELECT = `id, type, amount, currency, status, created_at, case_id,
  term:income_terms(rate_pct, amount),
  app:applications(programme, commissionable_fee, currency, product:products(school_id, school:schools(name))),
  kase:cases(id, intake, category_id, sub_agent_pct, partner:partners!cases_sub_agent_id_fkey(name),
    student:students(codename, firstname, lastname), category:categories(name_en),
    case_staff(end_date, created_at, staff:staff!case_staff_staff_id_fkey(codename)))`;

type One<T> = T | T[] | null;
const one = <T,>(x: One<T>): T | null => (Array.isArray(x) ? x[0] ?? null : x);

export type RvRaw = {
  id: string; type: string; amount: number; currency: string; status: string; created_at: string; case_id: string;
  term: One<{ rate_pct: number | null; amount: number | null }>;
  app: One<{ programme: string | null; commissionable_fee: number | null; currency: string | null;
    product: One<{ school_id: string | null; school: One<{ name: string }> }> }>;
  kase: One<{ id: string; intake: string | null; category_id: string; sub_agent_pct: number | null; partner: One<{ name: string }>;
    student: One<{ codename: string; firstname: string | null; lastname: string | null }>; category: One<{ name_en: string }>;
    case_staff: { end_date: string | null; created_at: string; staff: One<{ codename: string }> }[] }>;
};

export type Rv = {
  id: string; type: string; amount: number; currency: string; status: string; createdAt: string; caseId: string;
  student: string; fullName: string; school: string; schoolId: string | null; programme: string; service: string;
  how: string; staff: string[]; categoryId: string; intake: string | null; partner: string | null; partnerPct: number; defaultText: string;
};

// Flattens a receivable row for display and builds the default text for an invoice line.
export function flatRv(r: RvRaw): Rv {
  const term = one(r.term);
  const app = one(r.app);
  const product = one(app?.product ?? null);
  const school = one(product?.school ?? null)?.name ?? "";
  const k = one(r.kase);
  const st = one(k?.student ?? null);
  const fee = app?.commissionable_fee != null ? Number(app.commissionable_fee) : null;
  const rate = term?.rate_pct != null ? Number(term.rate_pct) : null;
  const how = rate != null && fee != null ? `${rate}% of ${app?.currency ?? r.currency} ${n2(fee)}`
    : term?.amount != null ? "Fixed fee" : "Added by hand";
  const fullName = [st?.firstname, st?.lastname?.toUpperCase()].filter(Boolean).join(" ");
  const programme = app?.programme ?? "";
  const defaultText = [fullName, [school, programme].filter(Boolean).join(" - ")].filter(Boolean).join(" - ")
    + (rate != null && fee != null ? ` (${rate}% of ${n2(fee)})` : "");
  return {
    id: r.id, type: r.type, amount: Number(r.amount), currency: r.currency, status: r.status, createdAt: r.created_at,
    caseId: r.case_id, student: st?.codename ?? "", fullName, school, schoolId: product?.school_id ?? null, programme,
    service: one(k?.category ?? null)?.name_en ?? "", how,
    staff: (k?.case_staff ?? []).filter((c) => !c.end_date).sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => one(c.staff)?.codename ?? "").filter(Boolean),
    categoryId: k?.category_id ?? "", intake: k?.intake ?? null,
    partner: one(k?.partner ?? null)?.name ?? null, partnerPct: Number(k?.sub_agent_pct ?? 0), defaultText,
  };
}

type Rule = { category_id: string; revenue_type: string; method: string; value: number | null; recipient: string;
  count_when: string; cycle: string; effective_intake: string };

// Same choice as rule_for() in the database: the newest rule for the case's service, type and intake.
export async function teamRules(sb: SupabaseClient) {
  const { data } = await sb.from("payout_rules")
    .select("category_id, revenue_type, method, value, recipient, count_when, cycle, effective_intake")
    .order("effective_intake", { ascending: false });
  const rules = (data ?? []) as Rule[];
  return (rv: Rv) => {
    const r = rules.find((x) => x.category_id === rv.categoryId && x.revenue_type === rv.type && !!rv.intake && x.effective_intake <= rv.intake);
    if (!r) return { pct: 0, note: "No team rule" };
    if (r.method === "percent" && r.count_when === "payment" && r.cycle === "next_month") return { pct: Number(r.value ?? 0), note: "" };
    return { pct: 0, note: "Own rule" };
  };
}
