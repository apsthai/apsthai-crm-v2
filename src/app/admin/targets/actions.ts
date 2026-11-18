"use server";

import { adminDb, back, num, s } from "../shared";

// Save every target of one cycle: the company's money-in target and the cases target of each service.
// A blank box removes that target.
export async function saveTargets(fd: FormData) {
  const sb = await adminDb();
  const cycle = s(fd, "cycle")!;
  const go = (e?: { message: string } | string | null) => back(`/admin/targets?cycle=${cycle.slice(0, 4)}`, e);
  if (!/^\d{4}-09-01$/.test(cycle)) return go("Choose a cycle");

  const { data: existing, error } = await sb.from("targets").select("id, category_id").eq("cycle_start", cycle);
  if (error) return go(error);
  const idOf = new Map((existing ?? []).map((t) => [t.category_id as string | null, t.id as string]));

  const put = async (categoryId: string | null, row: { cases?: number | null; revenue_thb?: number | null }, empty: boolean) => {
    const id = idOf.get(categoryId);
    if (empty) return id ? sb.from("targets").delete().eq("id", id) : { error: null };
    return id ? sb.from("targets").update(row).eq("id", id)
      : sb.from("targets").insert({ ...row, cycle_start: cycle, category_id: categoryId });
  };

  const money = num(fd, "revenue");
  if (money !== null && !(money >= 0)) return go("Enter the money-in target as a number");
  const r = await put(null, { revenue_thb: money }, money === null);
  if (r.error) return go(r.error);

  for (const id of String(fd.get("services") ?? "").split(",").filter(Boolean)) {
    const n = num(fd, `cases_${id}`);
    if (n !== null && !(Number.isInteger(n) && n >= 0)) return go("A cases target must be a whole number");
    const res = await put(id, { cases: n }, n === null);
    if (res.error) return go(res.error);
  }
  go();
}
