"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";

export type NewCaseState = { error: string | null };

const s = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

// The database does it all in one go (create_case): new student if needed, the case, and its staff.
export async function createCase(_prev: NewCaseState, fd: FormData): Promise<NewCaseState> {
  const { supabase } = await getMe();
  const isNew = s(fd, "mode") === "new";
  const intake = s(fd, "intake");
  const { data, error } = await supabase.rpc("create_case", {
    p_category_id: s(fd, "category_id"),
    p_intake: intake ? `${intake}-01` : null,
    p_student_id: isNew ? null : s(fd, "student_id"),
    p_nickname: isNew ? s(fd, "nickname") : null,
    p_firstname: isNew ? s(fd, "firstname") : null,
    p_lastname: isNew ? s(fd, "lastname") : null,
    p_contact_relation: s(fd, "relation"),
    p_phone: isNew ? s(fd, "phone") : null,
    p_line: isNew ? s(fd, "line") : null,
    p_allow_duplicate: s(fd, "allow_duplicate") === "1",
    p_lead_channel_id: s(fd, "lead_channel_id"),
    p_applicant: s(fd, "applicant") ?? "student",
    p_applicant_name: s(fd, "applicant_name"),
    p_referred_by: s(fd, "referred_by"),
    p_staff1: s(fd, "staff1"),
    p_staff2: s(fd, "staff2"),
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(`/cases/${data}?ok=1`);
}
