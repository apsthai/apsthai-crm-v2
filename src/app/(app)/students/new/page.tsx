import { Card, Field } from "@/components/ui";
import { LevelSelect, SchoolSelect, academicYears, currentAcademicYear } from "@/components/pickers";
import { getMe } from "@/lib/auth";
import { todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { loadLookups } from "@/lib/lookups";
import { createStudent } from "../actions";
import { DuplicateGuard } from "./duplicate-guard";

export default async function NewStudent() {
  const { supabase: sb } = await getMe();
  const { t, lang } = await getT();
  const lk = await loadLookups(sb);
  const ay = currentAcademicYear(todayBangkok());

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="h1">{t("newStudent")}</h1>
      <Card>
        <DuplicateGuard action={createStudent} labels={{ found: t("similarFound"), anyway: t("createAnyway"), create: t("create"), matched: t("matchedOn") }}>
          <div className="grid-form">
            <Field label={`${t("codename")} *`} hint={t("codenameHint")}><input name="codename" className="input" required /></Field>
            <Field label={`${t("nickname")} *`}><input name="nickname" className="input" required /></Field>
            <Field label={t("firstname")}><input name="firstname" className="input" /></Field>
            <Field label={t("lastname")}><input name="lastname" className="input" /></Field>
            <Field label={t("dob")}><input name="dob" type="date" className="input" /></Field>
            <Field label={t("gender")}>
              <select name="gender" className="input" defaultValue=""><option value="">-</option><option value="male">{t("male")}</option><option value="female">{t("female")}</option></select>
            </Field>
            <Field label={t("phone")}><input name="phone" className="input" inputMode="tel" /></Field>
            <Field label={t("relation")}>
              <select name="phone_relation" className="input" defaultValue="mother">
                {(["student", "father", "mother", "guardian", "other"] as const).map((r) => <option key={r} value={r}>{t(r)}</option>)}
              </select>
            </Field>
          </div>
          <h2 className="h2 mt-5">{t("education")}</h2>
          <div className="grid-form">
            <Field label={t("academicYear")}>
              <select name="academic_year" className="input" defaultValue={ay}>{academicYears(ay).map((y) => <option key={y}>{y}</option>)}</select>
            </Field>
            <Field label={t("school")}><SchoolSelect name="school_id" schools={lk.schools} /></Field>
            <Field label={t("level")}><LevelSelect name="level_id" levels={lk.levels} lang={lang} /></Field>
            <Field label={t("newSchool")}><input name="new_school" className="input" /></Field>
            <Field label={t("country")}><input name="new_school_country" className="input" defaultValue="Thailand" /></Field>
          </div>
        </DuplicateGuard>
      </Card>
    </div>
  );
}
