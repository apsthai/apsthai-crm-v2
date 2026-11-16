import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getMe } from "@/lib/auth";
import { fmtMonth, todayBangkok } from "@/lib/dates";
import { educationLookups } from "@/lib/education";
import { NewCaseForm, type StudentOption } from "./new-case-form";

export default async function NewCasePage() {
  const { supabase: sb, me } = await getMe();
  const [students, cats, channels, staff, edu] = await Promise.all([
    sb.from("students").select("id, codename, nickname, firstname, lastname, cases(id, intake, overall_status, category_id, category:categories(name_en))")
      .is("merged_into", null).is("anonymized_at", null).order("codename"),
    sb.from("categories").select("id, name_en").eq("active", true).order("sort_order"),
    sb.from("lead_channels").select("id, name_en").eq("active", true).order("sort_order"),
    sb.from("staff").select("id, codename").eq("handles_cases", true).eq("active", true).order("codename"),
    educationLookups(sb),
  ]);
  if (students.error) throw new Error(students.error.message);

  type Row = { id: string; codename: string; nickname: string; firstname: string | null; lastname: string | null;
    cases: { id: string; intake: string; overall_status: string; category_id: string; category: { name_en: string } }[] };
  const options: StudentOption[] = ((students.data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, codename: r.codename, nickname: r.nickname, firstname: r.firstname, lastname: r.lastname,
    cases: r.cases.sort((a, b) => a.intake.localeCompare(b.intake)).map((c) => `${c.category.name_en} · ${fmtMonth(c.intake)}`),
    caseKeys: r.cases.map((c) => ({ id: c.id, categoryId: c.category_id, intake: c.intake.slice(0, 7), status: c.overall_status,
      label: `${c.category.name_en} · ${fmtMonth(c.intake)}` })),
  }));

  return (
    <AppShell active="/cases">
      <div>
        <Link href="/cases" className="text-sm text-navy hover:underline">← Cases</Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">New case</h1>
      </div>
      <NewCaseForm
        students={options}
        services={(cats.data ?? []) as { id: string; name_en: string }[]}
        channels={(channels.data ?? []) as { id: string; name_en: string }[]}
        staff={(staff.data ?? []) as { id: string; codename: string }[]}
        me={{ id: me.id, codename: me.codename, isAdmin: me.role === "admin" }}
        thisYear={Number(todayBangkok().slice(0, 4))}
        schoolNames={edu.schoolNames}
        levels={edu.levels}
      />
    </AppShell>
  );
}
