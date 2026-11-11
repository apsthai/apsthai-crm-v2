import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, Card } from "@/components/app-shell";
import { Field, inputCls } from "@/components/fields";
import { Flash } from "@/components/flash";
import { Submit } from "@/components/submit";
import { UndoButton } from "@/components/undo-success";
import { getMe } from "@/lib/auth";
import { daysBetween, fmtDate, fmtMonth, todayBangkok } from "@/lib/dates";
import { fmtTHB } from "@/lib/money";
import { addApplication, addFeedback, updateApplication, addStaff, addTask, closeLost, endStaff, reopenCase, setResult, toggleTask, updateCase, updateStudent } from "./actions";
import { type ChipState, StageChip } from "./stage-chip";

const CURRENCIES = ["GBP", "THB", "USD", "EUR", "AUD", "NZD", "CAD", "SGD", "CHF"];
const RELATION_WORD: Record<string, string> = { mother: "Mother", father: "Father", guardian: "Guardian", student: "Student", other: "Other" };
const APPLICANTS = [["student", "Student"], ["father", "Father"], ["mother", "Mother"], ["guardian", "Guardian"], ["other", "Other"]];
const RESULTS = [["in_progress", "In progress"], ["offered", "Offered"], ["rejected", "Rejected"], ["withdrawn", "Withdrawn"]];
const RESULT_LOOK: Record<string, string> = {
  in_progress: "bg-navy-50 text-navy", offered: "bg-emerald-50 text-emerald-700", enrolled: "bg-emerald-600 text-white",
  rejected: "bg-red-50 text-brand-red", withdrawn: "bg-slate-100 text-slate-500",
};
const money = (amount: number | null, cur: string) =>
  amount === null ? "-" : cur === "THB" ? fmtTHB(amount) : `${cur} ${Math.round(amount).toLocaleString("en-US")}`;

