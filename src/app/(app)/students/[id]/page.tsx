import Link from "next/link";
import { notFound } from "next/navigation";
import { A, Card, Empty, Field, Pill } from "@/components/ui";
import { LevelSelect, SchoolSelect, academicYears, currentAcademicYear } from "@/components/pickers";
import { getMe } from "@/lib/auth";
import { fmtDate, fmtMonth, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { loadLookups } from "@/lib/lookups";
import {
  addContact, addEducation, addQualification, anonymizeStudent, mergeStudent, removeEducation,
  removeQualification, toggleContact, updateEducation, updateStudent,
} from "../actions";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  const sb = me.supabase;
  const { t, n, lang } = await getT();

  const [{ data: s }, { data: contacts }, { data: edu }, { data: quals }, { data: cases }, lk, { data: canEdit }] = await Promise.all([
    sb.from("students").select("*, merged:merged_into(id, codename)").eq("id", id).maybeSingle(),
    sb.from("contacts").select("*").eq("student_id", id).order("created_at"),
    sb.from("education").select("*, school:schools(name), level:levels(name_th, name_en)").eq("student_id", id).order("academic_year", { ascending: false }).order("start_date", { ascending: false, nullsFirst: false }),
    sb.from("qualifications").select("*").eq("student_id", id).order("date", { ascending: false }),
    sb.from("cases").select("id, intake, overall_status, applicant, applicant_name, category:categories(name_th, name_en), case_staff(end_date, staff:staff!case_staff_staff_id_fkey(codename))").eq("student_id", id).order("intake", { ascending: false }),
    loadLookups(sb),
    sb.rpc("my_student", { p_student: id }),
  ]);
  if (!s) notFound();
  const editable = me.role === "admin" || Boolean(canEdit);
  const ay = currentAcademicYear(todayBangkok());
  const years = academicYears(ay);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="h1">{s.codename}</h1>
          {s.merged && <p className="muted">{t("mergedInto")} <A href={`/students/${s.merged.id}`}>{s.merged.codename}</A></p>}
        </div>
        <Link href={`/cases/new?student=${id}`} className="btn">{t("newCase")}</Link>
      </div>

      <Card title={t("cases")}>
        {!cases?.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("category")}</th><th>{t("intake")}</th><th>{t("applicant")}</th><th>{t("staff")}</th><th>{t("overall")}</th></tr></thead>
            <tbody>{cases.map((c: any) => (
              <tr key={c.id}>
                <td><A href={`/cases/${c.id}`}>{n(c.category)}</A></td>
                <td>{fmtMonth(c.intake, lang)}</td>
                <td>{t(c.applicant)}{c.applicant_name ? ` (${c.applicant_name})` : ""}</td>
                <td>{c.case_staff.filter((x: any) => !x.end_date).map((x: any) => x.staff.codename).join(", ")}</td>
                <td><Pill status={c.overall_status} label={t(c.overall_status)} /></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>

      <Card title={t("students")}>
        <form action={updateStudent}>
          <input type="hidden" name="id" value={id} />
          <fieldset disabled={!editable} className="grid-form">
            <Field label={t("codename")}><input name="codename" className="input" defaultValue={s.codename} required /></Field>
            <Field label={t("nickname")}><input name="nickname" className="input" defaultValue={s.nickname} required /></Field>
            <Field label={t("firstname")}><input name="firstname" className="input" defaultValue={s.firstname ?? ""} /></Field>
            <Field label={t("lastname")}><input name="lastname" className="input" defaultValue={s.lastname ?? ""} /></Field>
            <Field label={t("dob")}><input name="dob" type="date" className="input" defaultValue={s.dob ?? ""} /></Field>
            <Field label={t("gender")}>
              <select name="gender" className="input" defaultValue={s.gender ?? ""}><option value="">-</option><option value="male">{t("male")}</option><option value="female">{t("female")}</option></select>
            </Field>
            <Field label={t("pdpaDate")}><input name="pdpa_consent_date" type="date" className="input" defaultValue={s.pdpa_consent_date ?? ""} /></Field>
            <Field label={t("pdpaBy")}><input name="pdpa_consent_by" className="input" defaultValue={s.pdpa_consent_by ?? ""} /></Field>
            <Field label={t("pdpaLocation")}><input name="pdpa_consent_location" className="input" defaultValue={s.pdpa_consent_location ?? ""} /></Field>
          </fieldset>
          {editable && <button className="btn mt-3">{t("save")}</button>}
        </form>
      </Card>

      <Card title={t("contacts")}>
        {!contacts?.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("relation")}</th><th>{t("name")}</th><th>{t("type")}</th><th>{t("value")}</th><th>{t("purpose")}</th><th /></tr></thead>
            <tbody>{contacts.map((c: any) => (
              <tr key={c.id} className={c.active ? "" : "text-slate-400 line-through"}>
                <td>{t(c.relation)}</td><td>{c.name}</td><td>{c.type}</td><td>{c.value}</td><td>{c.purpose}</td>
                <td>{editable && (
                  <form action={toggleContact}>
                    <input type="hidden" name="id" value={c.id} /><input type="hidden" name="student_id" value={id} />
                    <input type="hidden" name="active" value={String(!c.active)} />
                    <button className="text-xs link">{c.active ? t("switchOff") : t("switchOn")}</button>
                  </form>)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        {editable && (
          <form action={addContact} className="mt-3 grid gap-2 sm:grid-cols-6">
            <input type="hidden" name="student_id" value={id} />
            <select name="relation" className="input" defaultValue="mother">
              {(["student", "father", "mother", "guardian", "other"] as const).map((r) => <option key={r} value={r}>{t(r)}</option>)}
            </select>
            <input name="name" placeholder={t("name")} className="input" />
            <select name="type" className="input"><option value="phone">phone</option><option value="email">email</option><option value="line">LINE</option></select>
            <input name="value" placeholder={t("value")} className="input" required />
            <input name="purpose" placeholder={t("purpose")} className="input" />
            <button className="btn-ghost">{t("add")}</button>
          </form>
        )}
      </Card>

      <Card title={t("education")}>
        {!edu?.length ? <Empty text={t("none")} /> : (
          <div className="space-y-2">
            {edu.map((e: any) => editable ? (
              <form key={e.id} action={updateEducation} className="grid items-end gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-7">
                <input type="hidden" name="id" value={e.id} /><input type="hidden" name="student_id" value={id} />
                <select name="academic_year" className="input" defaultValue={e.academic_year}>
                  {[...new Set([e.academic_year, ...years])].sort().map((y) => <option key={y}>{y}</option>)}
                </select>
                <SchoolSelect name="school_id" schools={lk.schools} value={e.school_id} />
                <LevelSelect name="level_id" levels={lk.levels} value={e.level_id} lang={lang} />
                <input type="date" name="start_date" className="input" defaultValue={e.start_date ?? ""} title={t("startDate")} />
                <input type="date" name="end_date" className="input" defaultValue={e.end_date ?? ""} title={t("endDate")} />
                <input name="remark" className="input" defaultValue={e.remark ?? ""} placeholder={t("remark")} />
                <div className="flex gap-1">
                  <button className="btn-ghost">{t("save")}</button>
                  <button formAction={removeEducation} className="btn-danger">{t("remove")}</button>
                </div>
              </form>
            ) : (
              <p key={e.id} className="text-sm">{e.academic_year} · {e.school?.name ?? "-"} · {n(e.level)} {e.remark ? `· ${e.remark}` : ""}</p>
            ))}
          </div>
        )}
        {editable && (
          <form action={addEducation} className="mt-3 grid items-end gap-2 sm:grid-cols-4">
            <input type="hidden" name="student_id" value={id} />
            <Field label={t("academicYear")}><select name="academic_year" className="input" defaultValue={ay}>{years.map((y) => <option key={y}>{y}</option>)}</select></Field>
            <Field label={t("school")}><SchoolSelect name="school_id" schools={lk.schools} /></Field>
            <Field label={t("level")}><LevelSelect name="level_id" levels={lk.levels} lang={lang} /></Field>
            <Field label={t("remark")}><input name="remark" className="input" /></Field>
            <Field label={t("newSchool")}><input name="new_school" className="input" /></Field>
            <Field label={t("country")}><input name="new_school_country" className="input" defaultValue="Thailand" /></Field>
            <Field label={t("startDate")}><input type="date" name="start_date" className="input" /></Field>
            <button className="btn-ghost">{t("add")}</button>
          </form>
        )}
      </Card>

      <Card title={t("qualifications")}>
        {!quals?.length ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("qualification")}</th><th>{t("board")}</th><th>{t("subject")}</th><th>{t("grade")}</th><th>{t("resultType")}</th><th>{t("date")}</th><th>{t("fileLocation")}</th><th /></tr></thead>
            <tbody>{quals.map((q: any) => (
              <tr key={q.id}>
                <td>{q.qualification}</td><td>{q.board}</td><td>{q.subject}</td><td>{q.grade}</td><td>{t(q.result_type)}</td>
                <td>{fmtDate(q.date, lang)}</td><td>{q.file_location}</td>
                <td>{editable && (
                  <form action={removeQualification}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="student_id" value={id} />
                    <button className="text-xs text-red-700 hover:underline">{t("remove")}</button></form>)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        {editable && (
          <form action={addQualification} className="mt-3 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <input type="hidden" name="student_id" value={id} />
            <input name="qualification" placeholder={t("qualification")} className="input" required />
            <input name="board" placeholder={t("board")} className="input" />
            <input name="subject" placeholder={t("subject")} className="input" />
            <input name="grade" placeholder={t("grade")} className="input" />
            <select name="result_type" className="input"><option value="actual">{t("actual")}</option><option value="predicted">{t("predicted")}</option></select>
            <input name="date" type="date" className="input" />
            <input name="file_location" placeholder={t("fileLocation")} className="input" />
            <button className="btn-ghost">{t("add")}</button>
          </form>
        )}
      </Card>

      {me.role === "admin" && !s.anonymized_at && (
        <Card title={t("admin")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <form action={mergeStudent} className="space-y-2">
              <input type="hidden" name="id" value={id} />
              <Field label={t("merge")} hint={t("mergeHint")}><input name="keep_codename" className="input" placeholder={t("codename")} required /></Field>
              <button className="btn-ghost">{t("merge")}</button>
            </form>
            <form action={anonymizeStudent} className="space-y-2">
              <input type="hidden" name="id" value={id} />
              <Field label={t("anonymize")} hint={t("anonymizeHint")}><input name="confirm" className="input" placeholder="DELETE" required /></Field>
              <button className="btn-danger">{t("anonymize")}</button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
