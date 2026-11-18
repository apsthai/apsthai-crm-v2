import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Flash } from "@/components/flash";
import { getMe, seesAll } from "@/lib/auth";
import { todayBangkok } from "@/lib/dates";
import { AdminHeader } from "../tabs";
import { AddStaff, StaffTable, type StaffRow } from "./staff-table";

// The KPI cycle runs September to August.
const cycleOf = (iso: string) => `${Number(iso.slice(0, 4)) - (Number(iso.slice(5, 7)) >= 9 ? 0 : 1)}-09-01`;

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ cycle?: string; ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (!seesAll(me)) redirect("/dashboard");
  const sp = await searchParams;
  const current = cycleOf(todayBangkok());
  const cycle = /^\d{4}$/.test(sp.cycle ?? "") ? `${sp.cycle}-09-01` : current;

  const [staffRes, kpiRes, cyclesRes, onCaseRes, teamRes] = await Promise.all([
    sb.from("staff").select("id, codename, firstname, lastname, username, role, org, employment, handles_cases, active, auth_user_id")
      .order("active", { ascending: false }).order("codename"),
    sb.from("kpi_targets").select("staff_id, points").eq("cycle_start", cycle),
    sb.from("kpi_targets").select("cycle_start"),
    sb.from("case_staff").select("staff_id"),
    sb.from("team_members").select("staff_id"),
  ]);
  // In use = on a case or in a team. Only someone with neither (and no login) can be deleted.
  const onCase = new Set([...(onCaseRes.data ?? []), ...(teamRes.data ?? [])].map((c) => c.staff_id as string));
  if (staffRes.error) throw new Error(staffRes.error.message);
  const kpi = new Map((kpiRes.data ?? []).map((k) => [k.staff_id as string, Number(k.points)]));
  const cycles = [...new Set([current, ...(cyclesRes.data ?? []).map((c) => c.cycle_start as string), cycle])].sort().reverse();
  const rows: StaffRow[] = (staffRes.data ?? []).map((r) => ({ ...r, kpi: kpi.get(r.id) ?? null, canDelete: !r.auth_user_id && !onCase.has(r.id) })) as StaffRow[];

  return (
    <AppShell active="/admin/staff">
      <AdminHeader active="/admin/staff" />
      <Flash ok={sp.ok} err={sp.err} />
      <StaffTable rows={rows} cycle={cycle} cycles={cycles} meId={me.id} />
      <AddStaff cycle={current} />
    </AppShell>
  );
}
