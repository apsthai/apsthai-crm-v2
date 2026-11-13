"use client";

import { useState } from "react";
import { DatePick } from "@/components/date-pick";
import { Field, inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { fmtDate, fmtMonth, addMonths, monthStart } from "@/lib/dates";
import { n2, round2 } from "@/lib/fin";
import { recordPayment } from "../../actions";

type Line = { receivableId: string; student: string; left: number; staff: string[]; teamPct: number; teamNote: string;
  partner: string | null; partnerPct: number };
type Sched = { period_start: string; pay_date: string; partner_pay_date: string | null };
const toNum = (s: string) => Number(s.replace(/,/g, "")) || 0;

export function MoneyIn({ invoiceId, invoiceNo, payer, currency, whtPct, lines, schedules, today }:
  { invoiceId: string; invoiceNo: string; payer: string; currency: string; whtPct: number; lines: Line[]; schedules: Sched[]; today: string }) {
  const [date, setDate] = useState(today);
  const [thb, setThb] = useState("");
  const [part, setPart] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.receivableId, n2(l.left)])));

  const received = toNum(thb);
  // A Thai company keeps 3% of the amount before VAT, so what reached us is 1 - 3/107 of the full amount.
  const wht = whtPct ? round2(received / (1 - whtPct / 107) - received) : 0;
  const paying = lines.map((l) => ({ ...l, pay: part ? Math.min(toNum(amounts[l.receivableId] ?? "0"), l.left) : l.left }));
  const payTotal = paying.reduce((s, l) => s + l.pay, 0);
  const sched = schedules.find((s) => s.period_start === monthStart(date));

  return (
    <form action={recordPayment} className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5 rounded-xl border-2 border-navy bg-white p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Money in for {invoiceNo}</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">{payer} · {currency} {n2(lines.reduce((s, l) => s + l.left, 0))} left · {lines.length} {lines.length === 1 ? "student" : "students"}</p>
      </div>
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="wht_thb" value={wht} />
      <input type="hidden" name="part" value={part ? "1" : ""} />
      <input type="hidden" name="lines" value={part ? JSON.stringify(paying.map((l) => ({ receivable_id: l.receivableId, amount: round2(l.pay) }))) : ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date in the bank">
          <DateWatch onChange={setDate}><DatePick name="date" defaultValue={today} label="Date in the bank" /></DateWatch>
        </Field>
        <Field label="THB that came in">
          <input name="received_thb" value={thb} onChange={(e) => setThb(e.target.value)} inputMode="decimal" required placeholder="0.00"
            className={`${inputCls} text-right`} />
        </Field>
      </div>
      <p className="text-xs text-slate-500">
        Enter what actually reached the account. Bank fees are not added back.
        {whtPct > 0 && <> The 3% withheld is worked out for you{received > 0 && <>: <b>฿{n2(wht)}</b></>}.</>}
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={part} onChange={(e) => setPart(e.target.checked)} className="size-4 accent-navy" />
        Only part of the invoice was paid
      </label>
      {part && (
        <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
          {lines.map((l) => (
            <label key={l.receivableId} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">{l.student} <span className="text-xs text-slate-500">(left {n2(l.left)})</span></span>
              <input value={amounts[l.receivableId]} onChange={(e) => setAmounts((a) => ({ ...a, [l.receivableId]: e.target.value }))}
                inputMode="decimal" aria-label={`${currency} paid for ${l.student}`} className={`${inputCls} w-32 text-right`} />
            </label>
          ))}
          <p className="text-xs text-slate-500">In {currency}. Put 0 for a student not paid this time.</p>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
        <h3 className="text-sm font-semibold text-slate-900">What this pays out</h3>
        {paying.filter((l) => l.pay > 0).map((l) => {
          const share = payTotal ? l.pay / payTotal : 0;
          const exVat = ((received + wht) * share) / 1.07;
          const team = (exVat * l.teamPct) / 100;
          const partner = (exVat * 1.07 * l.partnerPct) / 100;
          return (
            <div key={l.receivableId} className="flex flex-col gap-1 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px]">
              <div className="flex justify-between font-semibold"><span>{l.student}</span><span>฿{n2(received * share)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Before VAT (÷ 1.07)</span><span>฿{n2(exVat)}</span></div>
              <div className="flex justify-between gap-2 text-slate-600">
                <span>Team {l.teamNote || `${l.teamPct}%`} · {l.staff.join(", ") || "no staff"}{l.staff.length > 1 && l.teamPct ? ` (÷ ${l.staff.length})` : ""}</span>
                <span>฿{n2(team)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Partner{l.partner ? ` ${l.partner} ${l.partnerPct}%` : ""}</span><span>{l.partner ? `฿${n2(partner)}` : "-"}</span>
              </div>
            </div>
          );
        })}
        <p className="text-xs text-slate-500">THB is shared across the students by their amounts on the invoice. A partner gets their % of the THB that came in, VAT included.</p>
      </div>

      <div className="flex flex-col gap-0.5 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px]">
        <div><b>Money in {fmtMonth(date)}</b> → checked in {fmtMonth(addMonths(date, 1))}</div>
        {sched
          ? <div>Team paid <b>{fmtDate(sched.pay_date)}</b> · partners paid <b>{fmtDate(sched.partner_pay_date ?? sched.pay_date)}</b></div>
          : <div className="text-brand-red">No pay date set for this month yet.</div>}
      </div>
      <Submit>Save money in</Submit>
      <p className="text-xs text-slate-500">Only part paid? Tick the box above. The invoice shows &quot;Part paid&quot; until the rest arrives.</p>
    </form>
  );
}

// Reads the date picker's hidden input when it changes, so the pay dates above follow the chosen date.
function DateWatch({ onChange, children }: { onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <span onChange={(e) => {
      const box = (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>('input[name="date"]');
      // The hidden input updates after React renders, so read it on the next tick.
      setTimeout(() => box && onChange(box.value), 0);
    }}>{children}</span>
  );
}