export default async function CasePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase: sb, me } = await getMe();
  const today = todayBangkok();
  const isAdmin = me.role === "admin";

  const { data: c, error } = await sb.from("cases")
    .select("id, intake, applicant, applicant_name, referred_by, sub_agent_pct, sub_agent_id, lead_channel_id, overall_status, overall_remark, closed_date, created_at, created_by, category_id, student:students(id, codename, nickname, firstname, lastname), category:categories(name_en, in_house), lead:lead_channels(name_en), sub_agent:partners(name)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) notFound();
  const kase = c as unknown as typeof c & {
    student: { id: string; codename: string; nickname: string; firstname: string | null; lastname: string | null }; category: { name_en: string; in_house: boolean };
    lead: { name_en: string } | null; sub_agent: { name: string } | null;
  };

  const [links, stages, latest, apps, tasks, prog, weighted, staff, teams, products, channels, partners, stageLog, otherCases, edu, contacts] = await Promise.all([
    sb.from("case_staff").select("id, staff_id, start_date, end_date, created_at").eq("case_id", id).order("start_date"),
    sb.from("stages").select("id, name_en, sort_order, level, milestone, editable_by_team_id").eq("category_id", kase.category_id).eq("active", true).order("sort_order"),
    sb.from("v_stage_latest").select("application_id, stage_id, status, date, approval").eq("case_id", id),
    sb.from("applications").select("id, programme, commissionable_fee, currency, expected_income, result, created_at, created_by, product:products(school:schools(name, type), partner:partners(name))").eq("case_id", id).order("created_at"),
    sb.from("tasks").select("id, title, due_date, assigned_to, done_at, done_by, created_at, created_by").eq("case_id", id).order("due_date"),
    sb.from("v_case_progress").select("probability_pct").eq("case_id", id).maybeSingle(),
    sb.from("v_cashflow").select("amount_thb").eq("kind", "weighted").eq("case_id", id),
    sb.from("staff").select("id, codename, handles_cases, active").order("codename"),
    sb.from("team_members").select("team_id").eq("staff_id", me.id),
    sb.from("products").select("id, school:schools(name, type), partner:partners(name)").eq("category_id", kase.category_id).eq("active", true),
    sb.from("lead_channels").select("id, name_en").eq("active", true).order("sort_order"),
    sb.from("partners").select("id, name").eq("active", true).order("name"),
    sb.from("stage_updates").select("id, application_id, stage_id, status, approval, approval_note, date, remark, created_at, created_by").eq("case_id", id).order("created_at", { ascending: false }),
    sb.from("cases").select("id, intake, overall_status, category:categories(name_en)").eq("student_id", kase.student.id).neq("id", id).order("intake"),
    sb.from("education").select("academic_year, school:schools(name), level:levels(name_en)").eq("student_id", kase.student.id).order("academic_year", { ascending: false }).limit(1),
    sb.from("contacts").select("relation, type, value").eq("student_id", kase.student.id).eq("active", true).in("type", ["phone", "line"]).order("created_at"),
  ]);

  type App = { id: string; programme: string | null; commissionable_fee: number | null; currency: string; expected_income: number | null; result: string; created_at: string; created_by: string | null;
    product: { school: { name: string; type: string } | null; partner: { name: string } | null } };
  const appRows = (apps.data ?? []) as unknown as App[];
  const appName = (a: App | undefined) => a?.product.school?.name ?? a?.product.partner?.name ?? "School";
  const appIds = appRows.map((a) => a.id);
  // Approvals and rejections (with the reason) are kept in the change log.
  const suIds = ((stageLog.data ?? []) as { id: string }[]).map((u) => u.id);
  const { data: approvalLog } = suIds.length
    ? await sb.from("change_log").select("row_id, action, new_value, changed_at, changed_by").eq("table_name", "stage_updates").in("action", ["approve", "reject"]).in("row_id", suIds)
    : { data: [] };
  // Result changes are only in the change log (admin and the case's staff can read it).
  const { data: resultLog } = appIds.length
    ? await sb.from("change_log").select("row_id, new_value, changed_at, changed_by").eq("table_name", "applications").eq("field", "result").in("row_id", appIds)
    : { data: [] };
  const { data: revertLog } = await sb.from("change_log").select("changed_at, changed_by").eq("table_name", "cases").eq("action", "revert").eq("row_id", id);
  const { data: fb } = appIds.length
    ? await sb.from("feedback").select("id, application_id, date, feedback, action, created_at, created_by").in("application_id", appIds).order("date", { ascending: false })
    : { data: [] };

  const who = new Map((staff.data ?? []).map((st) => [st.id as string, st.codename as string]));
  const linkRows = (links.data ?? []) as { id: string; staff_id: string; start_date: string; end_date: string | null; created_at: string }[];
  const current = linkRows.filter((l) => !l.end_date);
  const onCase = current.some((l) => l.staff_id === me.id);
  const everOnCase = linkRows.some((l) => l.staff_id === me.id);
  const open = ["not_started", "in_progress"].includes(kase.overall_status);
  const canEdit = isAdmin || (open && onCase); // admin can also fix closed cases
  const canMoney = isAdmin || everOnCase;
  const myTeams = new Set((teams.data ?? []).map((t) => t.team_id as string));

  type Stage = { id: string; name_en: string; level: string; milestone: string; editable_by_team_id: string | null };
  const stageRows = (stages.data ?? []) as Stage[];
  const caseStages = stageRows.filter((st) => st.level === "case");
  const appStages = stageRows.filter((st) => st.level === "application");
  const last = new Map((latest.data ?? []).map((l) => [`${l.application_id ?? ""}|${l.stage_id}`, l]));
  const stateOf = (appId: string | null, stageId: string): { state: ChipState; note?: string } => {
    const l = last.get(`${appId ?? ""}|${stageId}`);
    if (!l) return { state: "todo" };
    if (l.status === "completed" && l.approval === "pending") return { state: "pending", note: `Waiting for approval · ${fmtDate(l.date)}` };
    if (l.status === "completed") return { state: "done", note: `Done ${fmtDate(l.date)}` };
    if (l.status === "in_progress") return { state: "now", note: `In progress since ${fmtDate(l.date)}` };
    if (l.status === "skipped") return { state: "skip", note: "Skipped" };
    if (l.status === "failed") return { state: "fail", note: `Failed ${fmtDate(l.date)}` };
    return { state: "todo" };
  };
  const canStage = (st: Stage) => open && (canEdit || (st.editable_by_team_id !== null && myTeams.has(st.editable_by_team_id)));

  const single = appStages.length === 0 ? appRows.find((a) => a.product.school?.type !== "in_house") : undefined;
  const chance = prog.data ? Math.round(Number(prog.data.probability_pct)) : 0;
  const weightedTHB = (weighted.data ?? []).reduce((a, r) => a + Number(r.amount_thb), 0);
  const { data: recv } = canMoney
    ? await sb.from("receivables").select("id, type, payer_name, amount, currency, expected_date, status, school:schools(name), partner:partners(name), payment_lines(amount)").eq("case_id", id).order("expected_date")
    : { data: [] };

  const taskRows = (tasks.data ?? []) as { id: string; title: string; due_date: string; assigned_to: string | null; done_at: string | null; done_by: string | null; created_at: string; created_by: string | null }[];
  const openTasks = taskRows.filter((t) => !t.done_at);
  const doneTasks = taskRows.filter((t) => t.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!));
  const fbRows = (fb ?? []) as { id: string; application_id: string; date: string; feedback: string; action: string | null; created_at: string; created_by: string | null }[];
  const stageName = new Map(stageRows.map((st) => [st.id, st.name_en]));
  const appById = new Map(appRows.map((a) => [a.id, a]));
  const handlers = (staff.data ?? []).filter((st) => st.handles_cases && st.active && !current.some((l) => l.staff_id === st.id));
  const assignable = current.length ? current.map((l) => l.staff_id) : [me.id];

  // History, newest first, built from what happened on the case.
  const STATUS_WORD: Record<string, string> = { completed: "completed", in_progress: "in progress", skipped: "skipped", failed: "failed", not_started: "not started" };
  const history = [
    ...((stageLog.data ?? []) as { id: string; application_id: string | null; stage_id: string; status: string; approval: string; remark: string | null; created_at: string; created_by: string | null }[])
      .map((u) => ({ at: u.created_at, by: u.created_by, what: `${u.application_id ? `${appName(appById.get(u.application_id))}: ` : ""}${stageName.get(u.stage_id) ?? "Stage"} ${STATUS_WORD[u.status] ?? u.status}${u.approval === "pending" ? " (waiting for approval)" : u.approval === "approved" ? " (approved)" : ""}${u.remark ? ` · ${u.remark}` : ""}` })),
    ...appRows.map((a) => ({ at: a.created_at, by: a.created_by, what: `School added: ${appName(a)}` })),
    ...((resultLog ?? []) as { row_id: string; new_value: string; changed_at: string; changed_by: string | null }[])
      .map((r) => ({ at: r.changed_at, by: r.changed_by, what: `${appName(appById.get(r.row_id))}: result ${r.new_value.replace("_", " ")}` })),
    ...((approvalLog ?? []) as { row_id: string; action: string; new_value: string | null; changed_at: string; changed_by: string | null }[])
      .map((l) => ({ at: l.changed_at, by: l.changed_by, what: l.action === "approve" ? "Success approved" : `Success rejected: ${l.new_value ?? ""}` })),
    ...((revertLog ?? []) as { changed_at: string; changed_by: string | null }[])
      .map((l) => ({ at: l.changed_at, by: l.changed_by, what: "Success undone, case back in progress" })),
    ...taskRows.map((t) => ({ at: t.created_at, by: t.created_by, what: `Task added: ${t.title}` })),
    ...doneTasks.map((t) => ({ at: t.done_at!, by: t.done_by, what: `Task done: ${t.title}` })),
    ...fbRows.map((f) => ({ at: f.created_at, by: f.created_by, what: `Feedback on ${appName(appById.get(f.application_id))}: ${f.feedback}` })),
    ...linkRows.map((l) => ({ at: l.created_at, by: null, what: `${who.get(l.staff_id)} assigned to the case from ${fmtDate(l.start_date)}` })),
    { at: kase.created_at as string, by: kase.created_by as string | null, what: "Case created" },
  ].sort((a, b) => b.at.localeCompare(a.at));
  const when = (ts: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));

  const statusPill = kase.overall_status === "success" ? ["Successful", "bg-emerald-50 text-emerald-700"]
    : kase.overall_status === "fail" ? ["Lost", "bg-red-50 text-brand-red"]
    : kase.overall_status === "in_progress" ? ["In progress", "bg-navy-50 text-navy"] : ["Not started", "bg-slate-100 text-slate-600"];
  const edu0 = (edu.data ?? [])[0] as unknown as { academic_year: string; school: { name: string } | null; level: { name_en: string } | null } | undefined;
  const contactRows = (contacts.data ?? []) as { relation: string; type: string; value: string }[];
  const phone = contactRows.find((x) => x.type === "phone");
  const line = contactRows.find((x) => x.type === "line");
  const canEditStudent = isAdmin || onCase;

  return (
    <AppShell name={me.codename} active="/cases">
      <Link href="/cases" className="text-sm text-navy hover:underline">← Cases</Link>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-600">{kase.student.codename}</span>
          <h1 className="text-[26px] leading-tight font-semibold text-slate-900">{kase.category.name_en} · {fmtMonth(kase.intake)}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${statusPill[1]}`}>{statusPill[0]}</span>
            {open && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">Chance {chance}%</span>}
            <span className="text-slate-500">Staff: {current.map((l) => who.get(l.staff_id)).join(", ") || "nobody yet"}</span>
          </div>
        </div>
        {canEdit && open && (
          <details className="group relative">
            <summary className="cursor-pointer list-none rounded-lg border border-red-300 bg-white px-3.5 py-2 text-sm text-brand-red hover:bg-red-50">Close as lost</summary>
            <form action={closeLost} className="absolute right-0 z-20 mt-2 flex w-80 flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
              <input type="hidden" name="case_id" value={id} />
              <Field label="Why was the case lost? (required)">
                <textarea name="reason" required rows={3} className={inputCls} placeholder="e.g. Chose another agent, budget, did not get a place" />
              </Field>
              <Submit variant="danger">Close as lost</Submit>
            </form>
          </details>
        )}
        {isAdmin && kase.overall_status === "success" && <UndoButton caseId={id} back={`/cases/${id}`} />}
        {isAdmin && kase.overall_status === "fail" && (
          <form action={reopenCase}><input type="hidden" name="case_id" value={id} /><Submit variant="ghost">Reopen case</Submit></form>
        )}
      </div>

      {!open && isAdmin && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This case is closed. Only admin can edit it. Stages stay locked. Changing staff on a successful case splits its points again among the new staff.
        </p>
      )}

      {(() => {
        // Show a rejection only while it is still the latest update of its stage (stageLog is newest first).
        const seen = new Set<string>();
        const rej = ((stageLog.data ?? []) as { approval_note: string | null; approval: string; status: string; stage_id: string; application_id: string | null }[])
          .filter((u) => { const k = `${u.application_id ?? ""}|${u.stage_id}`; if (seen.has(k)) return false; seen.add(k); return true; })
          .find((u) => u.approval_note && u.approval === "not_required" && u.status !== "completed");
        return rej && open ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-brand-red">
            Admin did not approve {rej.application_id ? `${appName(appById.get(rej.application_id))}: ` : ""}{stageName.get(rej.stage_id)}. Reason: {rej.approval_note}
          </p>
        ) : null;
      })()}

      {kase.overall_status === "fail" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-brand-red">Lost on {fmtDate(kase.closed_date)}: {kase.overall_remark}</p>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">

          {caseStages.length > 0 && (
            <Card title={appStages.length ? "Case stages" : "Stages"} sub={appStages.length ? "Before applying to schools" : undefined}>
              <div className="flex flex-wrap gap-2">
                {caseStages.map((st) => {
                  const s = stateOf(null, st.id);
                  return <StageChip key={st.id} big caseId={id} stageId={st.id} name={st.name_en} state={s.state} note={s.note}
                    success={st.milestone === "success"} canEdit={canStage(st)} today={today} />;
                })}
              </div>
            </Card>
          )}

          {appStages.length > 0 && (
            <Card title="Schools applied to" sub={canEdit && open ? "Each school moves through its own stages. Click a stage to update it." : undefined}>
              <div className="flex flex-col gap-3.5">
                {appRows.length === 0 && <p className="text-sm text-slate-400">No school yet.</p>}
                {appRows.map((a) => {
                  const fbs = fbRows.filter((f) => f.application_id === a.id);
                  const dim = a.result === "rejected" || a.result === "withdrawn";
                  return (
                    <div key={a.id} className={`rounded-xl border border-slate-200 p-4 ${dim ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap justify-between gap-2">
                        <div>
                          <div className="text-[15px] font-semibold">{appName(a)}{a.programme && <span className="font-normal text-slate-500"> · {a.programme}</span>}</div>
                          {canMoney && (
                            <div className="text-[13px] text-slate-500">
                              Fee {money(a.commissionable_fee, a.currency)} · expected income {money(a.expected_income, a.currency)} incl. VAT
                            </div>
                          )}
                        </div>
                        {canEdit && a.result !== "enrolled" ? (
                          <form action={setResult} className="flex items-center gap-1.5 self-start">
                            <input type="hidden" name="case_id" value={id} />
                            <input type="hidden" name="application_id" value={a.id} />
                            <select name="result" defaultValue={a.result} aria-label="Result" className={`rounded-full border-0 px-3 py-1 text-xs font-semibold ${RESULT_LOOK[a.result]}`}>
                              {RESULTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                            <Submit variant="ghost" className="!px-2.5 !py-1 text-xs">Set</Submit>
                          </form>
                        ) : (
                          <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${RESULT_LOOK[a.result]}`}>{a.result === "enrolled" ? "Enrolled" : RESULTS.find((r) => r[0] === a.result)?.[1]}</span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {appStages.map((st) => {
                          const s = stateOf(a.id, st.id);
                          return <StageChip key={st.id} caseId={id} applicationId={a.id} stageId={st.id} name={st.name_en} state={s.state}
                            success={st.milestone === "success"} canEdit={canStage(st) && !dim} today={today} />;
                        })}
                      </div>
                      {canEdit && (
                        <details className="mt-2 text-[13px]">
                          <summary className="cursor-pointer text-navy">Edit programme and fee</summary>
                          <form action={updateApplication} className="mt-2 flex flex-wrap items-end gap-2">
                            <input type="hidden" name="case_id" value={id} />
                            <input type="hidden" name="application_id" value={a.id} />
                            <Field label="Programme" className="flex-[2_1_180px]"><input name="programme" defaultValue={a.programme ?? ""} className={inputCls} /></Field>
                            <Field label="Fee the commission is based on" className="flex-[1_1_140px]"><input name="fee" inputMode="decimal" defaultValue={a.commissionable_fee ?? ""} className={inputCls} /></Field>
                            <Field label="Currency"><select name="currency" defaultValue={a.currency} className={inputCls}>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
                            <Submit variant="ghost">Save</Submit>
                          </form>
                        </details>
                      )}
                      {fbs[0] && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">{fmtDate(fbs[0].date)} · {fbs[0].feedback}{fbs[0].action ? ` · Next: ${fbs[0].action}` : ""}</div>}
                      {(fbs.length > 1 || canEdit) && (
                        <details className="mt-2 text-[13px]">
                          <summary className="cursor-pointer text-navy">{fbs.length > 1 ? `All feedback (${fbs.length})` : "Add feedback"}</summary>
                          <div className="mt-2 flex flex-col gap-1.5">
                            {fbs.slice(1).map((f) => <div key={f.id} className="text-slate-600">{fmtDate(f.date)} · {f.feedback}{f.action ? ` · Next: ${f.action}` : ""}</div>)}
                            {canEdit && (
                              <form action={addFeedback} className="mt-1 flex flex-wrap gap-2">
                                <input type="hidden" name="case_id" value={id} />
                                <input type="hidden" name="application_id" value={a.id} />
                                <input name="feedback" placeholder="What the school said" aria-label="Feedback" className={`${inputCls} flex-[2_1_220px] !w-auto`} />
                                <input name="action" placeholder="Next step (optional)" aria-label="Next step" className={`${inputCls} flex-[1_1_160px] !w-auto`} />
                                <input type="date" name="date" defaultValue={today} aria-label="Date" className={`${inputCls} !w-auto`} />
                                <Submit variant="ghost">Add</Submit>
                              </form>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
                {canEdit && (
                  <details className="text-sm">
                    <summary className="inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-2 font-medium text-navy hover:border-navy">+ Add school</summary>
                    <form action={addApplication} className="mt-3 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="case_id" value={id} />
                      <Field label="School" className="flex-[2_1_240px]">
                        <select name="product_id" required className={inputCls} defaultValue="">
                          <option value="" disabled>Choose a school</option>
                          {((products.data ?? []) as unknown as { id: string; school: { name: string; type: string } | null; partner: { name: string } | null }[])
                            .filter((p) => p.school?.type !== "in_house")
                            .map((p) => ({ id: p.id, name: p.school?.name ?? p.partner?.name ?? "?" }))
                            .sort((x, y) => x.name.localeCompare(y.name))
                            .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Programme" className="flex-[1_1_160px]">
                        <input name="programme" placeholder="e.g. Year 12" className={inputCls} />
                      </Field>
                      <Field label="Fee the commission is based on" className="flex-[1_1_160px]">
                        <input name="fee" inputMode="decimal" placeholder="e.g. 52000" className={inputCls} />
                      </Field>
                      <Field label="Currency">
                        <select name="currency" defaultValue="GBP" className={inputCls}>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select>
                      </Field>
                      <Submit>Add school</Submit>
                    </form>
                  </details>
                )}
              </div>
            </Card>
          )}

          <Card title="Tasks">
            {taskRows.length === 0 && <p className="text-sm text-slate-400">No tasks yet.</p>}
            <div className="flex flex-col">
              {[...openTasks, ...doneTasks].map((t) => {
                const late = !t.done_at && t.due_date < today;
                const due = t.done_at ? `Done ${fmtDate(t.done_at.slice(0, 10))}` : t.due_date === today ? "Today" : late ? `${daysBetween(t.due_date, today)} days late` : fmtDate(t.due_date);
                const mayTick = canEdit || (open && t.assigned_to === me.id);
                return (
                  <form key={t.id} action={toggleTask} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 py-2.5 text-sm">
                    <input type="hidden" name="case_id" value={id} />
                    <input type="hidden" name="task_id" value={t.id} />
                    <input type="hidden" name="done" value={t.done_at ? "0" : "1"} />
                    <button type="submit" disabled={!mayTick} aria-label={t.done_at ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`}
                      className={`flex size-5 items-center justify-center rounded border text-xs ${t.done_at ? "border-navy bg-navy text-white" : "border-slate-400 bg-white"} ${mayTick ? "hover:border-navy" : "opacity-50"}`}>
                      {t.done_at ? "✓" : ""}
                    </button>
                    <span className={`min-w-0 flex-[1_1_240px] ${t.done_at ? "text-slate-400 line-through" : ""}`}>{t.title}</span>
                    <span className={`text-[13px] ${late ? "font-semibold text-brand-red" : t.due_date === today && !t.done_at ? "font-semibold text-navy" : "text-slate-500"}`}>{due}</span>
                    <span className="w-16 text-[13px] text-slate-500">{t.assigned_to ? who.get(t.assigned_to) : ""}</span>
                  </form>
                );
              })}
            </div>
            {canEdit && (
              <form action={addTask} className="mt-3.5 flex flex-wrap gap-2">
                <input type="hidden" name="case_id" value={id} />
                <input name="title" placeholder="New task, e.g. Send deposit invoice details" aria-label="New task" className={`${inputCls} flex-[1_1_240px] !w-auto`} />
                <input type="date" name="due_date" defaultValue={today} aria-label="Due date" className={`${inputCls} !w-auto`} />
                <select name="assigned_to" aria-label="Assign to" className={`${inputCls} !w-auto`} defaultValue={assignable.includes(me.id) ? me.id : assignable[0]}>
                  {assignable.map((sid) => <option key={sid} value={sid}>{who.get(sid)}</option>)}
                </select>
                <Submit>Add task</Submit>
              </form>
            )}
          </Card>

          <Card title="History">
            <div className="flex flex-col gap-2">
              {history.slice(0, 40).map((h, i) => (
                <div key={i} className="text-[13px] text-slate-600"><span className="text-slate-400">{when(h.at)} · {h.by ? who.get(h.by) : "System"}</span> · {h.what}</div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <Card title="Case details">
            {[
              ["Service", kase.category.name_en], ["Intake", fmtMonth(kase.intake)],
              ["Client", kase.applicant === "student" ? "Student" : `${APPLICANTS.find((x) => x[0] === kase.applicant)?.[1]}${kase.applicant_name ? ` (${kase.applicant_name})` : ""}`],
              ["Lead source", kase.lead?.name_en ?? "-"], ["Referred by", kase.referred_by ?? "-"],
              ["Sub-agent", kase.sub_agent ? `${kase.sub_agent.name} · ${kase.sub_agent_pct ?? 0}%` : "-"],
              // Services without per-school stages show their one provider here instead of a "Schools" card.
              ...(single ? [["Provider", appName(single)], ["Programme", single.programme ?? "-"]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0"><span className="text-slate-500">{k}</span><span className="text-right">{v}</span></div>
            ))}
            {canEdit && single && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-navy">Edit programme</summary>
                <form action={updateApplication} className="mt-3 flex flex-col gap-2.5">
                  <input type="hidden" name="case_id" value={id} />
                  <input type="hidden" name="application_id" value={single.id} />
                  <input type="hidden" name="fee" value={single.commissionable_fee ?? ""} />
                  <input type="hidden" name="currency" value={single.currency} />
                  <Field label="Programme"><input name="programme" defaultValue={single.programme ?? ""} className={inputCls} /></Field>
                  <Submit>Save</Submit>
                </form>
              </details>
            )}
            {canEdit && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-navy">Edit case</summary>
                <form action={updateCase} className="mt-3 flex flex-col gap-2.5">
                  <input type="hidden" name="case_id" value={id} />
                  <Field label="Intake"><input type="month" name="intake" defaultValue={kase.intake.slice(0, 7)} className={inputCls} /></Field>
                  <Field label="Lead source">
                    <select name="lead_channel_id" defaultValue={kase.lead_channel_id ?? ""} className={inputCls}>
                      <option value="">-</option>
                      {(channels.data ?? []).map((ch) => <option key={ch.id} value={ch.id}>{ch.name_en}</option>)}
                    </select>
                  </Field>
                  <Field label="Client">
                    <select name="applicant" defaultValue={kase.applicant} className={inputCls}>{APPLICANTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  </Field>
                  <Field label="Client name (if not the student)"><input name="applicant_name" defaultValue={kase.applicant_name ?? ""} className={inputCls} /></Field>
                  <Field label="Referred by"><input name="referred_by" defaultValue={kase.referred_by ?? ""} className={inputCls} /></Field>
                  <div className="flex gap-2">
                    <Field label="Sub-agent" className="flex-1">
                      <select name="sub_agent_id" defaultValue={kase.sub_agent_id ?? ""} className={inputCls}>
                        <option value="">-</option>
                        {(partners.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Share %" className="w-24"><input name="sub_agent_pct" inputMode="decimal" defaultValue={kase.sub_agent_pct ?? ""} className={inputCls} /></Field>
                  </div>
                  <Submit>Save</Submit>
                </form>
              </details>
            )}
          </Card>

          <Card title="Staff" sub="Up to 2 people. Points and commission are split equally.">
            {linkRows.map((l) => (
              <div key={l.id} className={`flex items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm last:border-0 ${l.end_date ? "text-slate-400" : ""}`}>
                <span>{who.get(l.staff_id)}</span>
                <span className="flex items-center gap-2 text-[13px] text-slate-500">
                  {l.end_date ? `${fmtDate(l.start_date)} to ${fmtDate(l.end_date)}` : `since ${fmtDate(l.start_date)}`}
                  {isAdmin && !l.end_date && (
                    <form action={endStaff}><input type="hidden" name="case_id" value={id} /><input type="hidden" name="link_id" value={l.id} />
                      <button className="text-brand-red hover:underline">Remove</button></form>
                  )}
                </span>
              </div>
            ))}
            {canEdit && current.length < 2 && (
              <form action={addStaff} className="mt-2.5 flex gap-2">
                <input type="hidden" name="case_id" value={id} />
                <select name="staff_id" aria-label="Add staff" className={`${inputCls} flex-1`} defaultValue="">
                  <option value="" disabled>Add a person</option>
                  {handlers.map((h) => <option key={h.id} value={h.id}>{h.codename}</option>)}
                </select>
                <Submit variant="ghost">Add</Submit>
              </form>
            )}
          </Card>

          {canMoney && (
            <Card title="Money" sub={(recv ?? []).length ? "Amounts to collect for this case, incl. VAT" : "Estimate incl. VAT until the student enrols. Amounts to collect are created then."}>
              {(recv ?? []).length === 0 ? (
                <>
                  {appRows.filter((a) => a.expected_income !== null && !["rejected", "withdrawn"].includes(a.result)).map((a) => (
                    <div key={a.id} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{appName(a)}</span><span>{money(a.expected_income, a.currency)}</span></div>
                  ))}
                  <div className="flex justify-between pt-2.5 text-sm font-semibold"><span>Expected × chance, incl. VAT</span><span>{fmtTHB(weightedTHB)}</span></div>
                </>
              ) : (
                ((recv ?? []) as unknown as { id: string; type: string; payer_name: string | null; amount: number; currency: string; expected_date: string; status: string; school: { name: string } | null; partner: { name: string } | null; payment_lines: { amount: number }[] }[]).map((r) => (
                  <div key={r.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
                    <span>{r.school?.name ?? r.partner?.name ?? r.payer_name} <span className="block text-[13px] text-slate-500">{r.type.replace("_", " ")} · due {fmtDate(r.expected_date)}</span></span>
                    <span className="text-right">{money(Number(r.amount), r.currency)} <span className="block text-[13px] text-slate-500">{r.status.replace("_", " ")}</span></span>
                  </div>
                ))
              )}
            </Card>
          )}

          <Card title="Student">
            <div className="text-sm">{kase.student.codename}</div>
            {edu0 && <div className="text-[13px] text-slate-500">{edu0.level?.name_en ?? ""} · {edu0.school?.name ?? ""} ({edu0.academic_year})</div>}
            {kase.student.lastname && <div className="text-[13px] text-slate-500">Last name: {kase.student.lastname}</div>}
            {phone && <div className="mt-1.5 text-[13px] text-slate-500">{RELATION_WORD[phone.relation] ?? phone.relation} · {phone.value}</div>}
            {line && <div className="text-[13px] text-slate-500">{RELATION_WORD[line.relation] ?? line.relation} · LINE {line.value}</div>}
            {canEditStudent && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-navy">Edit student</summary>
                <form action={updateStudent} className="mt-3 flex flex-col gap-2.5">
                  <input type="hidden" name="case_id" value={id} />
                  <input type="hidden" name="student_id" value={kase.student.id} />
                  <Field label="Nickname *"><input name="nickname" defaultValue={kase.student.nickname} required className={inputCls} /></Field>
                  <Field label="First name *"><input name="firstname" defaultValue={kase.student.firstname ?? ""} required className={inputCls} /></Field>
                  <Field label="Last name"><input name="lastname" defaultValue={kase.student.lastname ?? ""} className={inputCls} /></Field>
                  <Field label="Contact person">
                    <select name="relation" defaultValue={(phone ?? line)?.relation ?? "mother"} className={inputCls}>
                      {Object.entries(RELATION_WORD).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Phone"><input name="phone" inputMode="tel" defaultValue={phone?.value ?? ""} className={inputCls} /></Field>
                  <Field label="LINE ID"><input name="line" defaultValue={line?.value ?? ""} className={inputCls} /></Field>
                  <Submit>Save</Submit>
                </form>
              </details>
            )}
            {(otherCases.data ?? []).length > 0 && (
              <div className="mt-2 text-[13px] text-slate-500">Other cases:{" "}
                {((otherCases.data ?? []) as unknown as { id: string; intake: string; category: { name_en: string } }[]).map((o, i) => (
                  <span key={o.id}>{i ? ", " : ""}<Link href={`/cases/${o.id}`} className="text-navy hover:underline">{o.category.name_en} · {fmtMonth(o.intake)}</Link></span>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
