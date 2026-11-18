"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { saveCurrentEducation } from "@/lib/education";
import { pdpaLocation } from "@/lib/pdpa";

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
  if (isNew && /[()（）]/.test(s(fd, "nickname") ?? "")) return { error: "Nickname only, no brackets" };
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
  // Current school and year, if given, go on the student's record for this academic year.
  let eduErr: string | null = null;
  const { data: kase } = await supabase.from("cases").select("student_id").eq("id", data).single();
  if (kase && (s(fd, "current_school") || s(fd, "current_level"))) {
    eduErr = await saveCurrentEducation(supabase, kase.student_id, s(fd, "current_school"), s(fd, "current_level"));
  }
  // PDPA consent for a new student, if it was given already.
  if (kase && isNew && s(fd, "pdpa_by")) {
    const p = await supabase.from("students").update({
      pdpa_consent_date: s(fd, "pdpa_date"), pdpa_consent_by: s(fd, "pdpa_by"),
      pdpa_consent_location: pdpaLocation(s(fd, "pdpa_how"), s(fd, "pdpa_note")),
    }).eq("id", kase.student_id);
    if (p.error) eduErr = eduErr ?? `PDPA consent: ${p.error.message}`;
  }
  revalidatePath("/", "layout");
  redirect(`/cases/${data}?${eduErr ? `err=${encodeURIComponent(`Case created, but this was not saved: ${eduErr}`)}` : "ok=1"}`);
}
