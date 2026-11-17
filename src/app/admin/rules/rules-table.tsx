"use client";

import { Fragment, useState } from "react";
import { MonthPick } from "@/components/date-pick";
import { Field, inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { fmtMonth } from "@/lib/dates";
import { addRule } from "./actions";

export type RuleRow = { id: string; category_id: string; revenue_type: string; method: string; value: number | null; recipient: string;
  team_id: string | null; count_when: string; count_stage_id: string | null; cycle: string; effective_intake: string };
type Opt = { id: string; name_en: string };
const REV: Record<string, string> = { commission: "Commission", service_fee: "Service fee", bonus: "Bonus" };
const CYCLE: Record<string, string> = { next_month: "Next month", same_month: "Same month", quarterly: "Every quarter" };

export function RulesTable({ rules, categories, teams, stages, thisYear }:
  { rules: RuleRow[]; categories: (Opt & { active: boolean })[]; teams: { id: string; name: string }[]; stages: (Opt & { category_id: string })[]; thisYear: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "";
  const stageName = (id: string | null) => stages.find((t) => t.id === id)?.name_en ?? "";
  const gets = (r: RuleRow) => r.method === "percent" ? `${Number(r.value)}% of money in before VAT`
    : r.method === "fixed_per_case" ? `฿${Number(r.value).toLocaleString("en-US")} per case` : "Admin enters it";
  const who = (r: RuleRow) => r.recipient === "team" ? `Team ${teamName(r.team_id)}` : "Staff on the case";
  const when = (r: RuleRow) => r.count_when === "payment" ? "When money comes in" : `When ${stageName(r.count_stage_id)} is done`;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-[1_1_420px]">
          <h2 className="text-base font-semibold text-slate-900">Team commission rules</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            A new rate never changes an old one: it starts from an intake, so cases with an earlier intake keep the rate they had.
            Amounts already worked out do not change.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} className="size-4 accent-navy" /> Show older rates
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              {["Service", "Money", "Team gets", "Who", "Counted", "Paid", "From intake", ""].map((h, i) => (
                <th key={i} className="border-b border-slate-200 px-4 py-2.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const mine = rules.filter((r) => r.category_id === c.id);
              const seen = new Set<string>();
              // Newest rule per kind of money is the one in use; the rest are older rates.
              const list = mine.filter((r) => { const cur = !seen.has(r.revenue_type); seen.add(r.revenue_type); return cur || showOld; });
              const isOpen = open === c.id;
              return (
                <Fragment key={c.id}>
                  {list.length === 0 && (
                    <tr><td className="border-b border-slate-100 px-4 py-2.5 font-medium">{c.name_en}</td>
                      <td colSpan={6} className="border-b border-slate-100 px-4 py-2.5 text-slate-400">No rule: no team commission</td>
                      <td className="border-b border-slate-100 px-4 py-2.5 text-right"><NewBtn open={isOpen} onClick={() => setOpen(isOpen ? null : c.id)} /></td></tr>
                  )}
                  {list.map((r, i) => {
                    const old = mine.findIndex((x) => x.revenue_type === r.revenue_type) !== mine.indexOf(r);
                    return (
                      <tr key={r.id} className={old ? "text-slate-400" : ""}>
                        <td className="border-b border-slate-100 px-4 py-2.5 font-medium">{i === 0 ? <span className={old ? "" : "text-slate-900"}>{c.name_en}{!c.active && " (hidden)"}</span> : ""}</td>
                        <td className="border-b border-slate-100 px-4 py-2.5">{REV[r.revenue_type]}{old && " (older)"}</td>
                        <td className="border-b border-slate-100 px-4 py-2.5">{gets(r)}</td>
                        <td className="border-b border-slate-100 px-4 py-2.5">{who(r)}</td>
                        <td className="border-b border-slate-100 px-4 py-2.5">{when(r)}</td>
                        <td className="border-b border-slate-100 px-4 py-2.5">{CYCLE[r.cycle]}</td>
                        <td className="border-b border-slate-100 px-4 py-2.5">{fmtMonth(r.effective_intake)}</td>
                        <td className="border-b border-slate-100 px-4 py-2.5 text-right">{i === 0 && <NewBtn open={isOpen} onClick={() => setOpen(isOpen ? null : c.id)} />}</td>
                      </tr>
                    );
                  })}
                  {isOpen && (
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="border-b border-slate-200 px-4 pt-1 pb-4">
                        <NewRule category={c} current={mine[0]} teams={teams} stages={stages.filter((s) => s.category_id === c.id)}
                          thisYear={thisYear} onClose={() => setOpen(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-expanded={open}
    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-navy hover:border-navy">{open ? "Close" : "New rate"}</button>;
}

function NewRule({ category, current, teams, stages, thisYear, onClose }:
  { category: Opt; current?: RuleRow; teams: { id: string; name: string }[]; stages: Opt[]; thisYear: number; onClose: () => void }) {
  const [method, setMethod] = useState(current?.method ?? "percent");
  const [recipient, setRecipient] = useState(current?.recipient ?? "case_staff");
  const [countWhen, setCountWhen] = useState(current?.count_when ?? "payment");
  const [intake, setIntake] = useState("");
  return (
    <form action={addRule} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <input type="hidden" name="category_id" value={category.id} />
      <h3 className="text-sm font-semibold text-slate-900">New rate: {category.name_en}</h3>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Money">
          <select name="revenue_type" defaultValue={current?.revenue_type ?? "commission"} className={inputCls}>
            {Object.entries(REV).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="How">
          <select name="method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            <option value="percent">% of money in before VAT</option><option value="fixed_per_case">Fixed amount per case</option><option value="manual">Admin enters it</option>
          </select>
        </Field>
        <Field label={method === "percent" ? "Rate (%)" : "Amount (THB)"}>
          <input name="value" defaultValue={current?.method === method && current.value != null ? Number(current.value) : ""} disabled={method === "manual"}
            inputMode="decimal" className={`${inputCls} text-right`} />
        </Field>
        <Field label="From intake"><MonthPick name="intake" label="From intake" value={intake} onChange={setIntake} around={thisYear} /></Field>
        <Field label="Who">
          <select name="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} className={inputCls}>
            <option value="case_staff">Staff on the case</option><option value="team">A team</option>
          </select>
        </Field>
        {recipient === "team" && (
          <Field label="Team">
            <select name="team_id" defaultValue={current?.team_id ?? ""} className={inputCls}>
              <option value="">Choose</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Counted">
          <select name="count_when" value={countWhen} onChange={(e) => setCountWhen(e.target.value)} className={inputCls}>
            <option value="payment">When money comes in</option><option value="stage">When a stage is done</option>
          </select>
        </Field>
        {countWhen === "stage" && (
          <Field label="Stage">
            <select name="count_stage_id" defaultValue={current?.count_stage_id ?? ""} className={inputCls}>
              <option value="">Choose</option>{stages.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}
            </select>
          </Field>
        )}
        <Field label="Paid">
          <select name="cycle" defaultValue={current?.cycle ?? "next_month"} className={inputCls}>
            {Object.entries(CYCLE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
      <p className="text-[13px] text-slate-500">
        {current && /^\d{4}-\d{2}$/.test(intake) ? `Cases with intake before ${fmtMonth(`${intake}-01`)} keep the current rule. Cases from ${fmtMonth(`${intake}-01`)} use this one.` : "Choose the intake the new rate starts from."}
      </p>
      <div className="flex gap-2">
        <Submit>Save new rate</Submit>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel</button>
      </div>
    </form>
  );
}
