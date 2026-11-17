import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Flash } from "@/components/flash";
import { getMe } from "@/lib/auth";
import { todayBangkok } from "@/lib/dates";
import { AdminHeader } from "../tabs";
import { RulesTable, type RuleRow } from "./rules-table";

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const [rulesRes, catsRes, teamsRes, stagesRes] = await Promise.all([
    sb.from("payout_rules").select("id, category_id, revenue_type, method, value, recipient, team_id, count_when, count_stage_id, cycle, effective_intake")
      .order("effective_intake", { ascending: false }),
    sb.from("categories").select("id, name_en, active").order("sort_order"),
    sb.from("teams").select("id, name").order("name"),
    sb.from("stages").select("id, category_id, name_en").eq("active", true).order("sort_order"),
  ]);
  if (rulesRes.error) throw new Error(rulesRes.error.message);
  return (
    <AppShell active="/admin/rules">
      <AdminHeader active="/admin/rules" />
      <Flash ok={sp.ok} err={sp.err} />
      <RulesTable rules={(rulesRes.data ?? []) as RuleRow[]} categories={(catsRes.data ?? []) as { id: string; name_en: string; active: boolean }[]}
        teams={(teamsRes.data ?? []) as { id: string; name: string }[]} stages={(stagesRes.data ?? []) as { id: string; category_id: string; name_en: string }[]}
        thisYear={Number(todayBangkok().slice(0, 4))} />
    </AppShell>
  );
}
