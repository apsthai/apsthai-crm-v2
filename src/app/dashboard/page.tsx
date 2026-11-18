import { AppShell, Bar, Card, Tile } from "@/components/app-shell";
import { getMe, seesAll } from "@/lib/auth";
import { cycleOf, fmtDate, fmtLongDate, fmtMonth, fmtMonthShort, hourBangkok, todayBangkok } from "@/lib/dates";
import { fmtPoints, fmtTHBShort } from "@/lib/money";
import { loadAdmin, loadCompany, loadMine, type TaskRow } from "./data";
import { FlightDeck } from "./flight-deck";
import { loadFlightDeck } from "./flight-data";

export default async function Dashboard() {
  const { supabase, me } = await getMe();
  const today = todayBangkok();
  const cycle = cycleOf(today);
  const isAdmin = seesAll(me);
  const [mine, company, admin, fd] = await Promise.all([
    loadMine(supabase, me.id, today, cycle),
    loadCompany(supabase, cycle),
    isAdmin ? loadAdmin(supabase, today, cycle) : Promise.resolve(null),
    isAdmin ? loadFlightDeck(supabase, today, cycle) : Promise.resolve(null),
  ]);
  const h = hourBangkok();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell name={me.codename} active="/dashboard">
      {fd ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Flight Deck</h1>
            <p className="mt-1 text-sm text-slate-500">{fmtLongDate(today)} · {cycle.label} · day {fd.day} of {fd.total} ({Math.round(fd.frac * 100)}% of the cycle gone)</p>
          </div>
          <span className="text-[13px] text-slate-500">{greeting}, {me.codename}</span>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{greeting}, {me.codename}</h1>
          <p className="mt-1 text-sm text-slate-500">{fmtLongDate(today)} · {cycle.label}</p>
        </div>
      )}
      {admin && fd ? <AdminView admin={admin} fd={fd} mine={mine} />
        : <StaffView mine={mine} company={company} cycle={cycle.label} />}
    </AppShell>
  );
}

type Mine = Awaited<ReturnType<typeof loadMine>>;
type Admin = NonNullable<Awaited<ReturnType<typeof loadAdmin>>>;
type FD = NonNullable<Awaited<ReturnType<typeof loadFlightDeck>>>;

