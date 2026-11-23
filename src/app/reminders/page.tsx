import Link from "next/link";
import { AppShell, Card, Tile } from "@/components/app-shell";
import { DatePick } from "@/components/date-pick";
import { inputCls } from "@/components/fields";
import { Flash } from "@/components/flash";
import { Submit } from "@/components/submit";
import { getMe, seesAll } from "@/lib/auth";
import { addDays, daysBetween, fmtDate, fmtMonth, todayBangkok } from "@/lib/dates";
import { addNextTask, doneTask, moveTask } from "./actions";

// Reminders (owner-approved idea, 23 Nov 2026): tasks by due date, active cases with no next step, cases left untouched.
// Staff see their own; admin and viewer see everyone or one person. A task more than 7 days late is flagged for Admin.
const ACTIVE = ["not_started", "in_progress"];
const LATE_FOR_ADMIN = 7;
const QUIET_DAYS = 14;

type CaseInfo = { id: string; intake: string | null; overall_status: string; updated_at: string; student: { codename: string }; category: { name_en: string } };
type TaskRow = { id: string; title: string; due_date: string; assigned_to: string | null; case: CaseInfo };

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ staff?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { supabase: sb, me } = await getMe();
  const all = seesAll(me);
  const today = todayBangkok();
  const soon = addDays(today, 7);

  const [staffRes, taskRes, caseRes, linkRes, progRes, upRes, openRes] = await Promise.all([
    sb.from("staff").select("id, codename").eq("active", true).eq("handles_cases", true).order("codename"),
    sb.from("tasks").select("id, title, due_date, assigned_to, case:cases(id, intake, overall_status, updated_at, student:students(codename), category:categories(name_en))")
      .is("done_at", null).lte("due_date", soon).order("due_date"),
    sb.from("cases").select("id, intake, overall_status, updated_at, student:students(codename), category:categories(name_en)").in("overall_status", ACTIVE),
    sb.from("case_staff").select("case_id, staff_id").is("end_date", null),
    sb.from("v_case_progress").select("case_id, furthest_stage_en"),
    sb.from("stage_updates").select("case_id, created_at").order("created_at", { ascending: false }),
    sb.from("tasks").select("case_id, updated_at").is("done_at", null),
  ]);
  for (const r of [staffRes, taskRes, caseRes, linkRes, progRes, upRes, openRes]) if (r.error) throw new Error(r.error.message);

  const staff = (staffRes.data ?? []) as { id: string; codename: string }[];
  const who = new Map(staff.map((x) => [x.id, x.codename]));
  // Whose reminders: staff always their own; admin and viewer everyone, or one person.
  const scope = all ? (staff.some((x) => x.id === sp.staff) ? sp.staff! : null) : me.id;

  const links = (linkRes.data ?? []) as { case_id: string; staff_id: string }[];
  const staffOf = new Map<string, string[]>();
  for (const l of links) staffOf.set(l.case_id, [...(staffOf.get(l.case_id) ?? []), l.staff_id]);
  const stage = new Map((progRes.data ?? []).map((p) => [p.case_id as string, (p.furthest_stage_en as string) ?? "Not started"]));
  const lastStage = new Map<string, string>();
  for (const u of (upRes.data ?? []) as { case_id: string; created_at: string }[]) if (!lastStage.has(u.case_id)) lastStage.set(u.case_id, u.created_at);
  const withTask = new Set(((openRes.data ?? []) as { case_id: string }[]).map((t) => t.case_id));

  const tasks = ((taskRes.data ?? []) as unknown as TaskRow[]).filter((t) => !scope || t.assigned_to === scope);
  const late = tasks.filter((t) => t.due_date < today);
  const dueToday = tasks.filter((t) => t.due_date === today);
  const next = tasks.filter((t) => t.due_date > today);
  const veryLate = late.filter((t) => daysBetween(t.due_date, today) > LATE_FOR_ADMIN);

  const myCases = ((caseRes.data ?? []) as unknown as CaseInfo[]).filter((c) => !scope || (staffOf.get(c.id) ?? []).includes(scope));
  const lastTouch = (c: CaseInfo) => [c.updated_at, lastStage.get(c.id) ?? ""].sort().reverse()[0].slice(0, 10);
  const noNext = myCases.filter((c) => !withTask.has(c.id));
  const quiet = myCases.filter((c) => daysBetween(lastTouch(c), today) >= QUIET_DAYS)
    .sort((a, b) => lastTouch(a).localeCompare(lastTouch(b)));

  const caseLine = (c: CaseInfo) => `${c.category.name_en} · ${c.intake ? fmtMonth(c.intake) : "no intake"} · ${stage.get(c.id) ?? "Not started"}`;
  const hidden = <><input type="hidden" name="staff" value={all && scope ? scope : ""} /></>;

  const taskList = (rows: TaskRow[], empty: string) => {
    if (!rows.length) return <p className="py-2 text-sm text-slate-400">{empty}</p>;
    return (
      <div className="flex flex-col">
        {rows.map((t) => {
          const d = daysBetween(t.due_date, today);
          const label = d > 0 ? `${d} ${d === 1 ? "day" : "days"} late` : d === 0 ? "Today" : fmtDate(t.due_date);
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 py-3 text-sm">
              <form action={doneTask} className="contents">
                {hidden}<input type="hidden" name="task_id" value={t.id} />
                <button type="submit" aria-label={`Mark "${t.title}" as done`} title="Mark as done"
                  className="flex size-5 flex-none items-center justify-center rounded border border-slate-400 bg-white text-xs hover:border-navy" />
              </form>
              <div className="min-w-0 flex-[1_1_260px]">
                <div className="font-medium">{t.title}</div>
                <div className="text-[13px] text-slate-500">
                  <Link href={`/cases/${t.case.id}`} className="text-navy hover:underline">{t.case.student.codename}</Link> · {caseLine(t.case)}
                </div>
              </div>
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${d > 0 ? "bg-red-50 text-brand-red" : d === 0 ? "bg-navy-50 text-navy" : "text-slate-500"}`}>{label}</span>
              {d > LATE_FOR_ADMIN && <span className="rounded-md bg-brand-red px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white">Over a week · Admin sees it</span>}
              {!scope && <span className="w-16 text-[13px] text-slate-500">{t.assigned_to ? who.get(t.assigned_to) ?? "" : ""}</span>}
              <div className="flex gap-1.5">
                {[[1, "+1 day"], [7, "+1 week"]].map(([days, text]) => (
                  <form key={days} action={moveTask}>
                    {hidden}<input type="hidden" name="task_id" value={t.id} /><input type="hidden" name="days" value={days} />
                    <button type="submit" data-edit title={`Move to ${fmtDate(addDays(today, Number(days)))}`}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-navy hover:border-navy">{text}</button>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AppShell active="/reminders">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reminders</h1>
          <p className="mt-1 text-sm text-slate-500">
            {scope ? (scope === me.id ? "Your tasks and cases" : `Tasks and cases of ${who.get(scope)}`) : "Everyone's tasks and cases"} · every active case should have a next task with a due date
          </p>
        </div>
        {all && (
          <form action="/reminders" className="flex items-center gap-2 text-sm">
            <select name="staff" defaultValue={scope ?? ""} aria-label="Staff" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5">
              <option value="">Everyone</option>
              {staff.map((x) => <option key={x.id} value={x.id}>{x.codename}</option>)}
            </select>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-navy">Show</button>
          </form>
        )}
      </div>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="flex flex-wrap gap-3">
        <Tile label="Late" value={String(late.length)} sub={veryLate.length ? `${veryLate.length} over a week` : "Past the due date"} tone={late.length ? "red" : "ink"} />
        <Tile label="Due today" value={String(dueToday.length)} sub={`${next.length} more in the next 7 days`} tone={dueToday.length ? "navy" : "ink"} />
        <Tile label="No next step" value={String(noNext.length)} sub="Active cases with no open task" tone={noNext.length ? "red" : "ink"} />
        <Tile label={`Untouched ${QUIET_DAYS} days`} value={String(quiet.length)} sub="Active cases with no update" />
      </div>

      <Card title="Late and today" sub="Oldest first. Tick when done, or move it if it has to wait.">
        {taskList([...late, ...dueToday], "Nothing late or due today.")}
      </Card>

      <Card title="No next step" sub="Add what happens next and when, so the case does not get forgotten.">
        {noNext.length === 0 ? <p className="py-2 text-sm text-slate-400">Every active case has a next task.</p> : (
          <div className="flex flex-col">
            {noNext.map((c) => {
              const people = staffOf.get(c.id) ?? [];
              return (
                <form key={c.id} action={addNextTask} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 py-3 text-sm">
                  {hidden}<input type="hidden" name="case_id" value={c.id} />
                  <div className="min-w-0 flex-[1_1_220px]">
                    <Link href={`/cases/${c.id}`} className="font-medium text-navy hover:underline">{c.student.codename}</Link>
                    <div className="text-[13px] text-slate-500">{caseLine(c)} · last update {fmtDate(lastTouch(c))}</div>
                  </div>
                  <input name="title" placeholder="Next step, e.g. Call parent about deposit" aria-label={`Next step for ${c.student.codename}`} className={`${inputCls} flex-[1_1_220px] !w-auto`} />
                  <DatePick name="due_date" defaultValue={addDays(today, 3)} label="Due date" />
                  {all ? (
                    <select name="assigned_to" aria-label="Who does it" defaultValue={people[0] ?? ""} className={`${inputCls} !w-auto`}>
                      {people.map((sid) => <option key={sid} value={sid}>{who.get(sid) ?? "Staff"}</option>)}
                    </select>
                  ) : <input type="hidden" name="assigned_to" value={me.id} />}
                  <Submit>Add</Submit>
                </form>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-start gap-6">
        <Card title="Coming up, next 7 days" className="flex-[3_1_520px]">
          {taskList(next, "Nothing in the next 7 days.")}
        </Card>
        <Card title={`Untouched for ${QUIET_DAYS} days`} sub="No stage update or edit. Worth a call or a note." className="flex-[2_1_320px]">
          {quiet.length === 0 ? <p className="py-2 text-sm text-slate-400">Every active case was touched in the last {QUIET_DAYS} days.</p> : (
            <div className="flex flex-col">
              {quiet.map((c) => (
                <div key={c.id} className="border-b border-slate-100 py-2.5 text-sm">
                  <Link href={`/cases/${c.id}`} className="font-medium text-navy hover:underline">{c.student.codename}</Link>
                  <div className="text-[13px] text-slate-500">{caseLine(c)} · {daysBetween(lastTouch(c), today)} days</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
