import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Flash } from "@/components/flash";
import { getMe, seesAll } from "@/lib/auth";
import { AdminHeader } from "../tabs";
import { AddService, ServicesTable, type ServiceRow } from "./services-table";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ open?: string; ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (!seesAll(me)) redirect("/dashboard");
  const sp = await searchParams;
  const [catsRes, casesRes, teamsRes, upRes, termRes, ruleRes] = await Promise.all([
    sb.from("categories").select(`id, name_en, name_th, points, estimated_value_thb, in_house, sort_order, active,
      stages!stages_category_id_fkey(id, name_en, sort_order, level, milestone, probability_pct, editable_by_team_id, active)`).order("sort_order"),
    sb.from("cases").select("category_id"),
    sb.from("teams").select("id, name").order("name"),
    sb.from("stage_updates").select("stage_id"),
    sb.from("income_terms").select("trigger_stage_id"),
    sb.from("payout_rules").select("count_stage_id"),
  ]);
  // A stage can be deleted only when no case has reached it and no rate or rule counts at it.
  const used = new Set([...(upRes.data ?? []).map((x) => x.stage_id), ...(termRes.data ?? []).map((x) => x.trigger_stage_id),
    ...(ruleRes.data ?? []).map((x) => x.count_stage_id)].filter(Boolean) as string[]);
  if (catsRes.error) throw new Error(catsRes.error.message);
  const count = new Map<string, number>();
  for (const c of casesRes.data ?? []) count.set(c.category_id, (count.get(c.category_id) ?? 0) + 1);
  const rows = ((catsRes.data ?? []) as unknown as Omit<ServiceRow, "cases">[]).map((c) => ({
    ...c, cases: count.get(c.id) ?? 0, stages: [...c.stages].sort((a, b) => a.sort_order - b.sort_order).map((x) => ({ ...x, canDelete: !used.has(x.id) && x.milestone !== "success" })),
  }));
  return (
    <AppShell active="/admin/services">
      <AdminHeader active="/admin/services" />
      <Flash ok={sp.ok} err={sp.err} />
      <ServicesTable rows={rows} open={sp.open ?? null} teams={(teamsRes.data ?? []) as { id: string; name: string }[]} />
      <AddService services={rows.map((r) => ({ id: r.id, name: r.name_en }))} />
    </AppShell>
  );
}
