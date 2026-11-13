"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { todayBangkok } from "@/lib/dates";

const s = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const n = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === null ? null : Number(v.replace(/,/g, ""));
};

type Res = { data: unknown[] | null; error: { message: string } | null };
const changed = (r: Res) => r.error ?? (r.data && r.data.length ? null : "You are not allowed to change this");

// Every action ends here: back to the case with a message.
function back(caseId: string, error?: { message: string } | null | string) {
  revalidatePath(`/cases/${caseId}`);
  const msg = typeof error === "string" ? error : error?.message;
  redirect(`/cases/${caseId}?${msg ? `err=${encodeURIComponent(msg)}` : "ok=1"}`);
}

export async function updateStage(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const status = s(fd, "status");
  if (!status) return back(caseId, "Choose a status");
  const { error } = await supabase.from("stage_updates").insert({
    case_id: caseId, application_id: s(fd, "application_id"), stage_id: s(fd, "stage_id"),
    status, date: s(fd, "date") ?? todayBangkok(), remark: s(fd, "remark"),
  });
  back(caseId, error);
}

export async function addApplication(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  if (!s(fd, "product_id")) return back(caseId, "Choose a school");
  if (s(fd, "product_id") === "__new__") {
    // A school not in the list: the database adds it with the default 10% contract and puts it on the case.
    const { error } = await supabase.rpc("add_new_school", {
      p_case_id: caseId, p_name: s(fd, "school_name"), p_country: s(fd, "country"), p_type: s(fd, "school_type"),
      p_currency: s(fd, "currency") ?? "GBP", p_programme: s(fd, "programme"), p_fee: n(fd, "fee"),
    });
    return back(caseId, error);
  }
  const { error } = await supabase.from("applications").insert({
    case_id: caseId, product_id: s(fd, "product_id"), programme: s(fd, "programme"), commissionable_fee: n(fd, "fee"), currency: s(fd, "currency") ?? "GBP",
  });
  back(caseId, error);
}

export async function setResult(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const r = await supabase.from("applications").update({ result: s(fd, "result") }).eq("id", s(fd, "application_id")!).select("id");
  back(caseId, changed(r));
}

export async function addFeedback(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  if (!s(fd, "feedback")) return back(caseId, "Write the feedback first");
  const { error } = await supabase.from("feedback").insert({
    application_id: s(fd, "application_id"), date: s(fd, "date") ?? todayBangkok(), feedback: s(fd, "feedback"), action: s(fd, "action"),
  });
  back(caseId, error);
}

export async function addTask(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  if (!s(fd, "title")) return back(caseId, "Write what needs to be done");
  const { error } = await supabase.from("tasks").insert({
    case_id: caseId, title: s(fd, "title"), due_date: s(fd, "due_date") ?? todayBangkok(), assigned_to: s(fd, "assigned_to"),
  });
  back(caseId, error);
}

export async function toggleTask(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const done = s(fd, "done") === "1";
  const r = await supabase.from("tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", s(fd, "task_id")!).select("id");
  back(caseId, changed(r));
}

export async function updateCase(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const intake = s(fd, "intake");
  const subAgent = s(fd, "sub_agent_id");
  const { data, error } = await supabase.from("cases").update({
    intake: intake ? `${intake}-01` : undefined,
    lead_channel_id: s(fd, "lead_channel_id"),
    applicant: s(fd, "applicant") ?? "student",
    applicant_name: s(fd, "applicant_name"),
    referred_by: s(fd, "referred_by"),
    sub_agent_id: subAgent,
    sub_agent_pct: subAgent ? n(fd, "sub_agent_pct") : null,
  }).eq("id", caseId).select("id");
  back(caseId, changed({ data, error }));
}

export async function addStaff(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  if (!s(fd, "staff_id")) return back(caseId, "Choose a person");
  const { error } = await supabase.from("case_staff").insert({ case_id: caseId, staff_id: s(fd, "staff_id") });
  back(caseId, error);
}

export async function endStaff(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const r = await supabase.from("case_staff").update({ end_date: todayBangkok() }).eq("id", s(fd, "link_id")!).select("id");
  back(caseId, changed(r));
}

export async function closeLost(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const reason = s(fd, "reason");
  if (!reason) return back(caseId, "Write why the case was lost");
  const r = await supabase.from("cases").update({ overall_status: "fail", overall_remark: reason }).eq("id", caseId).select("id");
  back(caseId, changed(r));
}

// Admin only (RLS and the status guard allow it): undo a "lost" by mistake.
export async function reopenCase(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const r = await supabase.from("cases").update({ overall_status: "in_progress", overall_remark: null }).eq("id", caseId).select("id");
  back(caseId, changed(r));
}

export async function updateApplication(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const r = await supabase.from("applications").update({
    programme: s(fd, "programme"), commissionable_fee: n(fd, "fee"), currency: s(fd, "currency") ?? "GBP",
  }).eq("id", s(fd, "application_id")!).select("id");
  back(caseId, changed(r));
}

// Names and the main contact (one phone, one LINE). An empty field removes that contact.
export async function updateStudent(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const studentId = s(fd, "student_id")!;
  if (!s(fd, "nickname") || !s(fd, "firstname")) return back(caseId, "Enter the nickname and first name");
  const r = await supabase.from("students").update({
    nickname: s(fd, "nickname"), firstname: s(fd, "firstname"), lastname: s(fd, "lastname"),
  }).eq("id", studentId).select("id");
  const e = changed(r);
  if (e) return back(caseId, e);

  const relation = s(fd, "relation") ?? "mother";
  for (const type of ["phone", "line"] as const) {
    const value = s(fd, type);
    const { data: cur } = await supabase.from("contacts").select("id").eq("student_id", studentId).eq("type", type).eq("active", true).order("created_at").limit(1);
    const row = cur?.[0];
    const res = row && value ? await supabase.from("contacts").update({ value, relation }).eq("id", row.id)
      : row ? await supabase.from("contacts").update({ active: false }).eq("id", row.id)
      : value ? await supabase.from("contacts").insert({ student_id: studentId, relation, type, value })
      : null;
    if (res?.error) return back(caseId, res.error);
  }
  back(caseId);
}

// Admin only: delete a case made by mistake (the database refuses successful cases and cases with money).
export async function deleteCase(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const { error } = await supabase.rpc("delete_case", { p_case_id: caseId });
  if (error) return back(caseId, error);
  revalidatePath("/", "layout");
  redirect("/cases?deleted=1");
}

export async function updateTask(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  if (!s(fd, "title")) return back(caseId, "Write what needs to be done");
  const r = await supabase.from("tasks").update({
    title: s(fd, "title"), due_date: s(fd, "due_date") ?? todayBangkok(), assigned_to: s(fd, "assigned_to"),
  }).eq("id", s(fd, "task_id")!).select("id");
  back(caseId, changed(r));
}

export async function deleteTask(fd: FormData) {
  const { supabase } = await getMe();
  const caseId = s(fd, "case_id")!;
  const r = await supabase.from("tasks").delete().eq("id", s(fd, "task_id")!).select("id");
  back(caseId, changed(r));
}
