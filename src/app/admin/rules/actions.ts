"use server";

import { adminDb, back, inUse, num, s } from "../shared";

// A new rate is a new rule from an intake. The old rule stays, so cases with an earlier intake keep theirs.
export async function addRule(fd: FormData) {
  const sb = await adminDb();
  const method = s(fd, "method") ?? "percent";
  const recipient = s(fd, "recipient") ?? "case_staff";
  const countWhen = s(fd, "count_when") ?? "payment";
  const intake = s(fd, "intake");
  if (!/^\d{4}-\d{2}$/.test(intake ?? "")) return back("/admin/rules", "Choose the intake the new rate starts from");
  const value = method === "manual" ? null : num(fd, "value");
  if (method !== "manual" && !(value != null && value >= 0)) return back("/admin/rules", "Enter the rate or amount");
  if (recipient === "team" && !s(fd, "team_id")) return back("/admin/rules", "Choose the team");
  if (countWhen === "stage" && !s(fd, "count_stage_id")) return back("/admin/rules", "Choose the stage");
  const { error } = await sb.from("payout_rules").insert({
    category_id: s(fd, "category_id"), revenue_type: s(fd, "revenue_type") ?? "commission",
    method, value, recipient, team_id: recipient === "team" ? s(fd, "team_id") : null,
    count_when: countWhen, count_stage_id: countWhen === "stage" ? s(fd, "count_stage_id") : null,
    cycle: s(fd, "cycle") ?? "next_month", effective_intake: `${intake}-01`,
  });
  back("/admin/rules", error?.message.includes("unique")
    ? "There is already a rule for this service from that intake. Choose a later intake." : error);
}

// Only for a rule no case falls under yet (no case of that service from its intake on) and not used in a payout.
export async function deleteRule(fd: FormData) {
  const sb = await adminDb();
  const id = s(fd, "id")!;
  const { data: r } = await sb.from("payout_rules").select("category_id, effective_intake").eq("id", id).single();
  if (!r) return back("/admin/rules", "Rule not found");
  const { count } = await sb.from("cases").select("id", { count: "exact", head: true })
    .eq("category_id", r.category_id).gte("intake", r.effective_intake);
  if (count) return back("/admin/rules", "Cases already fall under this rule, so add a new rate instead");
  const { error } = await sb.from("payout_rules").delete().eq("id", id);
  back("/admin/rules", inUse(error, "This rule"));
}
