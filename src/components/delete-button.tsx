"use client";

import { useState } from "react";
import { Submit } from "./submit";

// Delete with a second click to confirm. Shown only for rows nothing else uses yet.
// Normal mode makes its own small form; inForm mode sits inside another form and needs a bound action.
export function DeleteButton({ action, fields = {}, label = "Delete", question, inForm = false, small = false }: {
  action: (fd: FormData) => void | Promise<void>; fields?: Record<string, string>; label?: string; question: string;
  inForm?: boolean; small?: boolean;
}) {
  const [sure, setSure] = useState(false);
  const btn = small ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-[13px]";
  if (!sure) return (
    <button type="button" onClick={() => setSure(true)} className={`rounded-lg border border-red-300 bg-white text-brand-red hover:bg-red-50 ${btn}`}>{label}</button>
  );
  const body = (
    <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-slate-600">
      {question}
      {inForm
        ? <button formAction={action} className={`rounded-lg border border-red-300 bg-white font-medium text-brand-red hover:bg-red-50 ${btn}`}>Yes, delete</button>
        : <Submit variant="danger" className={btn}>Yes, delete</Submit>}
      <button type="button" onClick={() => setSure(false)} className={`rounded-lg border border-slate-300 bg-white text-slate-600 ${btn}`}>No</button>
    </span>
  );
  if (inForm) return body;
  return (
    <form action={action} className="inline">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {body}
    </form>
  );
}
