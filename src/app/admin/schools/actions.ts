"use server";

import { todayBangkok } from "@/lib/dates";
import { adminDb, back, inUse, num, s } from "../shared";

// The settings every instalment of one service shares, named <field>_<productId>.
function shared(fd: FormData, pid: string) {
  return {
    type: s(fd, `type_${pid}`) ?? "commission", payer_type: s(fd, `payer_${pid}`) ?? "school",
    trigger_stage_id: s(fd, `stage_${pid}`), repeat: s(fd, `repeat_${pid}`) ?? "once",
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
    const base = shared(fd, pid);
    if (!base.trigger_stage_id) return back2("Choose the stage each service is counted at");
    const fixed = s(fd, `how_${pid}`) === "fixed";
    const n = Math.min(3, Math.max(1, Number(s(fd, `count_${pid}`) ?? 1)));
    // One row per instalment (seq 1..n), each with its own rate or amount and bill month.
    for (let k = 1; k <= n; k++) {
      const value = num(fd, `value_${pid}_${k}`);
      if (value == null || !(value >= 0)) return back2("Every instalment needs a rate or an amount");
      const month = num(fd, `month_${pid}_${k}`);
      const row = { ...base, currency, rate_pct: fixed ? null : value, amount: fixed ? value : null, bill_month: month };
      const { data: ex } = await sb.from("income_terms").select("id").eq("product_id", pid).eq("seq", k).maybeSingle();
      const res = ex
        ? await sb.from("income_terms").update(row).eq("id", ex.id)
        : await sb.from("income_terms").insert({ ...row, product_id: pid, seq: k });
      if (res.error) return back2(res.error);
    }
    // Fewer instalments than before: drop the extra ones, unless a case already has an amount from them.
    const del = await sb.from("income_terms").delete().eq("product_id", pid).gt("seq", n);
    if (del.error) return back2(del.error.message.includes("foreign key")
      ? "A case already has an amount from that instalment, so the number of instalments cannot go down" : del.error);
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

// Bound to a service's Delete button inside the school form. Only when no student applied to it; its rate goes with it.
export async function deleteSchoolService(productId: string, fd: FormData) {
  const sb = await adminDb();
  const schoolId = s(fd, "id")!;
  const { count } = await sb.from("applications").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if (count) return back(`/admin/schools?open=${schoolId}`, "Students applied to this, so it cannot be deleted");
  const { error } = await sb.from("products").delete().eq("id", productId).eq("school_id", schoolId);
  back(`/admin/schools?open=${schoolId}`, inUse(error, "This service"));
}

// Only for a school nothing uses: no student applied, no one studies there, no invoice or payer.
export async function deleteSchool(fd: FormData) {
  const sb = await adminDb();
  const id = s(fd, "id")!;
  const { data: prods } = await sb.from("products").select("id").eq("school_id", id);
  const ids = (prods ?? []).map((p) => p.id as string);
  const checks = await Promise.all([
    ids.length ? sb.from("applications").select("id", { count: "exact", head: true }).in("product_id", ids) : { count: 0 },
    sb.from("education").select("id", { count: "exact", head: true }).eq("school_id", id),
    sb.from("payers").select("id", { count: "exact", head: true }).eq("school_id", id),
  ]);
  if (checks.some((c) => c.count)) return back(`/admin/schools?open=${id}`, "This school is already used by students or invoices, so it cannot be deleted");
  if (ids.length) {
    const p = await sb.from("products").delete().eq("school_id", id);
    if (p.error) return back(`/admin/schools?open=${id}`, inUse(p.error, "This school"));
  }
  const { error } = await sb.from("schools").delete().eq("id", id);
  back(error ? `/admin/schools?open=${id}` : "/admin/schools", inUse(error, "This school"));
}
