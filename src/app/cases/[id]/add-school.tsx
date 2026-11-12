"use client";

import { useState } from "react";
import { Field, inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { addApplication } from "./actions";

type School = { id: string; name: string; currency: string | null };
const COUNTRY_CURRENCY: Record<string, string> = {
  "United Kingdom": "GBP", Singapore: "SGD", Australia: "AUD", "New Zealand": "NZD", "United States": "USD",
  Canada: "CAD", Switzerland: "CHF", Ireland: "EUR", Netherlands: "EUR", Germany: "EUR", France: "EUR",
  Spain: "EUR", Italy: "EUR", Thailand: "THB",
};
const TYPES = [["boarding_school", "Boarding school"], ["university", "University"], ["summer_provider", "Summer provider"], ["other", "Other"]];

// "+ Add school": pick a school we work with, or add one that is not in the list yet (10% commission until Admin checks the contract).
export function AddSchool({ caseId, schools, currencies, ukOnly }: { caseId: string; schools: School[]; currencies: string[]; ukOnly: boolean }) {
  const [pick, setPick] = useState("");
  const [country, setCountry] = useState(ukOnly ? "United Kingdom" : "");
  const [other, setOther] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const isNew = pick === "__new__";

  const choose = (v: string) => {
    setPick(v);
    const s = schools.find((x) => x.id === v);
    if (s?.currency) setCurrency(s.currency);
    if (v === "__new__" && COUNTRY_CURRENCY[country]) setCurrency(COUNTRY_CURRENCY[country]);
  };

  return (
    <form action={addApplication} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="case_id" value={caseId} />
      <Field label="School" className="flex-[2_1_240px]">
        <select name="product_id" required className={inputCls} value={pick} onChange={(e) => choose(e.target.value)}>
          <option value="" disabled>Choose a school</option>
          {schools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="__new__">+ School not in the list…</option>
        </select>
      </Field>

      {isNew && (
        <div className="flex w-full flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
          <Field label="School name *" className="flex-[2_1_220px]"><input name="school_name" required className={inputCls} /></Field>
          {ukOnly ? (
            <Field label="Country" className="flex-[1_1_160px]">
              <input type="hidden" name="country" value="United Kingdom" />
              <div className="py-2 text-sm text-slate-700">United Kingdom</div>
            </Field>
          ) : (
            <>
              <Field label="Country *" className="flex-[1_1_160px]">
                <select required value={country} className={inputCls}
                  onChange={(e) => { setCountry(e.target.value); if (COUNTRY_CURRENCY[e.target.value]) setCurrency(COUNTRY_CURRENCY[e.target.value]); }}>
                  <option value="" disabled>Choose…</option>
                  {Object.keys(COUNTRY_CURRENCY).sort().map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__other__">Other…</option>
                </select>
              </Field>
              {country === "__other__" && (
                <Field label="Country name *" className="flex-[1_1_160px]"><input required value={other} onChange={(e) => setOther(e.target.value)} className={inputCls} /></Field>
              )}
              <input type="hidden" name="country" value={country === "__other__" ? other : country} />
            </>
          )}
          <Field label="Type *" className="flex-[1_1_150px]">
            <select name="school_type" required defaultValue="" className={inputCls}>
              <option value="" disabled>Choose…</option>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <p className="w-full text-[13px] text-slate-500">Commission is set at 10% for now. Admin will check it against the contract.</p>
        </div>
      )}

      <Field label="Programme" className="flex-[1_1_160px]">
        <input name="programme" placeholder="e.g. Year 12" className={inputCls} />
      </Field>
      <Field label="Fee the commission is based on" className="flex-[1_1_160px]">
        <input name="fee" inputMode="decimal" placeholder="e.g. 52000" className={inputCls} />
      </Field>
      <Field label="Currency">
        <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
          {currencies.map((x) => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Submit>Add school</Submit>
    </form>
  );
}
