import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Flash } from "@/components/flash";
import { getMe, seesAll } from "@/lib/auth";
import { todayBangkok } from "@/lib/dates";
import { AdminHeader } from "../tabs";
import { RulesTable, type RuleRow } from "./rules-table";

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (!seesAll(me)) redirect("/dashboard");
  const sp = await searchParams;
  const [rulesRes, catsRes, teamsRes, stagesRes, casesRes] = await Promise.all([
    sb.from("payout_rules").select("id, category_id, revenue_type, method, value, recipient, team_id, count_when, count_stage_id, cycle, effective_intake")
      .order("effective_intake", { ascending: false }),
    sb.from("categories").select("id, name_en, active").order("sort_order"),
    sb.from("teams").select("id, name").order("name"),
    sb.from("stages").select("id, category_id, name_en").eq("active", true).order("sort_order"),
    sb.from("cases").select("category_id, intake").not("intake", "is", null),
  ]);
  if (rulesRes.error) throw new Error(rulesRes.error.message);
  // The latest intake per service: a rule from a later intake has no case under it yet, so it can be deleted.
  const lastIntake = new Map<string, string>();
  for (const c of casesRes.data ?? []) if ((lastIntake.get(c.category_id) ?? "") < c.intake) lastIntake.set(c.category_id, c.intake);
  const rules = ((rulesRes.data ?? []) as RuleRow[]).map((r) => ({ ...r, canDelete: (lastIntake.get(r.category_id) ?? "") < r.effective_intake }));
  return (
    <AppShell active="/admin/rules">
      <AdminHeader active="/admin/rules" />
      <Flash ok={sp.ok} err={sp.err} />
      <RulesTable rules={rules} categories={(catsRes.data ?? []) as { id: string; name_en: string; active: boolean }[]}
        teams={(teamsRes.data ?? []) as { id: string; name: string }[]} stages={(stagesRes.data ?? []) as { id: string; category_id: string; name_en: string }[]}
        thisYear={Number(todayBangkok().slice(0, 4))} />
    </AppShell>
  );
}
