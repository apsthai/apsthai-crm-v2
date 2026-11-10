"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";

const s = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

// Back to where the button was (approvals page or a case page) with the result.
function back(fd: FormData, error?: { message: string } | null) {
  const to = s(fd, "back") ?? "/approvals";
  revalidatePath("/", "layout");
  redirect(`${to}${to.includes("?") ? "&" : "?"}${error ? `err=${encodeURIComponent(error.message)}` : "ok=1"}`);
}

export async function approve(fd: FormData) {
  const { supabase } = await getMe();
  const { error } = await supabase.rpc("approve_success", { p_stage_update_id: s(fd, "id"), p_approve: true });
  back(fd, error);
}

export async function reject(fd: FormData) {
  const { supabase } = await getMe();
  const { error } = await supabase.rpc("approve_success", { p_stage_update_id: s(fd, "id"), p_approve: false, p_note: s(fd, "reason") });
  back(fd, error);
}

export async function undoSuccess(fd: FormData) {
  const { supabase } = await getMe();
  const { error } = await supabase.rpc("revert_success", { p_case_id: s(fd, "case_id") });
  back(fd, error);
}
