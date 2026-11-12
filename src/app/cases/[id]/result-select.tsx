"use client";

import { useFormStatus } from "react-dom";

// Saves the school's result as soon as one is chosen (no Save button).
export function ResultSelect({ value, options, look }: { value: string; options: string[][]; look: string }) {
  const { pending } = useFormStatus();
  return (
    <span className="flex items-center gap-1.5">
      <select name="result" defaultValue={value} aria-label="Result" disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`rounded-full border-0 px-3 py-1 text-xs font-semibold disabled:opacity-60 ${look}`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {pending && <span aria-label="Saving" className="size-3.5 animate-spin rounded-full border-2 border-navy/30 border-t-navy" />}
    </span>
  );
}
