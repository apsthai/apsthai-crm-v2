"use client";

import { useState } from "react";
import { Field, inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { DeleteButton } from "@/components/delete-button";
import { addService, deleteService, deleteStage, moveService, moveStage, saveService } from "./actions";

type Stage = { id: string; name_en: string; sort_order: number; level: string; milestone: string; probability_pct: number; editable_by_team_id: string | null; active: boolean; canDelete?: boolean };
export type ServiceRow = { id: string; name_en: string; name_th: string | null; points: number | null; estimated_value_thb: number | null;
  in_house: boolean; sort_order: number; active: boolean; cases: number; stages: Stage[] };

const arrow = "rounded border border-slate-300 bg-white px-1.5 text-xs leading-5 text-slate-600 hover:border-navy disabled:opacity-30";

export function ServicesTable({ rows, open, teams }: { rows: ServiceRow[]; open: string | null; teams: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<string | null>(open);
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-base font-semibold text-slate-900">Services</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">
          The order here is the order in New case. A service no case uses can be deleted. One with cases can only be hidden: it no longer shows for new cases. Old cases stay as they are.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              {["Order", "Service", "Points", "Estimated value (THB)", "Stages", "Cases", "Status", ""].map((h, i) => (
                <th key={i} className={`border-b border-slate-200 px-4 py-2.5 font-semibold ${[2, 3, 5].includes(i) ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isOpen = editing === r.id;
              const shown = r.stages.filter((x) => x.active).length;
              return [
                <tr key={r.id} className={isOpen ? "bg-slate-50" : r.active ? "" : "text-slate-400"}>
                  <td className="border-b border-slate-100 px-4 py-2.5">
                    <form action={moveService} className="flex gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <button name="dir" value="up" disabled={i === 0} aria-label={`Move ${r.name_en} up`} className={arrow}>▲</button>
                      <button name="dir" value="down" disabled={i === rows.length - 1} aria-label={`Move ${r.name_en} down`} className={arrow}>▼</button>
                    </form>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5">
                    <span className={`font-medium ${r.active ? "text-slate-900" : ""}`}>{r.name_en}</span>
                    {r.in_house && <span className="ml-1.5 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy">In-house</span>}
                    {r.name_th && <div className="text-xs text-slate-500">{r.name_th}</div>}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-right">{r.points ?? "-"}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-right">{r.estimated_value_thb != null ? Number(r.estimated_value_thb).toLocaleString("en-US") : "-"}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5">{shown} {shown === 1 ? "stage" : "stages"}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-right">{r.cases}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{r.active ? "Shown" : "Hidden"}</span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-right">
                    <button type="button" onClick={() => setEditing(isOpen ? null : r.id)} aria-expanded={isOpen}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-navy hover:border-navy">{isOpen ? "Close" : "Edit"}</button>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${r.id}-edit`} className="bg-slate-50">
                    <td colSpan={8} className="border-b border-slate-200 px-4 pt-1 pb-4">
                      <EditService key={JSON.stringify(r)} row={r} teams={teams} onClose={() => setEditing(null)} />
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

function EditService({ row, teams, onClose }: { row: ServiceRow; teams: { id: string; name: string }[]; onClose: () => void }) {
  const success = row.stages.find((x) => x.milestone === "success")?.id ?? "";
  const sel = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";
  return (
    <form action={saveService} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="stages" value={row.stages.map((x) => x.id).join(",")} />
      <div className="grid gap-3 sm:grid-cols-6">
        <Field label="Name (English)" className="sm:col-span-2"><input name="name_en" defaultValue={row.name_en} required className={inputCls} /></Field>
        <Field label="Name (Thai)" className="sm:col-span-2"><input name="name_th" defaultValue={row.name_th ?? ""} className={inputCls} /></Field>
        <Field label="Points"><input name="points" defaultValue={row.points ?? ""} inputMode="decimal" className={`${inputCls} text-right`} /></Field>
        <Field label="Est. value (THB)"><input name="estimated_value_thb" defaultValue={row.estimated_value_thb ?? ""} inputMode="decimal" className={`${inputCls} text-right`} /></Field>
        <Field label="In-house">
          <select name="in_house" defaultValue={row.in_house ? "yes" : "no"} className={inputCls}><option value="no">No</option><option value="yes">Yes (APSthai&apos;s own)</option></select>
        </Field>
        <Field label="Status">
          <select name="active" defaultValue={row.active ? "yes" : "no"} className={inputCls}><option value="yes">Shown</option><option value="no">Hidden</option></select>
        </Field>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Stages</h3>
        <p className="text-[13px] text-slate-500">
          Chance of closing drives the forecast on the Dashboard. The success stage is the one Admin approves; points and amounts to collect come from it.
          Save your changes before using the arrows.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              {["Order", "Stage", "Chance of closing", "Per", "Success", "Also updated by", "Shown", ""].map((h, i) => (
                <th key={i} className="border-b border-slate-200 px-2 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row.stages.map((x, i) => (
              <tr key={x.id} className={x.active ? "" : "text-slate-400"}>
                <td className="border-b border-slate-100 px-2 py-2">
                  <span className="flex gap-1">
                    <button formAction={moveStage.bind(null, `${x.id}:up`)} disabled={i === 0} aria-label={`Move ${x.name_en} up`} className={arrow}>▲</button>
                    <button formAction={moveStage.bind(null, `${x.id}:down`)} disabled={i === row.stages.length - 1} aria-label={`Move ${x.name_en} down`} className={arrow}>▼</button>
                  </span>
                </td>
                <td className="border-b border-slate-100 px-2 py-2"><input name={`name_${x.id}`} defaultValue={x.name_en} className={`${sel} w-44`} /></td>
                <td className="border-b border-slate-100 px-2 py-2">
                  <input name={`prob_${x.id}`} defaultValue={Number(x.probability_pct)} inputMode="decimal" className={`${sel} w-20 text-right`} /> %
                </td>
                <td className="border-b border-slate-100 px-2 py-2 text-slate-600">{x.level === "application" ? "School" : "Case"}</td>
                <td className="border-b border-slate-100 px-2 py-2">
                  <input type="radio" name="success_stage" value={x.id} defaultChecked={x.id === success} aria-label={`${x.name_en} is the success stage`} className="size-4 accent-navy" />
                </td>
                <td className="border-b border-slate-100 px-2 py-2">
                  <select name={`team_${x.id}`} defaultValue={x.editable_by_team_id ?? ""} className={sel}>
                    <option value="">Case staff only</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name} team</option>)}
                  </select>
                </td>
                <td className="border-b border-slate-100 px-2 py-2">
                  <input type="checkbox" name={`shown_${x.id}`} value="1" defaultChecked={x.active} aria-label={`Show ${x.name_en}`} className="size-4 accent-navy" />
                </td>
                <td className="border-b border-slate-100 px-2 py-2 text-right">
                  {x.canDelete && <DeleteButton inForm small action={deleteStage.bind(null, x.id)} question={`Delete ${x.name_en}?`} />}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-2 py-2 text-xs text-slate-500">New</td>
              <td className="px-2 py-2"><input name="new_stage" placeholder="+ Add a stage" className={`${sel} w-44`} /></td>
              <td className="px-2 py-2"><input name="new_prob" placeholder="0" inputMode="decimal" className={`${sel} w-20 text-right`} /> %</td>
              <td className="px-2 py-2" colSpan={5}>
                <select name="new_level" defaultValue="case" className={sel}><option value="case">Per case</option><option value="application">Per school</option></select>
                <span className="ml-2 text-xs text-slate-500">Added at the end. Use the arrows to move it.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Submit>Save</Submit>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel</button>
        <span className="text-xs text-slate-500">{row.cases} {row.cases === 1 ? "case uses" : "cases use"} this service.</span>
        {row.cases === 0 && <span className="ml-auto"><DeleteButton inForm action={deleteService} label="Delete this service" question={`Delete ${row.name_en} and its stages?`} /></span>}
      </div>
    </form>
  );
}

export function AddService({ services }: { services: { id: string; name: string }[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">+ New service</h2>
      <p className="mt-0.5 text-[13px] text-slate-500">
        Its stages are copied from the service you pick, then you can change them. Set its team commission in the Team commission tab,
        and which schools offer it in Schools &amp; rates.
      </p>
      <form action={addService} className="mt-3 grid gap-3 sm:grid-cols-6">
        <Field label="Name (English)" className="sm:col-span-2"><input name="name_en" required className={inputCls} /></Field>
        <Field label="Name (Thai)" className="sm:col-span-2"><input name="name_th" className={inputCls} /></Field>
        <Field label="Points"><input name="points" inputMode="decimal" className={`${inputCls} text-right`} /></Field>
        <Field label="Est. value (THB)"><input name="estimated_value_thb" inputMode="decimal" className={`${inputCls} text-right`} /></Field>
        <Field label="Copy stages from" className="sm:col-span-2">
          <select name="copy_from" defaultValue={services[0]?.id ?? ""} className={inputCls}>
            <option value="">No stages yet</option>
            {services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="In-house">
          <select name="in_house" defaultValue="no" className={inputCls}><option value="no">No</option><option value="yes">Yes (APSthai&apos;s own)</option></select>
        </Field>
        <div className="flex items-end justify-end sm:col-span-3"><Submit>Add service</Submit></div>
      </form>
    </section>
  );
}
