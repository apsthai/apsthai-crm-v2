import { notFound } from "next/navigation";
import { A, Card, Empty, Field, Pill } from "@/components/ui";
import { NamedSelect } from "@/components/pickers";
import { getMe } from "@/lib/auth";
import { CURRENCIES, fmtDate, fmtMoney, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { loadLookups } from "@/lib/lookups";
import {
  addApplication, addCaseStaff, addFeedback, addReceivable, closeCaseFailed, endCaseStaff, reopenCase,
  updateApplication, updateCase, updateReceivable, updateStage,
} from "../actions";

type Stage = { id: string; name_th: string; name_en: string; sort_order: number; level: string; milestone: string; editable_by_team_id: string | null };

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  const sb = me.supabase;
  const { t, n, lang } = await getT();
  const today = todayBangkok();
  const isAdmin = me.role === "admin";

  const { data: c } = await sb.from("cases")
    .select("*, student:students(id, codename), category:categories(id, name_th, name_en, in_house), channel:lead_channels(name_th, name_en), sub_agent:partners(name)")
    .eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ data: staff }, { data: apps }, { data: stages }, { data: latest }, { data: updates }, { data: recs }, { data: products }, { data: myCase }, { data: myTeams }, lk] = await Promise.all([
    sb.from("case_staff").select("id, start_date, end_date, staff(id, codename)").eq("case_id", id).order("start_date"),
    sb.from("applications").select("*, product:products(id, school:schools(name), partner:partners(name)), feedback(*)").eq("case_id", id).order("created_at"),
    sb.from("stages").select("id, name_th, name_en, sort_order, level, milestone, editable_by_team_id").eq("category_id", c.category_id).eq("active", true).order("sort_order"),
    sb.from("v_stage_latest").select("*").eq("case_id", id),
    sb.from("stage_updates").select("id, application_id, stage_id, status, date, remark, approval, created_at, created_by").eq("case_id", id).order("created_at", { ascending: false }).limit(100),
    sb.from("receivables").select("*, school:schools(name), partner:partners(name)").eq("case_id", id).order("expected_date"),
    sb.from("products").select("id, school:schools(name), partner:partners(name)").eq("category_id", c.category_id).eq("active", true),
    sb.rpc("my_case", { p_case: id }),
    sb.from("team_members").select("team_id").eq("staff_id", me.id),
    loadLookups(sb),
  ]);

  const editable = isAdmin || Boolean(myCase);
  const teamIds = new Set((myTeams ?? []).map((x: any) => x.team_id));
  const canStage = (s: Stage) => editable || (s.editable_by_team_id !== null && teamIds.has(s.editable_by_team_id));
  const staffName = new Map(lk.staff.map((s) => [s.id, s.codename]));
  const stageById = new Map((stages ?? []).map((s: Stage) => [s.id, s]));
  const latestOf = (stageId: string, appId: string | null) =>
    (latest ?? []).find((l: any) => l.stage_id === stageId && (l.application_id ?? null) === appId);
  const caseStages = (stages ?? []).filter((s: Stage) => s.level === "case");
  const appStages = (stages ?? []).filter((s: Stage) => s.level === "application");
  const productName = (p: any) => p?.school?.name ?? p?.partner?.name ?? "-";
  const activeStaff = (staff ?? []).filter((s: any) => !s.end_date);

  const stageRow = (s: Stage, appId: string | null) => {
    const l: any = latestOf(s.id, appId);
    const status = l?.approval === "pending" ? "pending" : l?.status ?? "not_started";
    return (
      <tr key={`${s.id}-${appId}`}>
        <td className="whitespace-nowrap">{n(s)}{s.milestone === "success" ? " ★" : ""}</td>
        <td><Pill status={status} label={t(status)} /> <span className="text-xs text-slate-500">{fmtDate(l?.date, lang)}</span></td>
        <td className="text-xs text-slate-600">{l?.remark}</td>
        <td>{canStage(s) && c.overall_status !== "success" && (
          <form action={updateStage} className="flex flex-wrap gap-1">
            <input type="hidden" name="case_id" value={id} />
            <input type="hidden" name="stage_id" value={s.id} />
            {appId && <input type="hidden" name="application_id" value={appId} />}
            <select name="status" className="input w-auto py-1" defaultValue={l?.status === "completed" ? "completed" : "in_progress"}>
              {["in_progress", "completed", "skipped", "failed", "not_started"].map((x) => <option key={x} value={x}>{t(x)}</option>)}
            </select>
            <input type="date" name="date" defaultValue={today} className="input w-auto py-1" />
            <input name="remark" placeholder={t("remark")} className="input w-40 py-1" />
            <button className="btn-ghost py-1">{t("update")}</button>
          </form>
        )}</td>
      </tr>
    );
  };

  const recIds = (recs ?? []).map((r: any) => r.id);
  const logIds = [id, ...(apps ?? []).map((a: any) => a.id), ...(updates ?? []).map((u: any) => u.id), ...recIds, ...(staff ?? []).map((s: any) => s.id)];
  const { data: log } = await sb.from("change_log").select("id, table_name, action, field, old_value, new_value, changed_by, changed_at")
    .in("row_id", logIds).neq("action", "insert").order("changed_at", { ascending: false }).limit(60);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="muted"><A href={`/students/${c.student.id}`}>{c.student.codename}</A></p>
          <h1 className="h1">{n(c.category)} · {c.intake?.slice(0, 7)}</h1>
          <p className="mt-1"><Pill status={c.overall_status} label={t(c.overall_status)} />{c.overall_remark && <span className="ml-2 text-sm text-slate-600">{c.overall_remark}</span>}</p>
        </div>
        {editable && c.overall_status !== "success" && (
          c.overall_status === "fail" ? (
            <form action={reopenCase}><input type="hidden" name="id" value={id} /><button className="btn-ghost">{t("reopen")}</button></form>
          ) : (
            <form action={closeCaseFailed} className="flex gap-2">
              <input type="hidden" name="id" value={id} />
              <input name="overall_remark" placeholder={t("reason")} className="input" required />
              <button className="btn-danger whitespace-nowrap">{t("failCase")}</button>
            </form>
          )
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t("cases")} className="lg:col-span-2">
          <form action={updateCase}>
            <input type="hidden" name="id" value={id} />
            <fieldset disabled={!editable} className="grid-form">
              <Field label={t("intake")}><input name="intake" type="month" className="input" defaultValue={c.intake?.slice(0, 7)} required /></Field>
              <Field label={t("leadChannel")}><NamedSelect name="lead_channel_id" items={lk.channels} value={c.lead_channel_id} lang={lang} /></Field>
              <Field label={t("referredBy")}><input name="referred_by" className="input" defaultValue={c.referred_by ?? ""} /></Field>
              <Field label={t("applicant")}>
                <select name="applicant" className="input" defaultValue={c.applicant}>
                  {(["student", "father", "mother", "guardian", "other"] as const).map((r) => <option key={r} value={r}>{t(r)}</option>)}
                </select>
              </Field>
              <Field label={t("applicantName")}><input name="applicant_name" className="input" defaultValue={c.applicant_name ?? ""} /></Field>
              <div />
              <Field label={t("subAgent")}>
                <select name="sub_agent_id" className="input" defaultValue={c.sub_agent_id ?? ""}><option value="">-</option>
                  {lk.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label={t("subAgentPct")}><input name="sub_agent_pct" type="number" step="0.01" className="input" defaultValue={c.sub_agent_pct ?? ""} /></Field>
              <div />
              <Field label={t("nextAction")}><input name="next_action" className="input" defaultValue={c.next_action ?? ""} /></Field>
              <Field label={t("nextActionDate")}><input name="next_action_date" type="date" className="input" defaultValue={c.next_action_date ?? ""} /></Field>
            </fieldset>
            {editable && <button className="btn mt-3">{t("save")}</button>}
          </form>
        </Card>

        <Card title={t("staff")}>
          <ul className="space-y-2 text-sm">
            {(staff ?? []).map((s: any) => (
              <li key={s.id} className={`flex items-center justify-between gap-2 ${s.end_date ? "text-slate-400" : ""}`}>
                <span>{s.staff.codename} <span className="text-xs">{fmtDate(s.start_date, lang)}{s.end_date ? ` - ${fmtDate(s.end_date, lang)}` : ""}</span></span>
                {isAdmin && !s.end_date && (
                  <form action={endCaseStaff}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="case_id" value={id} />
                    <button className="text-xs text-red-700 hover:underline">{t("removeStaff")}</button></form>
                )}
              </li>
            ))}
          </ul>
          {editable && activeStaff.length < 2 && (
            <form action={addCaseStaff} className="mt-3 flex gap-2">
              <input type="hidden" name="case_id" value={id} />
              <select name="staff_id" className="input" required>
                <option value="">-</option>
                {lk.staff.filter((s) => s.handles_cases && !activeStaff.some((a: any) => a.staff.id === s.id)).map((s) => <option key={s.id} value={s.id}>{s.codename}</option>)}
              </select>
              <button className="btn-ghost whitespace-nowrap">{t("addStaff")}</button>
            </form>
          )}
        </Card>
      </div>

      {caseStages.length > 0 && (
        <Card title={t("stages")}>
          <div className="overflow-x-auto"><table className="tbl"><tbody>{caseStages.map((s: Stage) => stageRow(s, null))}</tbody></table></div>
        </Card>
      )}

      {!c.category.in_house && (
        <Card title={t("applications")}>
          {!apps?.length && <Empty text={t("none")} />}
          <div className="space-y-4">
            {(apps ?? []).map((a: any) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{productName(a.product)} <Pill status={a.result} label={t(a.result)} /></h3>
                  <span className="text-sm text-slate-600">{t("expectedIncome")}: {fmtMoney(a.expected_income, a.currency ?? "THB") || "-"}</span>
                </div>
                {editable && (
                  <form action={updateApplication} className="mb-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={a.id} /><input type="hidden" name="case_id" value={id} />
                    <Field label={t("fee")}><input name="commissionable_fee" type="number" step="0.01" className="input w-40" defaultValue={a.commissionable_fee ?? ""} /></Field>
                    <Field label={t("currency")}>
                      <select name="currency" className="input w-24" defaultValue={a.currency ?? "GBP"}>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select>
                    </Field>
                    {a.result !== "enrolled" && (
                      <Field label={t("result")}>
                        <select name="result" className="input w-36" defaultValue={a.result}>
                          {["in_progress", "offered", "rejected", "withdrawn"].map((x) => <option key={x} value={x}>{t(x)}</option>)}
                        </select>
                      </Field>
                    )}
                    <button className="btn-ghost">{t("save")}</button>
                  </form>
                )}
                <div className="overflow-x-auto"><table className="tbl"><tbody>{appStages.map((s: Stage) => stageRow(s, a.id))}</tbody></table></div>
                {a.result === "enrolled" && (
                  <div className="mt-3">
                    <h4 className="mb-1 text-sm font-semibold">{t("feedback")}</h4>
                    <ul className="mb-2 space-y-1 text-sm">
                      {(a.feedback ?? []).map((f: any) => <li key={f.id}>{fmtDate(f.date, lang)}: {f.feedback}{f.action ? ` → ${f.action}` : ""}</li>)}
                    </ul>
                    {editable && (
                      <form action={addFeedback} className="flex flex-wrap gap-2">
                        <input type="hidden" name="case_id" value={id} /><input type="hidden" name="application_id" value={a.id} />
                        <input type="date" name="date" defaultValue={today} className="input w-auto" />
                        <input name="feedback" placeholder={t("feedback")} className="input flex-1" required />
                        <input name="action" placeholder={t("action")} className="input flex-1" />
                        <button className="btn-ghost">{t("add")}</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {editable && c.overall_status !== "success" && (
            products?.length ? (
              <form action={addApplication} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="case_id" value={id} />
                <Field label={t("product")}>
                  <select name="product_id" className="input" required><option value="">-</option>
                    {products.map((p: any) => <option key={p.id} value={p.id}>{productName(p)}</option>)}
                  </select>
                </Field>
                <Field label={t("fee")}><input name="commissionable_fee" type="number" step="0.01" className="input w-40" /></Field>
                <Field label={t("currency")}><select name="currency" className="input w-24" defaultValue="GBP">{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
                <button className="btn">{t("addApplication")}</button>
              </form>
            ) : <p className="mt-3 text-sm text-amber-700">{t("noProduct")}</p>
          )}
        </Card>
      )}

      {c.category.in_house && (apps ?? []).length > 0 && appStages.length > 0 && (
        <Card title={t("stages")}>
          <div className="overflow-x-auto"><table className="tbl"><tbody>{appStages.map((s: Stage) => stageRow(s, apps![0].id))}</tbody></table></div>
        </Card>
      )}

      {(recs?.length || isAdmin) ? (
        <Card title={t("receivables")}>
          {!recs?.length ? <Empty text={t("none")} /> : (
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th>{t("type")}</th><th>{t("payer")}</th><th>{t("amount")}</th><th>{t("expectedDate")}</th><th>{t("status")}</th><th /></tr></thead>
              <tbody>{recs.map((r: any) => (
                <tr key={r.id}>
                  <td>{t(r.type)}</td>
                  <td>{r.school?.name ?? r.partner?.name ?? r.payer_name}</td>
                  {editable && ["expected", "invoiced"].includes(r.status) ? (
                    <td colSpan={2}>
                      <form action={updateReceivable} className="flex flex-wrap gap-1">
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={`/cases/${id}`} />
                        <input name="amount" type="number" step="0.01" className="input w-32 py-1" defaultValue={r.amount} />
                        <span className="self-center text-xs">{r.currency}</span>
                        <input name="expected_date" type="date" className="input w-auto py-1" defaultValue={r.expected_date} />
                        <button className="btn-ghost py-1">{t("save")}</button>
                        {isAdmin && <button name="status" value="cancelled" className="btn-danger py-1">{t("cancelled")}</button>}
                      </form>
                    </td>
                  ) : (<><td>{fmtMoney(r.amount, r.currency)}</td><td>{fmtDate(r.expected_date, lang)}</td></>)}
                  <td><Pill status={r.status} label={t(r.status)} /></td>
                  <td />
                </tr>))}</tbody>
            </table></div>
          )}
          {isAdmin && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm link">{t("addReceivable")}</summary>
              <form action={addReceivable} className="mt-2 grid gap-2 sm:grid-cols-4">
                <input type="hidden" name="case_id" value={id} /><input type="hidden" name="back" value={`/cases/${id}`} />
                <select name="type" className="input">{["commission", "service_fee", "refund"].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select>
                <select name="payer_type" className="input">{["school", "partner", "individual"].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select>
                <select name="school_id" className="input"><option value="">{t("school")}</option>{lk.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select name="partner_id" className="input"><option value="">{t("partner")}</option>{lk.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input name="payer_name" placeholder={t("individual")} className="input" />
                <select name="application_id" className="input"><option value="">-</option>{(apps ?? []).map((a: any) => <option key={a.id} value={a.id}>{productName(a.product)}</option>)}</select>
                <input name="amount" type="number" step="0.01" placeholder={t("amount")} className="input" required />
                <select name="currency" className="input">{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select>
                <input name="expected_date" type="date" className="input" defaultValue={today} required />
                <button className="btn-ghost">{t("add")}</button>
              </form>
            </details>
          )}
        </Card>
      ) : null}

      <Card title={t("history")}>
        <ul className="space-y-1 text-xs text-slate-600">
          {(updates ?? []).map((u: any) => (
            <li key={u.id}>{fmtDate(u.date, lang)} · {staffName.get(u.created_by) ?? "-"} · {n(stageById.get(u.stage_id))} → {t(u.status)}{u.approval !== "not_required" ? ` (${t(u.approval)})` : ""}{u.remark ? ` · ${u.remark}` : ""}</li>
          ))}
          {(log ?? []).map((l: any) => (
            <li key={l.id} className="text-slate-400">{l.changed_at.slice(0, 16).replace("T", " ")} · {staffName.get(l.changed_by) ?? "system"} · {l.table_name}.{l.field ?? l.action}: {l.old_value ?? ""} → {l.new_value ?? ""}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
