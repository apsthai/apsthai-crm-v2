"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { addDays, todayBangkok } from "@/lib/dates";

const s = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

// Back to the Reminders page (keeping the staff filter) with a message. RLS decides who may change a task.
function back(fd: FormData, error?: string | null) {
  revalidatePath("/", "layout");
  const staff = s(fd, "staff");
  const q = new URLSearchParams();
  if (staff) q.set("staff", staff);
  q.set(error ? "err" : "ok", error ?? "1");
  redirect(`/reminders?${q}`);
}

type Res = { data: unknown[] | null; error: { message: string } | null };
const changed = (r: Res) => r.error?.message ?? (r.data && r.data.length ? null : "You are not allowed to change this");

export async function doneTask(fd: FormData) {
  const { supabase } = await getMe();
  const r = await supabase.from("tasks").update({ done_at: new Date().toISOString() }).eq("id", s(fd, "task_id")!).select("id");
  back(fd, changed(r));
}

// Move a task to today + N days.
export async function moveTask(fd: FormData) {
  const { supabase } = await getMe();
  const days = Number(s(fd, "days") ?? "1");
  const r = await supabase.from("tasks").update({ due_date: addDays(todayBangkok(), days) }).eq("id", s(fd, "task_id")!).select("id");
  back(fd, changed(r));
}

// The next step for a case that has none.
export async function addNextTask(fd: FormData) {
  const { supabase, me } = await getMe();
  if (!s(fd, "title")) return back(fd, "Write what needs to be done next");
  const { error } = await supabase.from("tasks").insert({
    case_id: s(fd, "case_id"), title: s(fd, "title"), due_date: s(fd, "due_date") ?? todayBangkok(),
    assigned_to: s(fd, "assigned_to") ?? me.id,
  });
  back(fd, error?.message);
}
