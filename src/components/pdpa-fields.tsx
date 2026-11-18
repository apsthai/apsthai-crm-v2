import { DatePick } from "./date-pick";
import { Field, inputCls } from "./fields";
import { PDPA_BY, PDPA_HOW, splitPdpaLocation } from "@/lib/pdpa";

// The three PDPA consent fields. With optional, "Not yet" can be chosen and nothing is saved.
export function PdpaFields({ today, date, by, location, optional = false }:
  { today: string; date?: string | null; by?: string | null; location?: string | null; optional?: boolean }) {
  const loc = splitPdpaLocation(location ?? null);
  return (
    <>
      <Field label="Consent given by">
        <select name="pdpa_by" defaultValue={by ?? (optional ? "" : "mother")} required={!optional} className={inputCls}>
          {optional && <option value="">Not yet</option>}
          {PDPA_BY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <div className="flex flex-col gap-1 text-[13px] font-medium text-slate-600">Date of consent
        <DatePick name="pdpa_date" defaultValue={date ?? today} label="Date of consent" />
      </div>
      <Field label="Proof kept as">
        <select name="pdpa_how" defaultValue={loc.how || "Paper form"} className={inputCls}>
          {PDPA_HOW.map((h) => <option key={h}>{h}</option>)}
        </select>
      </Field>
      <Field label="Where (optional)"><input name="pdpa_note" defaultValue={loc.note} placeholder="e.g. Drive folder or file name" className={inputCls} /></Field>
    </>
  );
}
