"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { DatePick } from "@/components/date-pick";
import { Field, inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { COUNTRIES, n2, round2, thaiTotals } from "@/lib/fin";
import type { Rv } from "@/lib/fin-data";
import { createInvoice, type InvoiceState } from "../../actions";

type Payer = { id: string; name: string; kind: string; address: string | null; country: string | null; tax_id: string | null };
type Line = { receivableId: string; description: string; amount: string };
const KINDS = [["school", "School"], ["agent", "Agent"], ["company", "Company"], ["person", "Person"]];
const toNum = (s: string) => Number(s.replace(/,/g, "")) || 0;

export function InvoiceForm({ start, others, payers, suggested, schoolName, today }:
  { start: Rv[]; others: Rv[]; payers: Payer[]; suggested: string | null; schoolName: string; today: string }) {
  const [state, action] = useActionState<InvoiceState, FormData>(createInvoice, { error: null });
  const all = [...start, ...others];
  const first = payers.find((p) => p.id === suggested);
  const [payerId, setPayerId] = useState(first?.id ?? "");
  const [name, setName] = useState(first?.name ?? schoolName);
  const [kind, setKind] = useState(first?.kind ?? "school");
  const [address, setAddress] = useState(first?.address ?? "");
  const [country, setCountry] = useState(first?.country ?? "United Kingdom");
  const [taxId, setTaxId] = useState(first?.tax_id ?? "");
  const [wht, setWht] = useState((first?.country === "Thailand") && first?.kind === "company");
  const [lines, setLines] = useState<Line[]>(start.map((r) => ({ receivableId: r.id, description: r.defaultText, amount: n2(r.amount) })));

  const currency = start[0].currency;
  const used = new Set(lines.map((l) => l.receivableId));
  const canAdd = others.filter((r) => r.currency === currency && !used.has(r.id));
  const thai = country === "Thailand";
  const total = round2(lines.reduce((s, l) => s + toNum(l.amount), 0));
  const t = thaiTotals(total, thai && wht ? 3 : 0);

  function pickPayer(id: string) {
    setPayerId(id);
    const p = payers.find((x) => x.id === id);
    if (!p) { setName(""); setAddress(""); setTaxId(""); return; }
    setName(p.name); setKind(p.kind); setAddress(p.address ?? ""); setCountry(p.country ?? "United Kingdom"); setTaxId(p.tax_id ?? "");
    setWht(p.country === "Thailand" && p.kind === "company");
  }
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const draft = JSON.stringify({
    payerId: payerId || null, name, kind, address, country, taxId, wht,
    lines: lines.map((l) => ({ receivableId: l.receivableId, description: l.description, amount: round2(toNum(l.amount)) })),
  });

  return (
    <form action={action} className="flex flex-wrap items-start gap-5">
      <input type="hidden" name="draft" value={draft} />
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">1. Who are we billing?</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">Can be the school, an agent that pays for several universities, a Thai company or a person. Not always the place the student studies.</p>
          </div>
          <Field label="Payer">
            <select value={payerId} onChange={(e) => pickPayer(e.target.value)} className={inputCls}>
              <option value="">+ New payer</option>
              {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name on the invoice"><input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <select value={kind} onChange={(e) => { setKind(e.target.value); setWht(thai && e.target.value === "company"); }} className={inputCls}>
                  {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Country">
                <select value={country} onChange={(e) => { setCountry(e.target.value); setWht(e.target.value === "Thailand" && kind === "company"); }} className={inputCls}>
                  {[...new Set([country, ...COUNTRIES])].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Address"><textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} /></Field>
            {thai && <Field label="Tax ID (13 digits)"><input value={taxId} onChange={(e) => setTaxId(e.target.value)} inputMode="numeric" className={inputCls} /></Field>}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
            <span>Invoice language: <b>{thai ? "Thai" : "English"}</b> ({thai ? "payer in Thailand" : "payer outside Thailand"})</span>
            {thai ? (
              <label className={`flex items-center gap-2 ${kind === "company" ? "" : "opacity-50"}`}>
                <input type="checkbox" checked={wht} disabled={kind !== "company"} onChange={(e) => setWht(e.target.checked)} className="size-4 accent-navy" />
                Withholding tax 3% (Thai company)
              </label>
            ) : <span>Total only, no VAT line</span>}
          </div>
          <p className="text-xs text-slate-500">The name and address are saved with the payer, so next time they fill in by themselves.</p>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">2. What we are billing</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">One line per student. The text is free: write what the school asks for, such as their student number.</p>
          </div>
          {lines.map((l, i) => {
            const r = all.find((x) => x.id === l.receivableId)!;
            return (
              <div key={l.receivableId} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_150px_auto]">
                <Field label={`${i + 1}. Text on the invoice`}>
                  <textarea rows={2} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} className={inputCls} />
                </Field>
                <Field label={`Amount (${currency})`}>
                  <input value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} inputMode="decimal" className={`${inputCls} text-right`} />
                </Field>
                <button type="button" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  className="self-end rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-brand-red hover:text-brand-red disabled:opacity-40">Remove</button>
                <div className="text-xs text-slate-500 sm:col-span-3">
                  From case: <Link href={`/cases/${r.caseId}`} className="text-navy hover:underline" target="_blank">{r.student}</Link> · {r.service} · worked out {r.how}
                  {toNum(l.amount) !== r.amount && <> · was {n2(r.amount)}</>}
                </div>
              </div>
            );
          })}
          {canAdd.length > 0 && (
            <select value="" onChange={(e) => {
              const r = others.find((x) => x.id === e.target.value);
              if (r) setLines((ls) => [...ls, { receivableId: r.id, description: r.defaultText, amount: n2(r.amount) }]);
            }} className={`${inputCls} max-w-md text-navy`} aria-label="Add a student">
              <option value="">+ Add a student from To collect ({currency})</option>
              {canAdd.map((r) => <option key={r.id} value={r.id}>{r.student} · {r.school || r.service} · {n2(r.amount)}</option>)}
            </select>
          )}
        </section>
      </div>

      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-xl border-2 border-navy bg-white p-5 lg:sticky lg:top-4">
        <h2 className="text-base font-semibold text-slate-900">3. Invoice</h2>
        <div className="flex justify-between text-sm"><span className="text-slate-500">Invoice no.</span><span>Given when issued</span></div>
        <Field label="Date"><DatePick name="date" defaultValue={today} label="Invoice date" /></Field>
        {thai ? (
          <div className="flex flex-col gap-1 border-t border-slate-200 pt-3 text-sm">
            <Row k="รวมเป็นเงิน" v={n2(t.sub)} />
            <Row k="ภาษีมูลค่าเพิ่ม 7%" v={n2(t.vat)} />
            <Row k={`ยอดรวมทั้งสิ้น (${currency})`} v={n2(t.total)} bold />
            {wht && <><Row k="หัก ภาษี ณ ที่จ่าย 3%" v={n2(t.wht)} /><Row k={`ยอดชำระสุทธิ (${currency})`} v={n2(t.net)} bold /></>}
          </div>
        ) : (
          <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold"><span>TOTAL ({currency})</span><span>{n2(total)}</span></div>
        )}
        {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{state.error}</p>}
        <Submit name="issue" value="1">Issue invoice</Submit>
        <Submit name="issue" value="0" variant="ghost">Save as draft</Submit>
        <p className="text-xs text-slate-500">After it is issued the lines are locked. To change it, cancel the invoice and make a new one; the number is not reused.</p>
      </aside>
    </form>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? "font-semibold" : "text-slate-600"}`}><span>{k}</span><span>{v}</span></div>;
}
