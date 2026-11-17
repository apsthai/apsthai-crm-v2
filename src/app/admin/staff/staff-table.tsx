"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { LoginActions } from "./login-actions";
import { DeleteButton } from "@/components/delete-button";
import { addStaff, deleteStaff, saveKpi, updateStaff } from "./staff-actions";

export type StaffRow = {
  id: string; codename: string; firstname: string | null; lastname: string | null; username: string; role: string;
  org: string; employment: string; handles_cases: boolean; active: boolean; auth_user_id: string | null; kpi: number | null; canDelete: boolean;
};
const TYPE: Record<string, string> = { full_time: "Full-time", part_time: "Part-time" };
const cycleLabel = (c: string) => `${c.slice(0, 4)}-${String((Number(c.slice(0, 4)) + 1) % 100).padStart(2, "0")}`;

export function StaffTable({ rows, cycle, cycles, meId }: { rows: StaffRow[]; cycle: string; cycles: string[]; meId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-[1_1_420px]">
          <h2 className="text-base font-semibold text-slate-900">Staff</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            KPI is points for the cycle {cycleLabel(cycle)} (Sep to Aug). Leave it blank for no KPI. For a change mid-cycle, set the KPI yourself.
            Staff sign in with their username; a new password is shown to you once.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">Cycle
          <select value={cycle.slice(0, 4)} onChange={(e) => router.push(`/admin/staff?cycle=${e.target.value}`)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
            {cycles.map((c) => <option key={c} value={c.slice(0, 4)}>{cycleLabel(c)}</option>)}
          </select>
        </label>
      </div>
      <form id="kpi-form" action={saveKpi}><input type="hidden" name="cycle" value={cycle} /></form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              {["Name", "Company", "Type", "Handles cases", "KPI points", "Login", ""].map((h, i) => (
                <th key={i} className={`border-b border-slate-200 px-4 py-2.5 font-semibold ${i === 4 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const open = editing === r.id;
              const login = !r.auth_user_id ? ["No login", "bg-slate-100 text-slate-600"]
                : r.active ? ["Can sign in", "bg-emerald-50 text-emerald-700"] : ["Switched off", "bg-red-50 text-brand-red"];
              return [
                <tr key={r.id} className={open ? "bg-slate-50" : ""}>
                  <td className="border-b border-slate-100 px-4 py-2.5">
                    <span className="font-medium text-slate-900">{r.codename}</span>
                    {r.role === "admin" && <span className="ml-1.5 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy">Admin</span>}
                    <div className="text-xs text-slate-500">{[r.firstname, r.lastname].filter(Boolean).join(" ")} · <span className="font-mono">{r.username}</span></div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5">{r.org}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5">{TYPE[r.employment] ?? r.employment}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5">{r.handles_cases ? "Yes" : "No"}</td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-right">
                    <input form="kpi-form" name={`kpi_${r.id}`} defaultValue={r.kpi ?? ""} inputMode="decimal" aria-label={`KPI for ${r.codename}`}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right" />
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${login[1]}`}>{login[0]}</span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-2.5 text-right">
                    <button type="button" onClick={() => setEditing(open ? null : r.id)} aria-expanded={open}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-navy hover:border-navy">{open ? "Close" : "Edit"}</button>
                  </td>
                </tr>,
                open && (
                  <tr key={`${r.id}-edit`} className="bg-slate-50">
                    <td colSpan={7} className="border-b border-slate-200 px-4 pt-1 pb-4">
                      <div className="flex flex-wrap items-start gap-x-6 gap-y-4 rounded-lg border border-slate-200 bg-white p-4">
                        <form action={updateStaff} className="grid min-w-0 flex-[999_1_520px] gap-3 sm:grid-cols-3">
                          <input type="hidden" name="id" value={r.id} />
                          <Field label="Nickname"><input name="codename" defaultValue={r.codename} required className={inputCls} /></Field>
                          <Field label="First name"><input name="firstname" defaultValue={r.firstname ?? ""} required className={inputCls} /></Field>
                          <Field label="Last name"><input name="lastname" defaultValue={r.lastname ?? ""} required className={inputCls} /></Field>
                          <Field label="Company"><select name="org" defaultValue={r.org} className={inputCls}><option>APSthai</option><option>APSworld</option></select></Field>
                          <Field label="Type">
                            <select name="employment" defaultValue={r.employment} className={inputCls}>
                              <option value="full_time">Full-time</option><option value="part_time">Part-time</option>
                            </select>
                          </Field>
                          <Field label="Handles cases">
                            <select name="handles_cases" defaultValue={r.handles_cases ? "yes" : "no"} className={inputCls}>
                              <option value="yes">Yes</option><option value="no">No</option>
                            </select>
                          </Field>
                          <div className="flex gap-2 sm:col-span-3">
                            <Submit>Save</Submit>
                            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel</button>
                          </div>
                        </form>
                        <div className="flex flex-[1_1_220px] flex-col gap-2 border-slate-200 sm:border-l sm:pl-6">
                          <span className="text-sm font-medium text-slate-700">Login · <span className="font-mono">{r.username}</span></span>
                          <LoginActions staffId={r.id} username={r.username} hasLogin={!!r.auth_user_id} active={r.active} isMe={r.id === meId} />
                          {r.canDelete && (
                            <div className="mt-2 border-t border-slate-100 pt-3">
                              <span className="mb-1.5 block text-[13px] text-slate-500">Added by mistake? No login, no cases and no team yet.</span>
                              <DeleteButton action={deleteStaff} fields={{ id: r.id }} label="Delete this person" question={`Delete ${r.codename}?`} />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <span className="text-[13px] text-slate-500">Changes to nickname, company and type are saved with Edit. KPI numbers are saved here.</span>
        <button type="submit" form="kpi-form" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark">Save KPI</button>
      </div>
    </section>
  );
}

export function AddStaff({ cycle }: { cycle: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">+ Add staff</h2>
      <p className="mt-0.5 text-[13px] text-slate-500">After adding, open Edit on their row to make the login.</p>
      <form action={addStaff} className="mt-3 grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="cycle" value={cycle} />
        <Field label="Nickname"><input name="codename" required placeholder="Game" className={inputCls} /></Field>
        <Field label="First name"><input name="firstname" required className={inputCls} /></Field>
        <Field label="Last name"><input name="lastname" required className={inputCls} /></Field>
        <Field label="Username"><input name="username" required placeholder="game" pattern="[a-z0-9][a-z0-9._\-]{1,30}" title="Small letters and numbers" className={inputCls} /></Field>
        <Field label="Company"><select name="org" defaultValue="APSworld" className={inputCls}><option>APSworld</option><option>APSthai</option></select></Field>
        <Field label="Type">
          <select name="employment" defaultValue="part_time" className={inputCls}><option value="part_time">Part-time</option><option value="full_time">Full-time</option></select>
        </Field>
        <Field label="Handles cases">
          <select name="handles_cases" defaultValue="yes" className={inputCls}><option value="yes">Yes</option><option value="no">No</option></select>
        </Field>
        <Field label={`KPI points ${cycleLabel(cycle)} (blank = none)`}><input name="kpi" inputMode="decimal" className={inputCls} /></Field>
        <div className="flex justify-end sm:col-span-4"><Submit>Add staff</Submit></div>
      </form>
    </section>
  );
}
