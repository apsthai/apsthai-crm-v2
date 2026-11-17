"use server";

import { adminDb, back, inUse, num, s } from "../shared";

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,30}$/;

export async function addStaff(fd: FormData) {
  const sb = await adminDb();
  const username = (s(fd, "username") ?? "").toLowerCase();
  const codename = s(fd, "codename");
  if (!codename || !s(fd, "firstname") || !s(fd, "lastname")) return back("/admin/staff", "Enter the nickname, first name and last name");
  if (!USERNAME.test(username)) return back("/admin/staff", "Username: small letters and numbers only, e.g. game");
  const { data, error } = await sb.from("staff").insert({
    codename, firstname: s(fd, "firstname"), lastname: s(fd, "lastname"), username,
    org: s(fd, "org") ?? "APSworld", employment: s(fd, "employment") ?? "part_time",
    handles_cases: fd.get("handles_cases") !== "no", role: "staff",
  }).select("id").single();
  if (error) return back("/admin/staff", error.message.includes("unique") ? "That nickname or username is already used" : error);
  const kpi = num(fd, "kpi");
  if (kpi && kpi > 0) {
    const k = await sb.from("kpi_targets").insert({ staff_id: data.id, cycle_start: s(fd, "cycle"), points: kpi });
    if (k.error) return back("/admin/staff", k.error);
  }
  back("/admin/staff");
}

export async function updateStaff(fd: FormData) {
  const sb = await adminDb();
  const id = s(fd, "id")!;
  if (!s(fd, "codename") || !s(fd, "firstname") || !s(fd, "lastname")) return back("/admin/staff", "Enter the nickname, first name and last name");
  const { error } = await sb.from("staff").update({
    codename: s(fd, "codename"), firstname: s(fd, "firstname"), lastname: s(fd, "lastname"),
    org: s(fd, "org"), employment: s(fd, "employment"), handles_cases: fd.get("handles_cases") !== "no",
  }).eq("id", id);
  back("/admin/staff", error?.message.includes("unique") ? "That nickname is already used" : error);
}

// One form for the whole table: a number sets the KPI for the cycle, blank removes it.
export async function saveKpi(fd: FormData) {
  const sb = await adminDb();
  const cycle = s(fd, "cycle")!;
  for (const [key] of fd.entries()) {
    if (!key.startsWith("kpi_")) continue;
    const staffId = key.slice(4);
    const points = num(fd, key);
    const res = points && points > 0
      ? await sb.from("kpi_targets").upsert({ staff_id: staffId, cycle_start: cycle, points }, { onConflict: "staff_id,cycle_start" })
      : await sb.from("kpi_targets").delete().eq("staff_id", staffId).eq("cycle_start", cycle);
    if (res.error) return back(`/admin/staff?cycle=${cycle.slice(0, 4)}`, res.error);
  }
  back(`/admin/staff?cycle=${cycle.slice(0, 4)}`);
}

// Only for someone added by mistake: no login, never on a case, not in a team. Their KPI goes with them.
export async function deleteStaff(fd: FormData) {
  const sb = await adminDb();
  const id = s(fd, "id")!;
  const { data: st } = await sb.from("staff").select("auth_user_id").eq("id", id).single();
  if (st?.auth_user_id) return back("/admin/staff", "This person has a login. Switch the login off instead");
  const [cs, tm] = await Promise.all([
    sb.from("case_staff").select("id", { count: "exact", head: true }).eq("staff_id", id),
    sb.from("team_members").select("staff_id", { count: "exact", head: true }).eq("staff_id", id),
  ]);
  if (cs.count || tm.count) return back("/admin/staff", "This person is on cases or in a team, so they cannot be deleted");
  await sb.from("kpi_targets").delete().eq("staff_id", id);
  const { error } = await sb.from("staff").delete().eq("id", id);
  back("/admin/staff", inUse(error, "This person"));
}
