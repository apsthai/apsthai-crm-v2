"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { done, str } from "@/lib/actions";
import type { SupabaseClient } from "@supabase/supabase-js";

// A school picked from the list, or a new one typed in.
async function schoolId(sb: SupabaseClient, fd: FormData, prefix = "") {
  const picked = str(fd, `${prefix}school_id`);
  if (picked) return { id: picked };
  const name = str(fd, `${prefix}new_school`);
  if (!name) return { id: null };
  const { data, error } = await sb.from("schools")
    .insert({ name, country: str(fd, `${prefix}new_school_country`) ?? "Thailand", type: "thai_school" })
    .select("id").single();
  return error ? { error } : { id: data.id as string };
}

export async function createStudent(fd: FormData) {
  const { supabase: sb } = await getMe();
  const { data, error } = await sb.from("students").insert({
    codename: str(fd, "codename"), nickname: str(fd, "nickname"),
    firstname: str(fd, "firstname"), lastname: str(fd, "lastname"),
    dob: str(fd, "dob"), gender: str(fd, "gender"),
  }).select("id").single();
  if (error) done("/students/new", error);
  const id = data.id as string;

  const phone = str(fd, "phone");
  if (phone) await sb.from("contacts").insert({ student_id: id, relation: str(fd, "phone_relation") ?? "student", type: "phone", value: phone });
  const sc = await schoolId(sb, fd);
  if ("error" in sc && sc.error) done(`/students/${id}`, sc.error);
  if (sc.id || str(fd, "level_id")) {
    await sb.from("education").insert({ student_id: id, academic_year: str(fd, "academic_year"), school_id: sc.id, level_id: str(fd, "level_id") });
  }
  redirect(`/students/${id}`);
}

export async function updateStudent(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "id")!;
  const { error } = await sb.from("students").update({
    codename: str(fd, "codename"), nickname: str(fd, "nickname"),
    firstname: str(fd, "firstname"), lastname: str(fd, "lastname"),
    dob: str(fd, "dob"), gender: str(fd, "gender"),
    pdpa_consent_date: str(fd, "pdpa_consent_date"), pdpa_consent_by: str(fd, "pdpa_consent_by"),
    pdpa_consent_location: str(fd, "pdpa_consent_location"),
  }).eq("id", id);
  revalidatePath(`/students/${id}`);
  done(`/students/${id}`, error);
}

export async function addContact(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "student_id")!;
  const { error } = await sb.from("contacts").insert({
    student_id: id, relation: str(fd, "relation"), name: str(fd, "name"), type: str(fd, "type"),
    value: str(fd, "value"), purpose: str(fd, "purpose"),
  });
  revalidatePath(`/students/${id}`);
  done(`/students/${id}`, error);
}

export async function toggleContact(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "student_id")!;
  const { error } = await sb.from("contacts").update({ active: str(fd, "active") === "true" }).eq("id", str(fd, "id"));
  revalidatePath(`/students/${id}`);
  done(`/students/${id}`, error);
}

export async function addEducation(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "student_id")!;
  const sc = await schoolId(sb, fd);
  if ("error" in sc && sc.error) done(`/students/${id}`, sc.error);
  const { error } = await sb.from("education").insert({
    student_id: id, academic_year: str(fd, "academic_year"), school_id: sc.id, level_id: str(fd, "level_id"),
    start_date: str(fd, "start_date"), end_date: str(fd, "end_date"), remark: str(fd, "remark"),
  });
  revalidatePath(`/students/${id}`);
  done(`/students/${id}`, error);
}

export async function updateEducation(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "student_id")!;
  const sc = await schoolId(sb, fd);
  if ("error" in sc && sc.error) done(`/students/${id}`, sc.error);
  const { error } = await sb.from("education").update({
    academic_year: str(fd, "academic_year"), school_id: sc.id, level_id: str(fd, "level_id"),
    start_date: str(fd, "start_date"), end_date: str(fd, "end_date"), remark: str(fd, "remark"),
  }).eq("id", str(fd, "id"));
  revalidatePath(`/students/${id}`);
  done(`/students/${id}`, error);
}

export async function removeEducation(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "student_id")!;
  const { error } = await sb.from("education").delete().eq("id", str(fd, "id"));
  revalidatePath(`/students/${id}`);
  done(`/students/${id}`, error);
}

export async function addQualification(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "student_id")!;
  const { error } = await sb.from("qualifications").insert({
    student_id: id, qualification: str(fd, "qualification"), board: str(fd, "board"), subject: str(fd, "subject"),
    grade: str(fd, "grade"), result_type: str(fd, "result_type"), date: str(fd, "date"), file_location: str(fd, "file_location"),
  });
  revalidatePath(`/students/${id}`);
  done(`/students/${id}`, error);
}

export async function removeQualification(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "student_id")!;
  const { error } = await sb.from("qualifications").delete().eq("id", str(fd, "id"));
  revalidatePath(`/students/${id}`);
  done(`/students/${id}`, error);
}

export async function mergeStudent(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "id")!;
  const target = str(fd, "keep_codename");
  const { data: keep } = await sb.from("students").select("id").eq("codename", target ?? "").maybeSingle();
  if (!keep) done(`/students/${id}`, `Codename not found: ${target}`);
  const { error } = await sb.rpc("merge_students", { p_keep: keep.id, p_remove: id });
  if (error) done(`/students/${id}`, error);
  redirect(`/students/${keep.id}?ok=1`);
}

export async function anonymizeStudent(fd: FormData) {
  const { supabase: sb } = await getMe();
  const id = str(fd, "id")!;
  if (str(fd, "confirm") !== "DELETE") done(`/students/${id}`, "Type DELETE to confirm");
  const { error } = await sb.rpc("anonymize_student", { p_id: id });
  revalidatePath(`/students/${id}`);
  done(`/students/${id}`, error);
}
