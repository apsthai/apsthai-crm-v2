"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { done, str } from "@/lib/actions";

export async function decide(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const { error } = await sb.rpc("approve_success", { p_stage_update_id: str(fd, "id"), p_approve: str(fd, "approve") === "true" });
  revalidatePath("/approvals");
  done("/approvals", error);
}

export async function revert(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const { error } = await sb.rpc("revert_success", { p_case_id: str(fd, "case_id") });
  revalidatePath("/approvals");
  done("/approvals", error);
}
