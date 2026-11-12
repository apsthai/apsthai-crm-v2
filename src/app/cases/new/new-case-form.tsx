"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { MonthPick } from "@/components/date-pick";
import { Field, inputCls } from "@/components/fields";
import { Submit } from "@/components/submit";
import { createCase, type NewCaseState } from "./actions";

export type StudentOption = {
  id: string; codename: string; nickname: string; firstname: string | null; lastname: string | null; cases: string[];
};
type Opt = { id: string; name_en: string };

const RELATIONS = [["mother", "Mother"], ["father", "Father"], ["guardian", "Guardian"], ["student", "Student"], ["other", "Other"]];
const APPLICANTS = [["student", "Student"], ["father", "Father"], ["mother", "Mother"], ["guardian", "Guardian"], ["other", "Other"]];
const norm = (v: string | null) => (v ?? "").trim().toLowerCase();

function Box({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StudentLine({ s }: { s: StudentOption }) {
  return (
    <span className="min-w-0">
      <span className="font-medium text-slate-900">{s.codename}</span>
      {s.lastname && <span className="text-slate-500"> {s.lastname}</span>}
      <span className="block text-[13px] text-slate-500">{s.cases.length ? s.cases.join(", ") : "No case yet"}</span>
    </span>
  );
}

export function NewCaseForm({ students, services, channels, staff, me, thisYear }: {
  students: StudentOption[]; services: Opt[]; channels: Opt[]; staff: { id: string; codename: string }[];
  me: { id: string; codename: string; isAdmin: boolean }; thisYear: number;
}) {
  const [state, action] = useActionState<NewCaseState, FormData>(createCase, { error: null });
  const [mode, setMode] = useState<"pick" | "new">("pick");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<StudentOption | null>(null);
  const [st, setSt] = useState({ nickname: "", firstname: "", lastname: "", relation: "mother", phone: "", line: "" });
  const [allowDup, setAllowDup] = useState(false);
  const [cs, setCs] = useState({
    category_id: "", intake: "", lead_channel_id: "", applicant: "student", applicant_name: "", referred_by: "",
    staff1: staff.some((x) => x.id === me.id) ? me.id : "", staff2: "",
  });

  const matches = q.trim().length < 1 ? [] : students.filter((s) =>
    [s.codename, s.nickname, s.firstname, s.lastname].some((v) => norm(v).includes(norm(q)))).slice(0, 8);
  const dups = mode === "new" && norm(st.firstname) ? students.filter((s) => norm(s.firstname) === norm(st.firstname)) : [];
  const staff1 = me.isAdmin ? cs.staff1 : me.id;
  const ready = (mode === "pick" ? !!picked : !!st.nickname.trim() && !!st.firstname.trim() && (dups.length === 0 || allowDup))
    && !!cs.category_id && /^\d{4}-\d{2}$/.test(cs.intake);

  const choose = (s: StudentOption) => { setPicked(s); setMode("pick"); setQ(""); };
  const upd = (k: keyof typeof st) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSt({ ...st, [k]: e.target.value });
  const updC = (k: keyof typeof cs) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setCs({ ...cs, [k]: e.target.value });

  return (
    <form action={action} className="grid max-w-3xl gap-4">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="student_id" value={picked?.id ?? ""} />
      <input type="hidden" name="allow_duplicate" value={allowDup ? "1" : ""} />

      <Box title="1. Student" sub={mode === "pick" ? "Search first. A student can have many cases." : "Nickname and first name are required. The rest can be added later on the case page."}>
        {mode === "pick" && picked && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy/30 bg-navy-50 px-4 py-3">
            <StudentLine s={picked} />
            <button type="button" onClick={() => setPicked(null)} className="text-sm text-navy hover:underline">Change</button>
          </div>
        )}

        {mode === "pick" && !picked && (
          <div className="grid gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by nickname or name"
              aria-label="Search student" className={inputCls} autoFocus />
            {matches.map((s) => (
              <button key={s.id} type="button" onClick={() => choose(s)}
                className="flex rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm hover:border-navy hover:bg-navy-50">
                <StudentLine s={s} />
              </button>
            ))}
            {q.trim() && matches.length === 0 && <p className="text-sm text-slate-500">No student found.</p>}
            <button type="button" onClick={() => { setMode("new"); setSt({ ...st, nickname: st.nickname || q.trim() }); }}
              className="justify-self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy hover:border-navy">
              + New student
            </button>
          </div>
        )}

        {mode === "new" && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nickname *"><input name="nickname" value={st.nickname} onChange={upd("nickname")} className={inputCls} required /></Field>
              <Field label="First name *"><input name="firstname" value={st.firstname} onChange={(e) => { upd("firstname")(e); setAllowDup(false); }} className={inputCls} required /></Field>
              <Field label="Last name"><input name="lastname" value={st.lastname} onChange={upd("lastname")} className={inputCls} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Contact person">
                <select name="relation" value={st.relation} onChange={upd("relation")} className={inputCls}>
                  {RELATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Phone"><input name="phone" value={st.phone} onChange={upd("phone")} className={inputCls} inputMode="tel" /></Field>
              <Field label="LINE ID"><input name="line" value={st.line} onChange={upd("line")} className={inputCls} /></Field>
            </div>

            {dups.length > 0 && (
              <div role="alert" className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
                <p className="font-medium text-amber-900">
                  {dups.length === 1 ? "A student" : `${dups.length} students`} with the first name &quot;{st.firstname.trim()}&quot; already {dups.length === 1 ? "exists" : "exist"}. Is it the same person?
                </p>
                {dups.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                    <StudentLine s={s} />
                    <button type="button" onClick={() => choose(s)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-medium text-navy hover:border-navy">Use this student</button>
                  </div>
                ))}
                <label className="flex items-center gap-2 text-amber-900">
                  <input type="checkbox" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} />
                  No, this is a different student. Create a new one.
                </label>
              </div>
            )}

            <button type="button" onClick={() => { setMode("pick"); setAllowDup(false); }} className="justify-self-start text-sm text-navy hover:underline">
              ← Search existing students instead
            </button>
          </div>
        )}
      </Box>

      <Box title="2. Case">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Service *">
            <select name="category_id" value={cs.category_id} onChange={updC("category_id")} className={inputCls} required>
              <option value="">Choose…</option>
              {services.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
          </Field>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[13px] font-medium text-slate-600">Intake (month and year) *</span>
            <MonthPick name="intake" label="Intake" value={cs.intake} onChange={(v) => setCs({ ...cs, intake: v })} around={thisYear} required />
          </div>
          <Field label="Lead source">
            <select name="lead_channel_id" value={cs.lead_channel_id} onChange={updC("lead_channel_id")} className={inputCls}>
              <option value="">-</option>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
          </Field>
          <Field label="Referred by">
            <input name="referred_by" value={cs.referred_by} onChange={updC("referred_by")} className={inputCls} />
          </Field>
          <Field label="Client (who signs up)">
            <select name="applicant" value={cs.applicant} onChange={updC("applicant")} className={inputCls}>
              {APPLICANTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {cs.applicant !== "student" && (
            <Field label="Client name (if known)">
              <input name="applicant_name" value={cs.applicant_name} onChange={updC("applicant_name")} className={inputCls} />
            </Field>
          )}
        </div>
      </Box>

      <Box title="3. Staff" sub="Up to 2 people. Points and commission are split equally.">
        <div className="grid gap-3 sm:grid-cols-2">
          {me.isAdmin ? (
            <Field label="Staff 1">
              <select name="staff1" value={cs.staff1} onChange={updC("staff1")} className={inputCls}>
                {staff.map((x) => <option key={x.id} value={x.id}>{x.codename}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Staff 1"><div className="py-2 text-sm text-slate-900">{me.codename} (you)</div></Field>
          )}
          <Field label="Staff 2 (optional)">
            <select name="staff2" value={cs.staff2} onChange={updC("staff2")} className={inputCls}>
              <option value="">-</option>
              {staff.filter((x) => x.id !== staff1).map((x) => <option key={x.id} value={x.id}>{x.codename}</option>)}
            </select>
          </Field>
        </div>
      </Box>

      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-brand-red">Could not save: {state.error}</p>}
      <div className="flex items-center gap-3">
        <Submit className={ready ? "" : "pointer-events-none opacity-50"}>Create case</Submit>
        <Link href="/cases" className="text-sm text-slate-600 hover:text-navy">Cancel</Link>
        {!ready && <span className="text-[13px] text-slate-500">Choose or add a student, a service and an intake.</span>}
      </div>
    </form>
  );
}