function StaffView({ mine, company, cycle }: { mine: Mine; company: Awaited<ReturnType<typeof loadCompany>>; cycle: string }) {
  const kpiPct = mine.kpi ? (mine.points / mine.kpi) * 100 : 0;
  const maxStage = Math.max(1, ...mine.stages.map((s) => s.n));
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Tile label="Overdue" value={String(mine.tasks.overdue)} sub="Past the due date" tone={mine.tasks.overdue ? "red" : "ink"} />
        <Tile label="Due today" value={String(mine.tasks.dueToday)} sub={`${mine.tasks.later} more in the next 7 days`} />
        <Tile label="Active cases" value={String(mine.activeCases)} sub={`Across ${mine.services} ${mine.services === 1 ? "service" : "services"}`} />
        <Tile label="My points" value={fmtPoints(mine.points)} tone="navy"
          sub={mine.kpi ? `KPI ${fmtPoints(mine.kpi)} · ${fmtPoints(Math.max(0, mine.kpi - mine.points))} to go` : "No KPI"} />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Card title="To do" sub="Overdue first, then today." className="flex-[3_1_520px]">
          <TaskList tasks={mine.tasks.now} empty="Nothing overdue or due today." />
          {mine.tasks.later > 0 && <p className="mt-3 text-[13px] text-slate-500">Coming up in the next 7 days: {mine.tasks.later} more</p>}
        </Card>

        <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-6">
          <Card title="My cases by stage" sub={`${mine.activeCases} active ${mine.activeCases === 1 ? "case" : "cases"}`}>
            {mine.stages.length === 0 ? <Empty text="No active cases." /> : (
              <div className="flex flex-col gap-2.5">
                {mine.stages.map((s) => (
                  <div key={s.name} className="flex items-center gap-2.5 text-sm">
                    <span className="w-28 flex-none truncate">{s.name}</span>
                    <div className="flex-1"><Bar pct={(s.n / maxStage) * 100} /></div>
                    <span className="w-6 text-right font-semibold">{s.n}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="My points" sub={`${cycle}, counted when the student enrols`}>
            {mine.pointsByService.length === 0 ? <Empty text="No points yet in this cycle." /> : (
              <div className="flex flex-col">
                {mine.pointsByService.map((p) => (
                  <div key={p.name} className="flex justify-between border-b border-slate-100 py-2 text-sm">
                    <span>{p.name}</span><span className="font-semibold">{fmtPoints(p.pts)}</span>
                  </div>
                ))}
              </div>
            )}
            {mine.kpi ? (
              <div className="flex flex-col gap-1.5 pt-3.5">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-navy">Me: {fmtPoints(mine.points)} of KPI {fmtPoints(mine.kpi)}</span>
                  <span className="text-brand-red">{fmtPoints(Math.max(0, mine.kpi - mine.points))} to go</span>
                </div>
                <Bar pct={kpiPct} />
                <span className="text-[13px] text-slate-500">{Math.round(kpiPct)}% of my KPI</span>
              </div>
            ) : null}
            <div className="flex justify-between pt-3.5 text-sm text-slate-600">
              <span>Whole team</span><span className="font-semibold">{fmtPoints(mine.teamPoints)} points</span>
            </div>
          </Card>

          <Card title="APSthai so far" sub={`${cycle}, whole company`}>
            <Row label="Successful cases" value={String(company.successful)} />
            <Row label="Active cases" value={String(company.active)} />
            <Row label="Team points" value={fmtPoints(mine.teamPoints)} last />
          </Card>

          <Waiting mine={mine} />
        </div>
      </div>
    </>
  );
}

function AdminView({ admin, fd, mine }: { admin: Admin; fd: FD; mine: Mine }) {
  const max = Math.max(1, ...admin.forecast.map((f) => f.confirmed + f.pipeline));
  const maxPipe = Math.max(1, ...admin.pipeline.map((p) => p.thb));
  return (
    <>
      {admin.missingRate && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-brand-red">
          Some amounts are in a currency with no exchange rate yet, so they count as ฿0 below.
        </p>
      )}

      <FlightDeck fd={fd} />

      <div className="flex flex-wrap items-stretch gap-6">
        <Card title="Forecast, next 6 months" sub="Incl. VAT" className="flex-[3_1_520px]"
          right={<span className="flex gap-4 text-slate-600">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-navy" />Confirmed</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#9dbbd3]" />Pipeline × probability</span>
          </span>}>
          <div className="mt-5 flex h-[220px] items-end gap-3 border-b border-slate-300">
            {admin.forecast.map((f) => {
              const total = f.confirmed + f.pipeline;
              return (
                <div key={f.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-xs font-semibold text-slate-700">{total ? fmtTHBShort(total) : ""}</span>
                  <div className="flex w-full max-w-14 flex-col justify-end" style={{ height: `${(total / max) * 100}%` }}>
                    {f.pipeline > 0 && <div className="rounded-t bg-[#9dbbd3]" style={{ height: `${(f.pipeline / total) * 100}%` }} />}
                    {f.confirmed > 0 && <div className={f.pipeline > 0 ? "bg-navy" : "rounded-t bg-navy"} style={{ height: `${(f.confirmed / total) * 100}%` }} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-3">
            {admin.forecast.map((f) => <span key={f.month} className="flex-1 text-center text-xs text-slate-500">{fmtMonthShort(f.month)}</span>)}
          </div>
        </Card>

        <Card title="Pipeline by service" sub="Active cases, value × probability, incl. VAT" className="flex-[2_1_340px]">
          {admin.pipeline.length === 0 ? <Empty text="No active cases yet." /> : (
            <div className="flex flex-col gap-3">
              {admin.pipeline.map((p) => (
                <div key={p.name} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{p.name} <span className="text-slate-500">· {p.cases} {p.cases === 1 ? "case" : "cases"}</span></span>
                    <span className="font-semibold">{fmtTHBShort(p.thb)}</span>
                  </div>
                  <Bar pct={(p.thb / maxPipe) * 100} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="My work today"
        right={`${mine.tasks.dueToday} due today · ${mine.tasks.overdue} overdue · ${mine.activeCases} active cases`}>
        <TaskList tasks={mine.tasks.now} empty="Nothing overdue or due today." />
      </Card>

      <Waiting mine={mine} />
    </>
  );
}

function TaskList({ tasks, empty }: { tasks: TaskRow[]; empty: string }) {
  if (!tasks.length) return <Empty text={empty} />;
  return (
    <div className="flex flex-col">
      {tasks.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 py-3">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${t.lateDays > 0 ? "bg-red-50 text-brand-red" : "bg-navy-50 text-navy"}`}>
            {t.lateDays > 0 ? `${t.lateDays} ${t.lateDays === 1 ? "day" : "days"} late` : "Today"}
          </span>
          <div className="min-w-0 flex-[1_1_240px]">
            <div className="text-sm font-medium">{t.title}</div>
            <div className="text-[13px] text-slate-500">{t.student} · {t.service} · {t.stage}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Waiting({ mine }: { mine: Mine }) {
  if (!mine.waiting.length) return null;
  return (
    <Card title="Waiting for Admin">
      {mine.waiting.map((w) => (
        <div key={w.id} className="border-b border-slate-100 py-2 last:border-0">
          <div className="text-sm">{w.case.student.codename} · {w.case.category.name_en} · {fmtMonth(w.case.intake)}</div>
          <div className="text-[13px] text-slate-500">Sent for approval on {fmtDate(w.date)}</div>
        </div>
      ))}
    </Card>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between py-2 text-sm ${last ? "" : "border-b border-slate-100"}`}>
      <span>{label}</span><span className="font-semibold">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-2 text-sm text-slate-400">{text}</p>;
}
