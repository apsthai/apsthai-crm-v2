import Link from "next/link";
import { Fragment } from "react";
import { Card } from "@/components/app-shell";
import { fmtDate, fmtMonth } from "@/lib/dates";
import { n2 } from "@/lib/fin";
import { fmtPoints, fmtTHB } from "@/lib/money";
import type { CycleData, Pace } from "@/lib/cycle-data";
import type { loadFlightDeck } from "./flight-data";

type FD = Awaited<ReturnType<typeof loadFlightDeck>>;

const CHIP: Record<Exclude<Pace, null>, [string, string]> = {
  ahead: ["Ahead", "bg-green-100 text-green-800"],
  on: ["On pace", "bg-green-100 text-green-800"],
  behind: ["Behind", "bg-red-100 text-red-700"],
  waiting: ["Counts at intake", "bg-slate-100 text-slate-500"],
  future: ["Not started", "bg-slate-100 text-slate-500"],
};

function Chip({ pace, none = "No target" }: { pace: Pace; none?: string }) {
  const [text, cls] = pace ? CHIP[pace] : [none, "bg-slate-100 text-slate-500"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{text}</span>;
}

// Progress bar with a red line where we should be by today.
function PaceBar({ pct, mark }: { pct: number; mark: number }) {
  return (
    <div className="relative h-2.5 w-44 rounded-full bg-slate-200">
      <div className="absolute inset-y-0 left-0 rounded-full bg-navy" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      <div className="absolute -inset-y-1 w-0.5 bg-brand-red" style={{ left: `${Math.min(100, mark)}%` }} />
    </div>
  );
}

const th = "border-b border-slate-200 px-3 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase";
const td = "border-b border-slate-100 px-3 py-2";

// cy: one cycle, or two cycles next to each other to compare. current: the one cycle shown is today's.
export function FlightDeck({ fd, cy, current }: { fd: FD; cy: CycleData[]; current: boolean }) {
  const two = cy.length === 2;
  const m = fd.money, l = fd.lights;
  const red = "bg-brand-red", amber = "bg-amber-500", green = "bg-green-600";
  const lights: { on: boolean; tone: string; text: string; href?: string; ok: string }[] = [
    { on: l.approvals > 0, tone: red, text: `${l.approvals} ${l.approvals === 1 ? "success" : "successes"} waiting for approval`, href: "/approvals", ok: "Nothing waiting for approval" },
    { on: l.overdue > 0, tone: red, text: `${l.overdue} ${l.overdue === 1 ? "invoice" : "invoices"} unpaid over 30 days`, href: "/financial/invoices", ok: "No invoice unpaid over 30 days" },
    { on: l.noTask > 0, tone: amber, text: `${l.noTask} active ${l.noTask === 1 ? "case" : "cases"} with no open task`, href: "/cases", ok: "Every active case has a next task" },
    { on: l.quiet.length > 0, tone: amber, text: `No new case this week: ${l.quiet.join(", ")}`, ok: "Everyone with a KPI has a new case this week" },
    { on: l.stale > 0, tone: amber, text: `${l.stale} active ${l.stale === 1 ? "case" : "cases"} untouched for 14 days`, href: "/cases", ok: "No case untouched for 14 days" },
    { on: l.noConsent > 0, tone: amber, text: `${l.noConsent} active ${l.noConsent === 1 ? "case" : "cases"} without PDPA consent`, href: "/cases?consent=no", ok: "Every active case has PDPA consent" },
    { on: l.billSoon > 0, tone: amber, text: `${l.billSoon} ${l.billSoon === 1 ? "amount" : "amounts"} to bill in the next 7 days`, href: "/financial", ok: "Nothing to bill this week" },
  ];

  return (
    <>
      <section className="flex flex-wrap items-center gap-x-7 gap-y-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm">
        <b className="font-semibold">Since yesterday</b>
        <span>{fd.since.newCases} new {fd.since.newCases === 1 ? "case" : "cases"}</span>
        <span>{fd.since.successes} successful</span>
        <span>{fd.since.payments} {fd.since.payments === 1 ? "payment" : "payments"} in{fd.since.payments ? ` · ${fmtTHB(fd.since.paymentsTHB)}` : ""}</span>
        <Link href="/approvals" className={fd.since.approvals ? "font-medium text-brand-red" : ""}>{fd.since.approvals} waiting for your approval</Link>
      </section>

      {two ? <CompareCycles a={cy[0]} b={cy[1]} /> : <CycleCard c={cy[0]} current={current} />}

      <div className="flex flex-wrap items-start gap-5">
        <Card title="2. Money" className="flex-[1_1_520px]">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div><div className="text-[13px] text-slate-500">Money in this month</div><div className="text-2xl font-semibold">{fmtTHB(m.month)}</div>
              <div className="text-[13px] text-slate-500">Last month {fmtTHB(m.lastMonth)} · {m.dayOfMonth} of {m.daysInMonth} days gone</div></div>
            <Link href="/financial/invoices"><div className="text-[13px] text-slate-500">Overdue (invoice over 30 days)</div>
              <div className={`text-2xl font-semibold ${m.overdue.length ? "text-brand-red" : ""}`}>{m.overdue.length} {m.overdue.length === 1 ? "invoice" : "invoices"}</div>
              <div className="text-[13px] text-slate-500">{m.overdue.length === 1 ? `${m.overdue[0].currency} ${n2(m.overdue[0].amount)} · ${m.overdue[0].who} · since ${fmtDate(m.overdue[0].date)}`
                : m.overdue.length ? `Oldest since ${fmtDate(m.overdue[0].date)}` : "Nothing overdue"}</div></Link>
            <Link href="/financial"><div className="text-[13px] text-slate-500">To bill in the next 7 days</div><div className="text-2xl font-semibold">{m.billSoon}</div>
              <div className="text-[13px] text-slate-500">From &quot;Remind me on&quot; and instalment months</div></Link>
            <Link href="/financial"><div className="text-[13px] text-slate-500">Not billed yet</div><div className="text-2xl font-semibold">{fmtTHB(m.notBilled)}</div>
              <div className="text-[13px] text-slate-500">{m.notBilledCount} amounts{m.toConfirm ? ` · ${m.toConfirm} to confirm` : ""}{m.missing ? " · some currencies have no rate" : ""}</div></Link>
          </div>
        </Card>

        <Card title="3. Closing in the next 90 days" sub="Active cases by intake · expected = value × chance of closing" className="flex-[1_1_520px]">
          {fd.closing.length === 0 ? <p className="text-sm text-slate-500">No active case with an intake in the next 90 days.</p> : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="text-left"><th className={th}>Intake</th><th className={`${th} text-right`}>Cases</th><th className={th}>Furthest stage</th><th className={`${th} text-right`}>Expected</th></tr></thead>
              <tbody>
                {fd.closing.map((c) => (
                  <tr key={c.month}><td className={td}>{fmtMonth(c.month)}</td><td className={`${td} text-right`}>{c.cases}</td><td className={td}>{c.stages}</td><td className={`${td} text-right`}>{fmtTHB(c.expected)}</td></tr>
                ))}
                <tr><td className="px-3 py-2 font-semibold">Total</td><td className="px-3 py-2 text-right font-semibold">{fd.closing.reduce((a, c) => a + c.cases, 0)}</td><td />
                  <td className="px-3 py-2 text-right font-semibold">{fmtTHB(fd.closing.reduce((a, c) => a + c.expected, 0))}</td></tr>
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {two ? <CompareTeam a={cy[0]} b={cy[1]} /> : <TeamCard c={cy[0]} current={current} />}

        <Card title="5. Warning lights" sub="Only what needs action. Click to open the list." className="flex-[1_1_340px]">
          <div className="-mx-5 -mb-5">
            {[...lights.filter((x) => x.on), ...lights.filter((x) => !x.on)].map((x) => {
              const body = <><span className={`size-2.5 flex-none rounded-full ${x.on ? x.tone : green}`} />{x.on ? x.text : x.ok}</>;
              const cls = "flex items-center gap-2.5 border-t border-slate-100 px-5 py-2.5 text-sm";
              return x.on && x.href ? <Link key={x.ok} href={x.href} className={`${cls} hover:bg-slate-50`}>{body}</Link> : <div key={x.ok} className={cls}>{body}</div>;
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

// Sep 2026 - Aug 2027 -> 2026-27
const short = (c: CycleData) => `${c.cycle.start.slice(0, 4)}-${c.cycle.end.slice(2, 4)}`;

function markNote(c: CycleData) {
  if (c.frac <= 0) return `This cycle has not started yet (from ${fmtDate(c.cycle.start)}). It shows what is already planned for its intakes.`;
  if (c.frac >= 1) return "This cycle has ended. Red line = the whole target.";
  return `Red line = where we should be by today (${Math.round(c.frac * 100)}% of the cycle gone).`;
}

function RevenueLine({ c }: { c: CycleData }) {
  const bits = [
    `Revenue of the cycle (incl. VAT, cases with an intake in this cycle) = money in ${fmtTHB(c.received)} + to collect ${fmtTHB(c.toCollect)}`,
    c.pipeline ? `open cases × chance ${fmtTHB(c.pipeline)}` : null,
    c.noAmount ? `${c.noAmount} successful ${c.noAmount === 1 ? "case" : "cases"} with no amount yet` : null,
    c.toConfirm ? `${c.toConfirm} ${c.toConfirm === 1 ? "amount" : "amounts"} to confirm` : null,
    c.missing ? "some currencies have no rate" : null,
    `money in by date during the cycle (cash) ${fmtTHB(c.moneyIn)}`,
  ].filter(Boolean);
  return <p className="mt-2 text-[13px] text-slate-500">{bits.join(" · ")}</p>;
}

function CycleCard({ c, current }: { c: CycleData; current: boolean }) {
  const mark = c.frac * 100;
  return (
    <Card title={current ? "1. Where are we this year?" : `1. ${c.cycle.label}`}
      sub="Successful cases by intake against the cycle's target, per service"
      right={<span className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        Revenue of the cycle <b>{fmtTHB(c.revenue)}</b>{c.revenueTarget ? <> of <b>{fmtTHB(c.revenueTarget)}</b> · {Math.round(c.revenuePct)}%</> : null}
        <Chip pace={c.revenuePace} />
      </span>}>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead><tr className="text-left">
            <th className={`${th} pl-5`}>Service</th><th className={`${th} text-right`}>Target</th><th className={`${th} text-right`}>Now</th>
            <th className={th}>Progress</th><th className={th}>Pace</th><th className={`${th} text-right`}>New this week</th><th className={`${th} pr-5 text-right`}>Active cases</th>
          </tr></thead>
          <tbody>
            {c.services.length === 0 && <tr><td colSpan={7} className={`${td} pl-5 text-slate-400`}>No target, case or result in this cycle yet.</td></tr>}
            {c.services.map((s) => (
              <tr key={s.id}>
                <td className={`${td} pl-5`}>{s.name}</td>
                <td className={`${td} text-right`}>{s.target ?? <span className="text-slate-400">–</span>}</td>
                <td className={`${td} text-right font-semibold`}>{s.now}</td>
                <td className={td}>{s.target ? <PaceBar pct={s.pct} mark={mark} /> : <span className="text-[13px] text-slate-400">Set a target in Admin</span>}</td>
                <td className={td}><Chip pace={s.pace} /></td>
                <td className={`${td} text-right`}>{s.newWeek}</td>
                <td className={`${td} pr-5 text-right`}>{s.active}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RevenueLine c={c} />
      <p className="mt-1 text-[13px] text-slate-500">
        {markNote(c)} Targets are set in <Link href="/admin/targets" className="text-navy">Admin · Targets</Link>.
        {c.hidden ? ` ${c.hidden} services with no target, case or result this cycle are not shown.` : ""}
      </p>
    </Card>
  );
}

function TeamCard({ c, current }: { c: CycleData; current: boolean }) {
  const mark = c.frac * 100;
  return (
    <Card title={current ? "4. Team against KPI" : `4. Team against KPI, ${short(c)}`}
      sub={`Points by intake · ${c.frac > 0 && c.frac < 1 ? `red line = ${Math.round(mark)}% of KPI` : c.frac <= 0 ? "cycle not started" : "cycle ended"}`}
      className="flex-[2_1_640px]">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead><tr className="text-left">
            <th className={`${th} pl-5`}>Staff</th><th className={`${th} text-right`}>Points / KPI</th><th className={th}>Progress</th><th className={th}>Pace</th>
            <th className={`${th} text-right`}>Active cases</th><th className={`${th} pr-5 text-right`}>New this week</th>
          </tr></thead>
          <tbody>
            {c.team.map((s) => (
              <tr key={s.id}>
                <td className={`${td} pl-5`}>{s.name}</td>
                <td className={`${td} text-right`}>{fmtPoints(s.points)} / {s.kpi !== null ? fmtPoints(s.kpi) : "–"}</td>
                <td className={td}>{s.kpi !== null ? <PaceBar pct={s.pct} mark={mark} /> : <span className="text-[13px] text-slate-400">No KPI set</span>}</td>
                <td className={td}><Chip pace={s.pace} none="–" /></td>
                <td className={`${td} text-right`}>{s.active}</td>
                <td className={`${td} pr-5 text-right`}>{s.newWeek}</td>
              </tr>
            ))}
            <tr><td className="px-3 py-2 pl-5 font-semibold">Team</td><td className="px-3 py-2 text-right font-semibold">{fmtPoints(c.teamPoints)}</td><td colSpan={4} /></tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Change({ a, b, money }: { a: number; b: number; money?: boolean }) {
  const d = b - a;
  if (Math.abs(d) < 0.005) return <span className="text-slate-400">0</span>;
  const text = money ? fmtTHB(Math.abs(d)) : fmtPoints(Math.abs(d));
  return <span className={d > 0 ? "text-green-700" : "text-brand-red"}>{d > 0 ? "+" : "−"}{text}</span>;
}

function CompareCycles({ a, b }: { a: CycleData; b: CycleData }) {
  const ids = [...new Set([...a.services, ...b.services].map((s) => s.id))];
  const name = new Map([...a.services, ...b.services].map((s) => [s.id, s.name]));
  const get = (c: CycleData, id: string) => c.services.find((s) => s.id === id);
  const money: [string, (c: CycleData) => number | null][] = [
    ["Revenue of the cycle (in + to collect)", (c) => c.revenue],
    ["Revenue target", (c) => c.revenueTarget],
    ["Money in so far", (c) => c.received],
    ["Still to collect", (c) => c.toCollect],
    ["Open cases × chance", (c) => c.pipeline],
    ["Money in by date during the cycle (cash)", (c) => c.moneyIn],
  ];
  const head = (c: CycleData) => <>{short(c)}<div className="font-normal normal-case">{c.frac <= 0 ? "not started" : c.frac >= 1 ? "ended" : `${Math.round(c.frac * 100)}% gone`}</div></>;
  return (
    <Card title={`1. Compare ${a.cycle.label} with ${b.cycle.label}`} sub="Each cycle counts the cases whose intake falls in it. Change = right minus left.">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className={`${th} pl-5`} rowSpan={2}>Service</th>
              <th className={`${th} text-center`} colSpan={3}>{head(a)}</th>
              <th className={`${th} text-center`} colSpan={3}>{head(b)}</th>
              <th className={`${th} pr-5 text-right`} rowSpan={2}>Change<div className="font-normal normal-case">successful</div></th>
            </tr>
            <tr className="text-left">
              {[0, 1].map((i) => <Fragment key={i}><th className={`${th} text-right`}>Target</th><th className={`${th} text-right`}>Successful</th><th className={`${th} text-right`}>Active</th></Fragment>)}
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const x = get(a, id), y = get(b, id);
              return (
                <tr key={id}>
                  <td className={`${td} pl-5`}>{name.get(id)}</td>
                  {[x, y].map((s, i) => <Fragment key={i}>
                    <td className={`${td} text-right`}>{s?.target ?? <span className="text-slate-400">–</span>}</td>
                    <td className={`${td} text-right font-semibold`}>{s?.now ?? 0}</td>
                    <td className={`${td} text-right`}>{s?.active ?? 0}</td>
                  </Fragment>)}
                  <td className={`${td} pr-5 text-right`}><Change a={x?.now ?? 0} b={y?.now ?? 0} /></td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className="px-3 py-2 pl-5">All services</td>
              {[a, b].map((c, i) => <Fragment key={i}><td /><td className="px-3 py-2 text-right">{c.successful}</td><td className="px-3 py-2 text-right">{c.active}</td></Fragment>)}
              <td className="px-3 py-2 pr-5 text-right"><Change a={a.successful} b={b.successful} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="-mx-5 mt-4 overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead><tr className="text-left">
            <th className={`${th} pl-5`}>Money (THB, incl. VAT)</th><th className={`${th} text-right`}>{short(a)}</th><th className={`${th} text-right`}>{short(b)}</th><th className={`${th} pr-5 text-right`}>Change</th>
          </tr></thead>
          <tbody>
            {money.map(([label, f]) => {
              const x = f(a), y = f(b);
              return (
                <tr key={label}>
                  <td className={`${td} pl-5`}>{label}</td>
                  <td className={`${td} text-right`}>{x === null ? <span className="text-slate-400">–</span> : fmtTHB(x)}</td>
                  <td className={`${td} text-right`}>{y === null ? <span className="text-slate-400">–</span> : fmtTHB(y)}</td>
                  <td className={`${td} pr-5 text-right`}>{x === null || y === null ? "" : <Change a={x} b={y} money />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(a.noAmount || b.noAmount) ? <p className="mt-2 text-[13px] text-slate-500">Successful cases with no amount yet: {short(a)} {a.noAmount}, {short(b)} {b.noAmount}. Their revenue is not in the numbers above.</p> : null}
    </Card>
  );
}

function CompareTeam({ a, b }: { a: CycleData; b: CycleData }) {
  const ids = [...new Set([...a.team, ...b.team].map((s) => s.id))];
  const rows = ids.map((id) => {
    const x = a.team.find((s) => s.id === id), y = b.team.find((s) => s.id === id);
    return { id, name: (x ?? y)!.name, x, y };
  }).sort((p, q) => (q.y?.points ?? 0) + (q.x?.points ?? 0) - (p.y?.points ?? 0) - (p.x?.points ?? 0) || p.name.localeCompare(q.name));
  const cell = (s?: CycleData["team"][number]) => s ? <>{fmtPoints(s.points)} / {s.kpi !== null ? fmtPoints(s.kpi) : "–"}</> : <span className="text-slate-400">–</span>;
  return (
    <Card title="4. Team against KPI, compared" sub="Points / KPI by intake" className="flex-[2_1_640px]">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead><tr className="text-left">
            <th className={`${th} pl-5`}>Staff</th><th className={`${th} text-right`}>{short(a)}</th><th className={`${th} text-right`}>{short(b)}</th><th className={`${th} pr-5 text-right`}>Change in points</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} pl-5`}>{r.name}</td>
                <td className={`${td} text-right`}>{cell(r.x)}</td>
                <td className={`${td} text-right`}>{cell(r.y)}</td>
                <td className={`${td} pr-5 text-right`}><Change a={r.x?.points ?? 0} b={r.y?.points ?? 0} /></td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-3 py-2 pl-5">Team</td><td className="px-3 py-2 text-right">{fmtPoints(a.teamPoints)}</td><td className="px-3 py-2 text-right">{fmtPoints(b.teamPoints)}</td>
              <td className="px-3 py-2 pr-5 text-right"><Change a={a.teamPoints} b={b.teamPoints} /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
