// The student's current school and year, kept per academic year (July to June, as roll_education() in the database).
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayBangkok } from "./dates";

export function academicYear(today = todayBangkok()) {
  const y = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) >= 7 ? 0 : 1);
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

export type LevelOpt = { id: string; system: string; name_en: string };

export async function educationLookups(sb: SupabaseClient) {
  const [schools, levels] = await Promise.all([
    sb.from("schools").select("name").eq("active", true).in("type", ["thai_school", "boarding_school", "other"]).order("name"),
    sb.from("levels").select("id, system, name_en").eq("active", true).order("system").order("sort_order"),
  ]);
  return { schoolNames: (schools.data ?? []).map((s) => s.name as string), levels: (levels.data ?? []) as LevelOpt[] };
}

// Blank school and year leave things as they are. A school not in the list is added (as a school in Thailand).
export async function saveCurrentEducation(sb: SupabaseClient, studentId: string, schoolName: string | null, levelId: string | null) {
  if (!schoolName && !levelId) return null;
  let schoolId: string | null = null;
  if (schoolName) {
    const { data: found } = await sb.from("schools").select("id").ilike("name", schoolName.replace(/[%_]/g, "\\$&")).limit(1);
    if (found?.length) schoolId = found[0].id;
    else {
      const ins = await sb.from("schools").insert({ name: schoolName, country: "Thailand", type: "thai_school" }).select("id").single();
      if (ins.error) return ins.error.message;
      schoolId = ins.data.id;
    }
  }
  const year = academicYear();
  const { data: cur } = await sb.from("education").select("id, school_id, level_id").eq("student_id", studentId).eq("academic_year", year)
    .order("created_at", { ascending: false }).limit(1);
  const row = { school_id: schoolId ?? cur?.[0]?.school_id ?? null, level_id: levelId ?? cur?.[0]?.level_id ?? null };
  const res = cur?.length
    ? await sb.from("education").update(row).eq("id", cur[0].id)
    : await sb.from("education").insert({ student_id: studentId, academic_year: year, ...row });
  return res.error?.message ?? null;
}
