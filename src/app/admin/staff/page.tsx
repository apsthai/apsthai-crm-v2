import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getMe } from "@/lib/auth";
import { LoginActions } from "./login-actions";

const EMPLOYMENT: Record<string, string> = { full_time: "Full-time", part_time: "Part-time" };

export default async function StaffPage() {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");

  const { data, error } = await sb.from("staff")
    .select("id, codename, firstname, lastname, username, role, org, employment, active, auth_user_id")
    .order("active", { ascending: false }).order("codename");
  if (error) throw new Error(error.message);
  type Row = { id: string; codename: string; firstname: string | null; lastname: string | null; username: string; role: string;
    org: string | null; employment: string | null; active: boolean; auth_user_id: string | null };
  const rows = (data ?? []) as Row[];
  const noLogin = rows.filter((r) => !r.auth_user_id).length;

  return (
    <AppShell active="/admin/staff">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Staff logins</h1>
        <p className="mt-1 text-sm text-slate-500">
          Staff sign in with their username. A new password is made by the system and shown to you once: copy it and send it to the person.
          {noLogin > 0 && ` ${noLogin} ${noLogin === 1 ? "person has" : "people have"} no login yet.`}
        </p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white">
        {rows.map((r) => {
          const status = !r.auth_user_id ? ["No login", "bg-slate-100 text-slate-600"]
            : r.active ? ["Can sign in", "bg-emerald-50 text-emerald-700"] : ["Switched off", "bg-red-50 text-brand-red"];
          return (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5 last:border-b-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{r.codename}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status[1]}`}>{status[0]}</span>
                  {r.role === "admin" && <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy">Admin</span>}
                </div>
                <div className="mt-0.5 text-[13px] text-slate-500">
                  Username <span className="font-mono text-slate-700">{r.username}</span>
                  {r.org ? ` · ${r.org}` : ""}{r.employment ? ` · ${EMPLOYMENT[r.employment] ?? r.employment}` : ""}
                </div>
              </div>
              <LoginActions staffId={r.id} username={r.username} hasLogin={!!r.auth_user_id} active={r.active} isMe={r.id === me.id} />
            </div>
          );
        })}
      </section>
    </AppShell>
  );
}
