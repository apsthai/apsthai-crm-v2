"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Field, inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { money, n2 } from "@/lib/fin";
import type { Rv } from "@/lib/fin-data";
import { addReceivable, dropReceivable } from "./actions";

type Row = Rv & { approved: string };
const sel = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-navy";

export function CollectTable({ rows, addByHand }: { rows: Row[]; addByHand: React.ReactNode }) {
  const [school, setSchool] = useState("");
  const [cur, setCur] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const schools = useMemo(() => [...new Set(rows.map((r) => r.school || "No institution"))].sort(), [rows]);
  const currencies = useMemo(() => [...new Set(rows.map((r) => r.currency))].sort(), [rows]);
  const shown = rows.filter((r) => (!school || (r.school || "No institution") === school) && (!cur || r.currency === cur));
  const chosen = rows.filter((r) => picked.includes(r.id));
  const pickedCur = chosen[0]?.currency;
  const total = chosen.reduce((s, r) => s + r.amount, 0);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-[1_1_320px]">
          <h2 className="text-base font-semibold text-slate-900">To collect</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Amounts made when Admin approved a case. Tick the students to put on one invoice. You choose who to bill on the next step.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Institution" value={school} onChange={(e) => setSchool(e.target.value)} className={sel}>
            <option value="">All institutions</option>
            {schools.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select aria-label="Currency" value={cur} onChange={(e) => setCur(e.target.value)} className={sel}>
            <option value="">All currencies</option>
            {currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="border-b border-slate-200 px-4 py-2.5 font-semibold"><span className="sr-only">Pick</span></th>
              <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">Student</th>
              <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">Institution · programme</th>
              <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">Service</th>
              <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">How it is worked out</th>
              <th className="border-b border-slate-200 px-4 py-2.5 text-right font-semibold">Amount</th>
              <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">Staff</th>
              <th className="border-b border-slate-200 px-4 py-2.5"><span className="sr-only">Not collecting</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nothing to collect right now.</td></tr>
            )}
            {shown.map((r) => {
              const on = picked.includes(r.id);
              const blocked = !on && !!pickedCur && r.currency !== pickedCur;
              return (
                <tr key={r.id} className={on ? "bg-navy-50/60" : ""}>
                  <td className="border-b border-slate-100 px-4 py-2.5">
                    <input type="checkbox" aria-label={`Pick ${r.student}`} checked={on} disabled={blocked} onChange={() => toggle(r.id)}
                      title={blocked ? `One invoice has one currency (${pickedCur})` : undefined} className="size-4 accent-navy" />
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5">
                    <Link href={`/cases/${r.caseId}`} className="font-medium text-navy hover:underline">{r.student}</Link>
                    <div className="text-xs text-slate-500">Added {r.approved}</div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5">{[r.school, r.programme].filter(Boolean).join(" · ") || "-"}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-slate-600">{r.service}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-slate-600">{r.how}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-right font-medium whitespace-nowrap">{money(r.amount, r.currency)}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-slate-600">{r.staff.join(", ")}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-right">
                    <details className="relative inline-block">
                      <summary className="cursor-pointer list-none text-xs text-slate-500 hover:text-brand-red">Not collecting</summary>
                      <form action={dropReceivable} className="absolute right-0 z-10 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
                        <input type="hidden" name="id" value={r.id} />
                        <p className="mb-2 text-[13px] text-slate-600">Take {r.student} off this list? Use this when we will not bill this amount.</p>
                        <Submit variant="danger" className="w-full">Yes, not collecting</Submit>
                      </form>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <span className="text-sm text-slate-600">
          {chosen.length ? <><b>{chosen.length} {chosen.length === 1 ? "student" : "students"}</b> picked · {pickedCur} {n2(total)}</> : "Tick students to bill"}
        </span>
        <div className="flex flex-wrap gap-2">
          {addByHand}
          {chosen.length > 0 ? (
            <Link href={`/financial/invoices/new?r=${picked.join(",")}`}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark">
              Create invoice for {chosen.length} {chosen.length === 1 ? "student" : "students"}
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500">Create invoice</span>
          )}
        </div>
      </div>
    </section>
  );
}

const CURS = ["GBP", "THB", "SGD", "USD", "AUD", "EUR", "NZD", "CAD", "CHF"];

export function AddByHand({ cases }: { cases: { id: string; label: string }[] }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-navy hover:border-navy">
        + Add an amount by hand
      </summary>
      <form action={addReceivable}
        className="absolute right-0 bottom-full z-10 mb-2 flex w-[min(360px,90vw)] flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <Field label="Case">
          <select name="case_id" required className={inputCls} defaultValue="">
            <option value="" disabled>Choose a case</option>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="What it is">
          <select name="type" className={inputCls} defaultValue="commission">
            <option value="commission">Commission from a school</option>
            <option value="service_fee">Service fee</option>
          </select>
        </Field>
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <Field label="Currency">
            <select name="currency" className={inputCls} defaultValue="GBP">{CURS.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Amount">
            <input name="amount" required inputMode="decimal" className={`${inputCls} text-right`} placeholder="0.00" />
          </Field>
        </div>
        <Submit>Add to the list</Submit>
      </form>
    </details>
  );
}
