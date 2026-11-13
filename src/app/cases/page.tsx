import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { inputCls } from "@/components/fields";
import { getMe } from "@/lib/auth";
import { daysBetween, fmtDate, fmtMonth, todayBangkok } from "@/lib/dates";

type Params = { scope?: string; status?: string; service?: string; intake?: string; q?: string; sort?: string; dir?: string; deleted?: string };
const STATUS: Record<string, string[]> = {
  active: ["not_started", "in_progress"], success: ["success"], fail: ["fail"],
};

export default async function CasesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { supabase: sb, me } = await getMe();
  const today = todayBangkok();
  // Admin looks after the whole company, so their list opens on All cases; staff open on My cases.
  const scope = sp.scope === "all" || sp.scope === "mine" ? sp.scope : me.role === "admin" ? "all" : "mine";
  const status = sp.status && STATUS[sp.status] ? sp.status : "active";

  const [casesRes, catsRes, mineRes] = await Promise.all([
    sb.from("cases").select("id, intake, overall_status, category_id, student:students(codename), category:categories(name_en), case_staff(end_date, staff:staff!case_staff_staff_id_fkey(codename))"),
    sb.from("categories").select("id, name_en").eq("active", true).order("sort_order"),
    sb.from("case_staff").select("case_id").eq("staff_id", me.id).is("end_date", null),
  ]);
  if (casesRes.error) throw new Error(casesRes.error.message);

  type Row = {
    id: string; intake: string; overall_status: string; category_id: string;
    student: { codename: string }; category: { name_en: string };
    case_staff: { end_date: string | null; staff: { codename: string } }[];
  };
  const mine = new Set((mineRes.data ?? []).map((r) => r.case_id as string));
  let rows = (casesRes.data ?? []) as unknown as Row[];
  if (scope === "mine") rows = rows.filter((r) => mine.has(r.id));

  const counts = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, rows.filter((r) => v.includes(r.overall_status)).length]));
  const intakes = [...new Set(rows.map((r) => r.intake))].sort();
  rows = rows.filter((r) => STATUS[status].includes(r.overall_status));
  if (sp.service) rows = rows.filter((r) => r.category_id === sp.service);
  if (sp.intake) rows = rows.filter((r) => r.intake === sp.intake);
  if (sp.q) { const q = sp.q.toLowerCase(); rows = rows.filter((r) => r.student.codename.toLowerCase().includes(q)); }

  const ids = rows.map((r) => r.id);
  const [progRes, taskRes] = ids.length ? await Promise.all([
    sb.from("v_case_progress").select("case_id, probability_pct, furthest_stage_en").in("case_id", ids),
    sb.from("tasks").select("case_id, title, due_date").in("case_id", ids).is("done_at", null).order("due_date"),
  ]) : [{ data: [] }, { data: [] }];
  const prog = new Map((progRes.data ?? []).map((p) => [p.case_id as string, p]));
  const nextTask = new Map<string, { title: string; due_date: string }>();
  for (const t of (taskRes.data ?? []) as { case_id: string; title: string; due_date: string }[]) if (!nextTask.has(t.case_id)) nextTask.set(t.case_id, t);

  // Default: no open task first, then the earliest due task. A column header click sorts by that column.
  const staffOf = (r: Row) => r.case_staff.filter((x) => !x.end_date).map((x) => x.staff.codename).join(", ");
  const KEYS: Record<string, (r: Row) => string | number> = {
    student: (r) => r.student.codename.toLowerCase(),
    service: (r) => r.category.name_en,
    intake: (r) => r.intake,
    stage: (r) => prog.get(r.id)?.furthest_stage_en ?? "",
    chance: (r) => Number(prog.get(r.id)?.probability_pct ?? 0),
    staff: (r) => staffOf(r) || "\uffff", // no staff sorts last
    task: (r) => nextTask.get(r.id)?.due_date ?? "0000",
  };
  const sort = sp.sort && KEYS[sp.sort] ? sp.sort : "task";
  const dir = sp.dir === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    const x = KEYS[sort](a), y = KEYS[sort](b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return c * dir || a.student.codename.localeCompare(b.student.codename);
  });

  const link = (over: Params) => {
    const p = new URLSearchParams(Object.entries({ ...sp, deleted: undefined, ...over }).filter(([, v]) => v) as [string, string][]);
    return `/cases?${p}`;
  };
  const tab = (on: boolean) => on ? "rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 shadow-sm" : "rounded-md px-3 py-1.5 text-slate-600 hover:text-slate-900";

  return (
    <AppShell name={me.codename} active="/cases">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Cases</h1>
        <Link href="/cases/new" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark">+ New case</Link>
      </div>
      {sp.deleted && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Case deleted.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-200 p-1 text-sm">
          <Link className={tab(scope === "mine")} href={link({ scope: "mine" })}>My cases</Link>
          <Link className={tab(scope === "all")} href={link({ scope: "all" })}>All cases</Link>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-200 p-1 text-sm">
          <Link className={tab(status === "active")} href={link({ status: "active" })}>Active {counts.active}</Link>
          <Link className={tab(status === "success")} href={link({ status: "success" })}>Successful {counts.success}</Link>
          <Link className={tab(status === "fail")} href={link({ status: "fail" })}>Lost {counts.fail}</Link>
        </div>
        <form className="flex flex-[1_1_420px] flex-wrap gap-2" action="/cases">
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="status" value={status} />
          {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
          {sp.dir && <input type="hidden" name="dir" value={sp.dir} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search student name" aria-label="Search student name" className={`${inputCls} flex-[1_1_200px] !w-auto`} />
          <select name="service" defaultValue={sp.service ?? ""} aria-label="Service" className={`${inputCls} !w-auto`}>
            <option value="">All services</option>
            {(catsRes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
          </select>
          <select name="intake" defaultValue={sp.intake ?? ""} aria-label="Intake" className={`${inputCls} !w-auto`}>
            <option value="">All intakes</option>
            {intakes.map((i) => <option key={i} value={i}>{fmtMonth(i)}</option>)}
          </select>
          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy hover:border-navy">Filter</button>
        </form>
      </div>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] border-collapse text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              {[["student", "Student"], ["service", "Service"], ["intake", "Intake"], ["stage", "Stage"], ["chance", "Chance"], ["staff", "Staff"], ["task", "Next task"]].map(([k, h]) => {
                const on = sort === k;
                const next = on && dir === 1 ? "desc" : "asc";
                return (
                  <th key={k} aria-sort={on ? (dir === 1 ? "ascending" : "descending") : "none"}
                    className={`border-b border-slate-200 px-4 py-3 font-semibold ${k === "chance" ? "text-right" : ""}`}>
                    <Link href={link({ sort: k, dir: next })} className={`inline-flex items-center gap-1 hover:text-navy ${on ? "text-navy" : ""}`}>
                      {h}<span aria-hidden="true" className={on ? "" : "opacity-30"}>{on ? (dir === 1 ? "▲" : "▼") : "▲"}</span>
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-slate-400">No cases match.</td></tr>
            )}
            {rows.map((r) => {
              const p = prog.get(r.id);
              const t = nextTask.get(r.id);
              const late = t ? daysBetween(t.due_date, today) : 0;
              const due = !t ? "" : t.due_date === today ? "Today" : late > 0 ? `${late} ${late === 1 ? "day" : "days"} late` : fmtDate(t.due_date);
              const active = STATUS.active.includes(r.overall_status);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-3"><Link href={`/cases/${r.id}`} className="font-medium text-navy hover:underline">{r.student.codename}</Link></td>
                  <td className="border-b border-slate-100 px-4 py-3">{r.category.name_en}</td>
                  <td className="border-b border-slate-100 px-4 py-3">{fmtMonth(r.intake)}</td>
                  <td className="border-b border-slate-100 px-4 py-3">{p?.furthest_stage_en ?? "Not started"}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right">{p ? `${Math.round(Number(p.probability_pct))}%` : ""}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-600">{r.case_staff.filter((s) => !s.end_date).map((s) => s.staff.codename).join(", ") || "-"}</td>
                  <td className={`border-b border-slate-100 px-4 py-3 text-[13px] ${active && (!t || late > 0) ? "font-semibold text-brand-red" : "text-slate-700"}`}>
                    {t ? `${t.title} · ${due}` : active ? "No open task" : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="text-[13px] text-slate-500">Click a column name to sort. By default, cases with no open task come first, then by the next task date.</p>
    </AppShell>
  );
}
