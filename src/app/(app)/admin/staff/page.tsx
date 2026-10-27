import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { addStaff, loginAction, saveTeam, updateStaff } from "../actions";

export default async function StaffAdmin() {
  const { supabase: sb } = await requireAdmin();
  const { t } = await getT();
  const [{ data: staff }, { data: teams }] = await Promise.all([
    sb.from("staff").select("*").order("active", { ascending: false }).order("codename"),
    sb.from("teams").select("id, name, team_members(staff_id)").order("name"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="h1">{t("staffUsers")}</h1>
      <Card>
        <div className="space-y-3">
          {(staff ?? []).map((s: any) => (
            <div key={s.id} className={`rounded-lg border p-3 ${s.active ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"}`}>
              <form action={updateStaff} className="grid items-end gap-2 sm:grid-cols-7">
                <input type="hidden" name="id" value={s.id} />
                <label><span className="label">{t("codename")}</span><input name="codename" className="input" defaultValue={s.codename} /></label>
                <label><span className="label">{t("firstname")}</span><input name="firstname" className="input" defaultValue={s.firstname} /></label>
                <label><span className="label">{t("lastname")}</span><input name="lastname" className="input" defaultValue={s.lastname} /></label>
                <label><span className="label">{t("role")}</span>
                  <select name="role" className="input" defaultValue={s.role}><option value="staff">staff</option><option value="admin">admin</option></select></label>
                <label><span className="label">{t("org")}</span>
                  <select name="org" className="input" defaultValue={s.org}><option>APSthai</option><option>APSworld</option></select></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="handles_cases" defaultChecked={s.handles_cases} /> {t("handlesCases")}</label>
                <button className="btn-ghost">{t("save")}</button>
              </form>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500">{t("username")}: <b>{s.username}</b> · {s.auth_user_id ? t("hasLogin") : t("noLogin")}</span>
                <form action={loginAction} className="flex gap-1">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="action" value={s.auth_user_id ? "reset_password" : "create_login"} />
                  <input name="password" type="text" minLength={8} placeholder={t("newPassword")} className="input w-56 py-1" required autoComplete="off" />
                  <button className="btn-ghost py-1">{s.auth_user_id ? t("resetPassword") : t("createLogin")}</button>
                </form>
                {s.auth_user_id && (
                  <form action={loginAction}>
                    <input type="hidden" name="id" value={s.id} /><input type="hidden" name="action" value="set_active" />
                    <input type="hidden" name="active" value={String(!s.active)} />
                    <button className={s.active ? "btn-danger py-1" : "btn-ghost py-1"}>{s.active ? t("switchOff") : t("switchOn")}</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("addStaffMember")}>
        <form action={addStaff} className="grid items-end gap-2 sm:grid-cols-7">
          <input name="codename" placeholder={t("codename")} className="input" required />
          <input name="firstname" placeholder={t("firstname")} className="input" required />
          <input name="lastname" placeholder={t("lastname")} className="input" required />
          <input name="username" placeholder={t("username")} className="input" required pattern="[a-zA-Z0-9._-]+" />
          <select name="org" className="input"><option>APSthai</option><option>APSworld</option></select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="handles_cases" defaultChecked /> {t("handlesCases")}</label>
          <button className="btn">{t("add")}</button>
        </form>
      </Card>

      {(teams ?? []).map((tm: any) => (
        <Card key={tm.id} title={`Team: ${tm.name}`}>
          <form action={saveTeam} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="team_id" value={tm.id} />
            {(staff ?? []).filter((s: any) => s.active).map((s: any) => (
              <label key={s.id} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="member" value={s.id} defaultChecked={tm.team_members.some((m: any) => m.staff_id === s.id)} /> {s.codename}
              </label>
            ))}
            <button className="btn-ghost">{t("save")}</button>
          </form>
        </Card>
      ))}
    </div>
  );
}
