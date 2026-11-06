import { AppShell, Bar, Card, SectionLabel, Tile } from "@/components/app-shell";
import { getMe } from "@/lib/auth";
import { cycleOf, fmtDate, fmtLongDate, fmtMonth, fmtMonthShort, hourBangkok, todayBangkok } from "@/lib/dates";
import { fmtPoints, fmtTHB, fmtTHBShort, incomeOf, vatOf } from "@/lib/money";
import { loadAdmin, loadCompany, loadMine, type TaskRow } from "./data";

export default async function Dashboard() {
  const { supabase, me } = await getMe();
  const today = todayBangkok();
  const cycle = cycleOf(today);
  const isAdmin = me.role === "admin";
  const [mine, company, admin] = await Promise.all([
    loadMine(supabase, me.id, today, cycle),
    loadCompany(supabase, cycle),
    isAdmin ? loadAdmin(supabase, today, cycle) : Promise.resolve(null),
  ]);
  const h = hourBangkok();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell name={me.codename} active="/dashboard">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{greeting}, {me.codename}</h1>
        <p className="mt-1 text-sm text-slate-500">{fmtLongDate(today)} · {cycle.label}</p>
      </div>
      {admin ? <AdminView admin={admin} mine={mine} today={today} cycle={cycle.label} />
        : <StaffView mine={mine} company={company} cycle={cycle.label} />}
    </AppShell>
  );
}

type Mine = Awaited<ReturnType<typeof loadMine>>;
type Admin = NonNullable<Awaited<ReturnType<typeof loadAdmin>>>;

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

function AdminView({ admin, mine, today, cycle }: { admin: Admin; mine: Mine; today: string; cycle: string }) {
  const a = admin.attention;
  const max = Math.max(1, ...admin.forecast.map((f) => f.confirmed + f.pipeline));
  const maxPipe = Math.max(1, ...admin.pipeline.map((p) => p.thb));
  return (
    <>
      {admin.missingRate && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-brand-red">
          Some amounts are in a currency with no exchange rate yet, so they count as ฿0 below.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <SectionLabel>Needs your attention</SectionLabel>
        <div className="flex flex-wrap gap-3">
          <Tile label="Success waiting for approval" value={String(a.approvals)} tone="navy"
            sub={a.approvals ? a.approvalServices.join(", ") : "Nothing waiting"} />
          <Tile label="Overdue money from payers" value={String(a.overdueCount)} tone={a.overdueCount ? "red" : "ink"}
            sub={a.overdueCount ? `${fmtTHB(a.overdueTHB)} incl. VAT, past the expected date` : "Nothing overdue"} />
          <Tile label="Next payout round" value={a.payout ? fmtTHB(a.payout.total) : "None"}
            sub={a.payout ? `Commission, no VAT · pay ${fmtDate(a.payout.date)} · ${a.payout.people} payees · ${a.payout.reviewed} reviewed` : "No payout waiting"} />
          <Tile label="Active cases with no open task" value={String(a.noTask)} tone={a.noTask ? "red" : "ink"}
            sub="Nothing scheduled to do next" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionLabel>Money (THB)</SectionLabel>
          <span className="text-[13px] text-slate-500">Big numbers include 7% VAT. Income is what is left after VAT.</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <MoneyTile label="Received this month" gross={admin.money.receivedMonth.gross} vat={admin.money.receivedMonth.vat}
            income={admin.money.receivedMonth.income} wht={admin.money.receivedMonth.wht} note={fmtMonth(today)} />
          <MoneyTile label={`Received ${cycle}`} gross={admin.money.receivedCycle.gross} vat={admin.money.receivedCycle.vat}
            income={admin.money.receivedCycle.income} wht={admin.money.receivedCycle.wht} note="So far" />
          <MoneyTile label="Due in the next 60 days" gross={admin.money.next60} vat={vatOf(admin.money.next60)}
            income={incomeOf(admin.money.next60)} note="Confirmed, not paid yet" />
          <MoneyTile label={`Still to come ${cycle}`} gross={admin.money.owedInCycle + admin.money.weightedInCycle}
            vat={vatOf(admin.money.owedInCycle + admin.money.weightedInCycle)} income={incomeOf(admin.money.owedInCycle + admin.money.weightedInCycle)}
            note={`${fmtTHBShort(admin.money.owedInCycle)} confirmed + ${fmtTHBShort(admin.money.weightedInCycle)} pipeline`} />
        </div>
      </section>

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

      <Card title={`Team performance, ${cycle}`} right={`Team total: ${fmtPoints(admin.teamPoints)} points`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                {["Staff", "Active cases", "Due today", "Overdue", "Successful", "Points / KPI", "To go", "Pipeline × probability (incl. VAT)"].map((h, i) => (
                  <th key={h} className={`border-b border-slate-200 px-3 py-2.5 font-semibold ${i ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admin.team.map((s) => (
                <tr key={s.name}>
                  <td className="border-b border-slate-100 px-3 py-2.5 font-medium whitespace-nowrap">{s.name}{s.partTime && <span className="ml-2 text-xs font-normal whitespace-nowrap text-slate-500">Part-time</span>}</td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right">{s.active}</td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right">{s.today}</td>
                  <td className={`border-b border-slate-100 px-3 py-2.5 text-right ${s.overdue ? "font-semibold text-brand-red" : ""}`}>{s.overdue}</td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right">{s.successful}</td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right font-semibold text-navy">{fmtPoints(s.points)}{s.kpi !== null ? ` / ${fmtPoints(s.kpi)}` : ""}</td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right text-brand-red">{s.toGo !== null ? fmtPoints(s.toGo) : <span className="text-slate-400">No KPI</span>}</td>
                  <td className="border-b border-slate-100 px-3 py-2.5 text-right">{fmtTHBShort(s.pipeline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="My work today"
        right={`${mine.tasks.dueToday} due today · ${mine.tasks.overdue} overdue · ${mine.activeCases} active cases`}>
        <TaskList tasks={mine.tasks.now} empty="Nothing overdue or due today." />
      </Card>

      <Waiting mine={mine} />
    </>
  );
}

function MoneyTile({ label, gross, vat, income, wht, note }:
  { label: string; gross: number; vat: number; income: number; wht?: number; note: string }) {
  return (
    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1 rounded-xl border border-slate-200 bg-white px-[18px] py-4">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-[26px] leading-tight font-semibold text-slate-900">{fmtTHB(gross)} <span className="text-xs font-normal text-slate-500">incl. VAT</span></span>
      <div className="mt-1 flex flex-col gap-0.5 border-t border-slate-100 pt-2 text-[13px]">
        <div className="flex justify-between text-slate-500"><span>VAT 7%</span><span>{fmtTHB(vat)}</span></div>
        {wht ? <div className="flex justify-between text-slate-500"><span>Withheld tax (in the total)</span><span>{fmtTHB(wht)}</span></div> : null}
        <div className="flex justify-between font-semibold text-navy"><span>Income (no VAT)</span><span>{fmtTHB(income)}</span></div>
      </div>
      <span className="text-[13px] text-slate-500">{note}</span>
    </div>
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
