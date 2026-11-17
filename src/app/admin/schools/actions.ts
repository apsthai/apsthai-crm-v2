"use server";

import { todayBangkok } from "@/lib/dates";
import { adminDb, back, num, s } from "../shared";

// The term fields for one service of a school, named <field>_<productId>.
function termFrom(fd: FormData, pid: string) {
  const how = s(fd, `how_${pid}`);
  const value = num(fd, `value_${pid}`);
  return {
    type: s(fd, `type_${pid}`) ?? "commission", payer_type: s(fd, `payer_${pid}`) ?? "school",
    trigger_stage_id: s(fd, `stage_${pid}`), repeat: s(fd, `repeat_${pid}`) ?? "once",
    rate_pct: how === "percent" ? value : null, amount: how === "fixed" ? value : null,
  };
}

export async function saveSchool(fd: FormData) {
  const sb = await adminDb();
  const id = s(fd, "id")!;
  const back2 = (e?: string | { message: string } | null) => back(`/admin/schools?open=${id}`, e);
  if (!s(fd, "name")) return back2("Enter the school name");
  const { data: cur } = await sb.from("schools").select("notes").eq("id", id).single();
  // Saving here counts as checking a school that staff added.
  const notes = cur?.notes?.startsWith("Added by") ? `Checked by Admin on ${todayBangkok()}. ${cur.notes}` : cur?.notes ?? null;
  const currency = s(fd, "currency");
  const up = await sb.from("schools").update({ name: s(fd, "name"), country: s(fd, "country"), type: s(fd, "type"), default_currency: currency, notes }).eq("id", id);
  if (up.error) return back2(up.error);

  const productIds = String(fd.get("products") ?? "").split(",").filter(Boolean);
  for (const pid of productIds) {
    const t = termFrom(fd, pid);
    if (!(Number(t.rate_pct ?? t.amount) >= 0) || (t.rate_pct == null && t.amount == null)) return back2("Every service needs a rate or an amount");
    if (!t.trigger_stage_id) return back2("Choose the stage each service is counted at");
    const { data: ex } = await sb.from("income_terms").select("id").eq("product_id", pid).order("seq").limit(1);
    const res = ex?.length
      ? await sb.from("income_terms").update({ ...t, currency }).eq("id", ex[0].id)
      : await sb.from("income_terms").insert({ ...t, currency, product_id: pid, seq: 1 });
    if (res.error) return back2(res.error);
  }
  back2();
}

export async function addSchoolService(fd: FormData) {
  const sb = await adminDb();
  const schoolId = s(fd, "school_id")!;
  const back2 = (e?: string | { message: string } | null) => back(`/admin/schools?open=${schoolId}`, e);
  const categoryId = s(fd, "category_id");
  if (!categoryId) return back2("Choose a service");
  const { data: dup } = await sb.from("products").select("id").eq("school_id", schoolId).eq("category_id", categoryId).limit(1);
  if (dup?.length) return back2("This school already has that service");
  const { data: stage } = await sb.from("stages").select("id").eq("category_id", categoryId).eq("milestone", "success").limit(1);
  const { data: school } = await sb.from("schools").select("default_currency").eq("id", schoolId).single();
  const p = await sb.from("products").insert({ school_id: schoolId, category_id: categoryId, active: true }).select("id").single();
  if (p.error) return back2(p.error);
  const value = num(fd, "value") ?? 10;
  const t = await sb.from("income_terms").insert({
    product_id: p.data.id, seq: 1, type: "commission", payer_type: "school", repeat: "once",
    trigger_stage_id: stage?.[0]?.id ?? null, rate_pct: s(fd, "how") === "fixed" ? null : value, amount: s(fd, "how") === "fixed" ? value : null,
    currency: school?.default_currency ?? "GBP",
  });
  back2(t.error);
}
