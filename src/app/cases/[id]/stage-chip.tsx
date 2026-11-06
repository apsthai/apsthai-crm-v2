"use client";

import { useEffect, useRef, useState } from "react";
import { inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { updateStage } from "./actions";

export type ChipState = "done" | "now" | "todo" | "skip" | "fail" | "pending";

const LOOK: Record<ChipState, { icon: string; cls: string; label: string }> = {
  done: { icon: "✓", cls: "border-navy bg-navy text-white", label: "Completed" },
  now: { icon: "●", cls: "border-navy bg-navy-50 text-navy", label: "In progress" },
  todo: { icon: "○", cls: "border-slate-200 bg-white text-slate-500", label: "Not started" },
  skip: { icon: "–", cls: "border-slate-200 bg-slate-50 text-slate-400", label: "Skipped" },
  fail: { icon: "✕", cls: "border-red-200 bg-red-50 text-brand-red", label: "Failed" },
  pending: { icon: "⏳", cls: "border-amber-300 bg-amber-50 text-amber-800", label: "Waiting for admin approval" },
};

const STATUSES = [
  ["in_progress", "In progress"], ["completed", "Completed"], ["skipped", "Skipped"], ["failed", "Failed"], ["not_started", "Not started"],
];

export function StageChip({ caseId, applicationId, stageId, name, state, note, success, canEdit, big, today }: {
  caseId: string; applicationId?: string | null; stageId: string; name: string; state: ChipState; note?: string;
  success: boolean; canEdit: boolean; big?: boolean; today: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const look = LOOK[state];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const label = `${look.icon} ${name}${success ? " ★" : ""}`;
  const cls = big
    ? `flex min-w-36 flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left ${look.cls}`
    : `rounded-full border px-2.5 py-1 text-xs font-medium ${look.cls}`;

  return (
    <div ref={box} className="relative">
      <button type="button" disabled={!canEdit} onClick={() => setOpen(!open)} aria-expanded={open}
        title={`${name}: ${look.label}`} className={`${cls} ${canEdit ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}>
        {big ? (<><span className="text-sm font-semibold">{label}</span><span className="text-xs opacity-85">{note ?? look.label}</span></>) : label}
      </button>
      {open && (
        <form action={updateStage} className="absolute top-full left-0 z-20 mt-2 flex w-72 flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-lg">
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="stage_id" value={stageId} />
          {applicationId && <input type="hidden" name="application_id" value={applicationId} />}
          <div className="text-sm font-semibold">{name}</div>
          {success && <p className="text-xs text-amber-800">Completing this stage sends the case to Admin for approval.</p>}
          <label className="flex flex-col gap-1 text-[13px] font-medium text-slate-600">Status
            <select name="status" defaultValue={state === "done" ? "completed" : state === "now" ? "completed" : "in_progress"} className={inputCls}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-slate-600">Date
            <input type="date" name="date" defaultValue={today} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-slate-600">Note
            <input name="remark" placeholder="Optional" className={inputCls} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <Submit>Save</Submit>
          </div>
        </form>
      )}
    </div>
  );
}
