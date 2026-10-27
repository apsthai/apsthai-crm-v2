"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { done, monthStart, num, str } from "@/lib/actions";
import { todayBangkok } from "@/lib/format";

const back = (id: string) => `/cases/${id}`;

// sub-agent share typed in, or the partner's default share
async function subAgentPct(sb: Awaited<ReturnType<typeof getMe>>["supabase"], fd: FormData, subAgent: string | null) {
  if (!subAgent) return null;
  const typed = num(fd, "sub_agent_pct");
  if (typed !== null) return typed;
  const { data } = await sb.from("partners").select("default_share_pct").eq("id", subAgent).maybeSingle();
  return data?.default_share_pct ?? null;
}

export async function createCase(fd: FormData) {
  const { supabase: sb } = await getMe();
  const studentId = str(fd, "student_id");
  const ret = `/cases/new${studentId ? `?student=${studentId}` : ""}`;
  const subAgent = str(fd, "sub_agent_id");
  const { data, error } = await sb.from("cases").insert({
    student_id: studentId, category_id: str(fd, "category_id"), intake: monthStart(fd, "intake"),
    applicant: str(fd, "applicant") ?? "student", applicant_name: str(fd, "applicant_name"),
    lead_channel_id: str(fd, "lead_channel_id"), referred_by: str(fd, "referred_by"),
    sub_agent_id: subAgent, sub_agent_pct: await subAgentPct(sb, fd, subAgent),
    next_action: str(fd, "next_action"), next_action_date: str(fd, "next_action_date"),
  }).select("id").single();
  if (error) done(ret, error);
  const staff = [...new Set([str(fd, "staff1"), str(fd, "staff2")].filter(Boolean))] as string[];
  if (staff.length) {
    const { error: e2 } = await sb.from("case_staff").insert(staff.map((s) => ({ case_id: data.id, staff_id: s })));
    if (e2) done(back(data.id), e2);
  }
  redirect(back(data.id));
}

export async function updateCase(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "id")!;
  const subAgent = str(fd, "sub_agent_id");
  const { error } = await sb.from("cases").update({
    intake: monthStart(fd, "intake"), applicant: str(fd, "applicant") ?? "student", applicant_name: str(fd, "applicant_name"),
    lead_channel_id: str(fd, "lead_channel_id"), referred_by: str(fd, "referred_by"),
    sub_agent_id: subAgent, sub_agent_pct: await subAgentPct(sb, fd, subAgent),
    next_action: str(fd, "next_action"), next_action_date: str(fd, "next_action_date"),
  }).eq("id", id);
  revalidatePath(back(id));
  done(back(id), error);
}

export async function closeCaseFailed(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "id")!;
  const reason = str(fd, "overall_remark");
  if (!reason) done(back(id), "Reason is required");
  const { error } = await sb.from("cases").update({ overall_status: "fail", overall_remark: reason, closed_date: todayBangkok() }).eq("id", id);
  revalidatePath(back(id));
  done(back(id), error);
}

export async function reopenCase(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "id")!;
  const { error } = await sb.from("cases").update({ overall_status: "in_progress", closed_date: null }).eq("id", id).eq("overall_status", "fail");
  revalidatePath(back(id));
  done(back(id), error);
}

export async function addCaseStaff(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "case_id")!;
  const { error } = await sb.from("case_staff").insert({ case_id: id, staff_id: str(fd, "staff_id") });
  revalidatePath(back(id));
  done(back(id), error);
}

export async function endCaseStaff(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "case_id")!;
  const { error } = await sb.from("case_staff").update({ end_date: todayBangkok() }).eq("id", str(fd, "id"));
  revalidatePath(back(id));
  done(back(id), error);
}

export async function addApplication(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "case_id")!;
  const { error } = await sb.from("applications").insert({
    case_id: id, product_id: str(fd, "product_id"), commissionable_fee: num(fd, "commissionable_fee"), currency: str(fd, "currency"),
  });
  revalidatePath(back(id));
  done(back(id), error);
}

export async function updateApplication(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "case_id")!;
  const patch: Record<string, unknown> = { commissionable_fee: num(fd, "commissionable_fee"), currency: str(fd, "currency") };
  const result = str(fd, "result");
  if (result && result !== "enrolled") patch.result = result;
  const { error } = await sb.from("applications").update(patch).eq("id", str(fd, "id"));
  revalidatePath(back(id));
  done(back(id), error);
}

export async function updateStage(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "case_id")!;
  const { error } = await sb.from("stage_updates").insert({
    case_id: id, application_id: str(fd, "application_id"), stage_id: str(fd, "stage_id"),
    status: str(fd, "status"), date: str(fd, "date") ?? todayBangkok(), remark: str(fd, "remark"),
  });
  revalidatePath(back(id));
  done(back(id), error);
}

export async function addFeedback(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "case_id")!;
  const { error } = await sb.from("feedback").insert({
    application_id: str(fd, "application_id"), date: str(fd, "date") ?? todayBangkok(),
    feedback: str(fd, "feedback"), action: str(fd, "action"),
  });
  revalidatePath(back(id));
  done(back(id), error);
}

export async function updateReceivable(fd: FormData) {
  const { supabase: sb } = await getMe();
  const ret = str(fd, "back") ?? "/money";
  const patch: Record<string, unknown> = { amount: num(fd, "amount"), expected_date: str(fd, "expected_date") };
  const status = str(fd, "status");
  if (status === "cancelled" || status === "paid") patch.status = status;
  const { error } = await sb.from("receivables").update(patch).eq("id", str(fd, "id"));
  revalidatePath(ret);
  done(ret, error);
}

export async function addReceivable(fd: FormData) {
  const { supabase: sb } = await getMe();
  const ret = str(fd, "back") ?? "/money";
  const payerType = str(fd, "payer_type");
  const type = str(fd, "type");
  const amt = num(fd, "amount") ?? 0;
  const { error } = await sb.from("receivables").insert({
    type, payer_type: payerType,
    school_id: payerType === "school" ? str(fd, "school_id") : null,
    partner_id: payerType === "partner" ? str(fd, "partner_id") : null,
    payer_name: payerType === "individual" ? str(fd, "payer_name") : null,
    case_id: str(fd, "case_id"), application_id: str(fd, "application_id"),
    amount: type === "refund" ? -Math.abs(amt) : amt, currency: str(fd, "currency") ?? "THB", expected_date: str(fd, "expected_date"),
  });
  revalidatePath(ret);
  done(ret, error);
}
