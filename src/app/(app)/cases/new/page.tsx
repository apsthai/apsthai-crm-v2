import { Card, Field } from "@/components/ui";
import { NamedSelect } from "@/components/pickers";
import { getMe } from "@/lib/auth";
import { todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { loadLookups } from "@/lib/lookups";
import { createCase } from "../actions";

export default async function NewCase({ searchParams }: { searchParams: Promise<{ student?: string; q?: string }> }) {
  const me = await getMe();
  const sb = me.supabase;
  const { t, lang } = await getT();
  const sp = await searchParams;
  const lk = await loadLookups(sb);
  const caseStaff = lk.staff.filter((s) => s.handles_cases);

  const { data: student } = sp.student
    ? await sb.from("students").select("id, codename").eq("id", sp.student).maybeSingle()
    : { data: null };
  const { data: found } = !student && sp.q
    ? await sb.from("students").select("id, codename").is("merged_into", null).ilike("codename", `%${sp.q.replace(/[%,()]/g, " ")}%`).limit(20)
    : { data: [] };

  if (!student) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="h1">{t("newCase")}</h1>
        <Card>
          <form className="flex gap-2"><input name="q" defaultValue={sp.q} className="input" placeholder={`${t("search")} ${t("student")}`} /><button className="btn-ghost">{t("search")}</button></form>
          <ul className="mt-3 space-y-1 text-sm">
            {(found ?? []).map((s: any) => <li key={s.id}><a className="link" href={`/cases/new?student=${s.id}`}>{s.codename}</a></li>)}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="h1">{t("newCase")}: {student.codename}</h1>
      <Card>
        <form action={createCase}>
          <input type="hidden" name="student_id" value={student.id} />
          <div className="grid-form">
            <Field label={`${t("category")} *`}><NamedSelect name="category_id" items={lk.categories} lang={lang} required /></Field>
            <Field label={`${t("intake")} *`}><input name="intake" type="month" className="input" defaultValue={todayBangkok().slice(0, 7)} required /></Field>
            <Field label={t("leadChannel")}><NamedSelect name="lead_channel_id" items={lk.channels} lang={lang} /></Field>
            <Field label={t("applicant")}>
              <select name="applicant" className="input" defaultValue="student">
                {(["student", "father", "mother", "guardian", "other"] as const).map((r) => <option key={r} value={r}>{t(r)}</option>)}
              </select>
            </Field>
            <Field label={t("applicantName")}><input name="applicant_name" className="input" /></Field>
            <Field label={t("referredBy")}><input name="referred_by" className="input" /></Field>
            <Field label={t("subAgent")}>
              <select name="sub_agent_id" className="input" defaultValue=""><option value="">-</option>
                {lk.partners.filter((p) => p.type === "sub_agent" || p.type === "individual").map((p) => <option key={p.id} value={p.id}>{p.name}{p.default_share_pct ? ` (${p.default_share_pct}%)` : ""}</option>)}
              </select>
            </Field>
            <Field label={t("subAgentPct")}><input name="sub_agent_pct" type="number" step="0.01" className="input" /></Field>
            <div />
            <Field label={t("staff")}>
              <select name="staff1" className="input" defaultValue={me.handles_cases ? me.id : ""}>
                <option value="">-</option>{caseStaff.map((s) => <option key={s.id} value={s.id}>{s.codename}</option>)}
              </select>
            </Field>
            <Field label={t("staff2")}>
              <select name="staff2" className="input" defaultValue=""><option value="">-</option>{caseStaff.map((s) => <option key={s.id} value={s.id}>{s.codename}</option>)}</select>
            </Field>
            <div />
            <Field label={t("nextAction")}><input name="next_action" className="input" /></Field>
            <Field label={t("nextActionDate")}><input name="next_action_date" type="date" className="input" /></Field>
          </div>
          <button className="btn mt-4">{t("create")}</button>
        </form>
      </Card>
    </div>
  );
}
