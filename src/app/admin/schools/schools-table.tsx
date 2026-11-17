"use client";

import { useState } from "react";
import { Field, inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { COUNTRIES, n2 } from "@/lib/fin";
import { DeleteButton } from "@/components/delete-button";
import { addSchoolService, deleteSchool, deleteSchoolService, saveSchool } from "./actions";

type Term = { id: string; seq: number; type: string; payer_type: string; rate_pct: number | null; amount: number | null; currency: string | null; repeat: string; trigger_stage_id: string | null; bill_month: number | null };
type Product = { id: string; active: boolean; category: { id: string; name_en: string } | null; terms: Term[]; canDelete?: boolean };
export type SchoolRow = { id: string; name: string; country: string; type: string; default_currency: string | null; notes: string | null; active: boolean; products: Product[]; canDelete?: boolean };
type Stage = { id: string; category_id: string; name_en: string };

const TYPES = [["boarding_school", "Boarding school"], ["university", "University"], ["summer_provider", "Summer provider"],
  ["thai_school", "School in Thailand"], ["in_house", "APSthai (in-house)"], ["other", "Other"]];
const CURS = ["GBP", "THB", "SGD", "USD", "AUD", "EUR", "NZD", "CAD", "CHF"];
const byStaff = (s: SchoolRow) => !!s.notes?.startsWith("Added by");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const val = (t: Term) => Number(t.rate_pct ?? t.amount ?? 0);
// One line per service: the whole rate (all instalments added up) and how many instalments.
const termText = (terms: Term[], cur: string | null) => {
  const t = terms[0];
  if (!t) return "No rate yet";
  const sum = Math.round(terms.reduce((s, x) => s + val(x), 0) * 100) / 100;
  const what = t.rate_pct != null ? `${sum}% of the fee` : `${t.currency ?? cur ?? ""} ${n2(sum)} fixed`;
  return terms.length > 1 ? `${what} in ${terms.length} instalments` : what;
};

export function SchoolsTable({ schools, categories, stages, open }:
  { schools: SchoolRow[]; categories: { id: string; name_en: string }[]; stages: Stage[]; open: string | null }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(open);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = schools.filter((s) => (filter === "all" || (filter === "staff" ? byStaff(s) : s.type === filter))
    && words.every((w) => `${s.name} ${s.country} ${s.products.map((p) => p.category?.name_en).join(" ")}`.toLowerCase().includes(w)));
  const nStaff = schools.filter(byStaff).length;
  const stageName = (id: string | null) => stages.find((x) => x.id === id)?.name_en ?? "-";

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-[1_1_420px]">
          <h2 className="text-base font-semibold text-slate-900">Schools and what they pay us</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            The rate makes the amount to collect when a case is approved. A new rate applies to cases approved after you save it.
            {nStaff > 0 && <> <b className="text-amber-800">{nStaff} added by staff</b> still need their rate checked.</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search school or service" aria-label="Search school"
            className="w-52 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
            <option value="all">All schools</option>
            <option value="staff">Added by staff ({nStaff})</option>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              {["School", "Country", "Service · what we get · counted at", "Currency", ""].map((h, i) => (
                <th key={i} className="border-b border-slate-200 px-4 py-2.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No school found.</td></tr>}
            {shown.map((s) => {
              const isOpen = editing === s.id;
              const products = s.products.filter((p) => p.category);
              return [
                <tr key={s.id} className={isOpen ? "bg-slate-50" : byStaff(s) ? "bg-amber-50/60" : ""}>
                  <td className="border-b border-slate-100 px-4 py-2.5">
                    <span className="font-medium text-slate-900">{s.name}</span>
                    {byStaff(s) && <div className="text-xs font-medium text-amber-800">Added by staff: check the rate</div>}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5">{s.country}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5">
                    {products.length === 0 ? <span className="text-slate-400">No service</span> : products.map((p) => (
                      <div key={p.id}>{p.category!.name_en} · <b className="font-medium">{termText(p.terms, s.default_currency)}</b>
                        <span className="text-slate-500"> · {stageName(p.terms[0]?.trigger_stage_id ?? null)}</span></div>
                    ))}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5">{s.default_currency ?? "-"}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-right">
                    <button type="button" onClick={() => setEditing(isOpen ? null : s.id)} aria-expanded={isOpen}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-navy hover:border-navy">{isOpen ? "Close" : "Edit"}</button>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${s.id}-edit`} className="bg-slate-50">
                    <td colSpan={5} className="border-b border-slate-200 px-4 pt-1 pb-4">
                      <EditSchool key={JSON.stringify([s.name, s.country, s.type, s.default_currency, products.map((p) => [p.id, ...p.terms])])} school={s} products={products} categories={categories} stages={stages} onClose={() => setEditing(null)} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EditSchool({ school, products, categories, stages, onClose }:
  { school: SchoolRow; products: Product[]; categories: { id: string; name_en: string }[]; stages: Stage[]; onClose: () => void }) {
  const has = new Set(products.map((p) => p.category!.id));
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <form action={saveSchool} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={school.id} />
        <input type="hidden" name="products" value={products.map((p) => p.id).join(",")} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Name"><input name="name" defaultValue={school.name} required className={inputCls} /></Field>
          <Field label="Country">
            <select name="country" defaultValue={school.country} className={inputCls}>{[...new Set([school.country, ...COUNTRIES])].map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Type">
            <select name="type" defaultValue={school.type} className={inputCls}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={school.default_currency ?? "GBP"} className={inputCls}>{[...new Set([school.default_currency ?? "GBP", ...CURS])].map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
        </div>
        {products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                  {["Service", "What it is", "Who pays", "How", "Instalments", "Counted at stage", "Repeats", ""].map((h, i) => (
                    <th key={i} className="border-b border-slate-200 px-2 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => <ProductRows key={p.id} p={p} stages={stages.filter((x) => x.category_id === p.category!.id)} />)}
              </tbody>
            </table>
            <p className="mt-1.5 text-xs text-slate-500">
              Each instalment becomes its own amount to collect when a case is approved, reminded in its bill month (blank = no reminder).
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <Submit>Save</Submit>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel</button>
        </div>
      </form>
      <form action={addSchoolService} className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
        <input type="hidden" name="school_id" value={school.id} />
        <Field label="+ Add a service for this school">
          <select name="category_id" defaultValue="" className={inputCls}>
            <option value="" disabled>Choose a service</option>
            {categories.filter((c) => !has.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
          </select>
        </Field>
        <Field label="How">
          <select name="how" defaultValue="percent" className={inputCls}><option value="percent">% of the fee</option><option value="fixed">Fixed amount</option></select>
        </Field>
        <Field label="Rate or amount"><input name="value" defaultValue="10" inputMode="decimal" className={`${inputCls} w-28 text-right`} /></Field>
        <Submit variant="ghost">Add</Submit>
      </form>
      {school.canDelete && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[13px] text-slate-500">
          Added by mistake or a duplicate? No student uses it yet.
          <DeleteButton action={deleteSchool} fields={{ id: school.id }} label="Delete this school" question={`Delete ${school.name}?`} />
        </div>
      )}
    </div>
  );
}

// One service of a school: the shared settings, then one line per instalment (rate or amount, and the bill month).
function ProductRows({ p, stages }: { p: Product; stages: Stage[] }) {
  const terms = [...p.terms].sort((a, b) => a.seq - b.seq);
  const t = terms[0];
  const [vals, setVals] = useState<string[]>(terms.length ? terms.map((x) => String(val(x))) : ["10"]);
  const [months, setMonths] = useState<string[]>(terms.length ? terms.map((x) => (x.bill_month ? String(x.bill_month) : "")) : [""]);
  // Changing the number splits the total equally; each part can still be changed by hand.
  const setCount = (n: number) => {
    const total = vals.reduce((s, v) => s + (Number(v) || 0), 0);
    const each = Math.floor((total / n) * 100) / 100;
    setVals(Array.from({ length: n }, (_, i) => String(i === n - 1 ? Math.round((total - each * (n - 1)) * 100) / 100 : each)));
    setMonths(Array.from({ length: n }, (_, i) => months[i] ?? ""));
  };
  const sel = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";
  const n = vals.length;
  return (
    <>
      <tr>
        <td className="px-2 pt-2 font-medium">{p.category!.name_en}</td>
        <td className="px-2 pt-2">
          <select name={`type_${p.id}`} defaultValue={t?.type ?? "commission"} className={sel}><option value="commission">Commission</option><option value="service_fee">Service fee</option></select>
        </td>
        <td className="px-2 pt-2">
          <select name={`payer_${p.id}`} defaultValue={t?.payer_type ?? "school"} className={sel}><option value="school">The school</option><option value="individual">The family</option></select>
        </td>
        <td className="px-2 pt-2">
          <select name={`how_${p.id}`} defaultValue={t?.amount != null ? "fixed" : "percent"} className={sel}><option value="percent">% of the fee</option><option value="fixed">Fixed amount</option></select>
        </td>
        <td className="px-2 pt-2">
          <select name={`count_${p.id}`} value={n} onChange={(e) => setCount(Number(e.target.value))} aria-label={`Instalments for ${p.category!.name_en}`} className={sel}>
            {[1, 2, 3].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </td>
        <td className="px-2 pt-2">
          <select name={`stage_${p.id}`} defaultValue={t?.trigger_stage_id ?? ""} className={sel}>
            <option value="">Choose</option>
            {stages.map((x) => <option key={x.id} value={x.id}>{x.name_en}</option>)}
          </select>
        </td>
        <td className="px-2 pt-2">
          <select name={`repeat_${p.id}`} defaultValue={t?.repeat ?? "once"} className={sel}><option value="once">Once</option><option value="yearly">Every year</option><option value="termly">Every term</option></select>
        </td>
        <td className="px-2 pt-2 text-right">
          {p.canDelete && <DeleteButton inForm small action={deleteSchoolService.bind(null, p.id)} question={`Remove ${p.category!.name_en}?`} label="Remove" />}
        </td>
      </tr>
      <tr>
        <td className="border-b border-slate-100 px-2 pb-2" />
        <td colSpan={7} className="border-b border-slate-100 px-2 pt-1.5 pb-2.5">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {vals.map((v, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
                {n > 1 ? `Instalment ${i + 1}` : "Rate or amount"}
                <input name={`value_${p.id}_${i + 1}`} value={v} onChange={(e) => setVals(vals.map((x, j) => (j === i ? e.target.value : x)))}
                  inputMode="decimal" aria-label={`Rate or amount, instalment ${i + 1}`} className={`${sel} w-24 text-right`} />
                <select name={`month_${p.id}_${i + 1}`} value={months[i] ?? ""} onChange={(e) => setMonths(months.map((x, j) => (j === i ? e.target.value : x)))}
                  aria-label={`Bill month, instalment ${i + 1}`} className={sel}>
                  <option value="">Bill month</option>
                  {MONTHS.map((m, j) => <option key={m} value={j + 1}>{m}</option>)}
                </select>
              </span>
            ))}
          </div>
        </td>
      </tr>
    </>
  );
}
