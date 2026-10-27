import { A, Card, Empty, Pill } from "@/components/ui";
import { getMe } from "@/lib/auth";
import { fmtDate, fmtMoney, todayBangkok } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { addAdjustment, generate, markPaid, markReviewed } from "./actions";

export default async function Payouts({ searchParams }: { searchParams: Promise<{ made?: string }> }) {
  const me = await getMe();
  const sb = me.supabase;
  const isAdmin = me.role === "admin";
  const { t, n, lang } = await getT();
  const sp = await searchParams;
  const today = todayBangkok();

  let q = sb.from("payouts")
    .select("id, recipient_type, pay_date, status, total, reviewed_at, staff:staff!payouts_staff_id_fkey(codename), partner:partners(name), payout_lines(id, line_type, base_thb, share, amount, note, case:cases(id, student:students(codename), category:categories(name_th, name_en)), rule:payout_rules(revenue_type))")
    .order("pay_date", { ascending: false }).limit(200);
  if (!isAdmin) q = q.eq("staff_id", me.id);
  const [{ data: payouts }, { data: schedules }, { data: staff }, { data: partners }] = await Promise.all([
    q,
    isAdmin ? sb.from("payout_schedules").select("cycle, period_start, period_end, pay_date").lte("period_start", today).order("pay_date", { ascending: false }).limit(24) : Promise.resolve({ data: [] }),
    isAdmin ? sb.from("staff").select("id, codename").eq("active", true).order("codename") : Promise.resolve({ data: [] }),
    isAdmin ? sb.from("partners").select("id, name").eq("active", true).order("name") : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="h1">{t("payouts")}</h1>

      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t("generate")}>
            {sp.made && <p className="mb-2 text-sm text-emerald-700">{t("generated")}: {sp.made}</p>}
            <form action={generate} className="flex flex-wrap gap-2">
              <select name="schedule" className="input max-w-md" required>
                {(schedules ?? []).map((s: any) => (
                  <option key={`${s.cycle}|${s.period_start}`} value={`${s.cycle}|${s.period_start}`}>
                    {t(s.cycle)} · {fmtDate(s.period_start, lang)} - {fmtDate(s.period_end, lang)} → {t("payDate")} {fmtDate(s.pay_date, lang)}
                  </option>
                ))}
              </select>
              <button className="btn">{t("generate")}</button>
            </form>
          </Card>
          <Card title={t("addAdjustment")}>
            <form action={addAdjustment} className="grid gap-2 sm:grid-cols-2">
              <select name="recipient" className="input" required>
                {(staff ?? []).map((s: any) => <option key={s.id} value={`staff|${s.id}`}>{s.codename}</option>)}
                {(partners ?? []).map((p: any) => <option key={p.id} value={`partner|${p.id}`}>{p.name}</option>)}
              </select>
              <input name="pay_date" type="date" className="input" required />
              <input name="amount" type="number" step="0.01" placeholder={t("amount")} className="input" required />
              <input name="note" placeholder={t("reason")} className="input" required />
              <button className="btn-ghost">{t("add")}</button>
            </form>
          </Card>
        </div>
      )}

      {!payouts?.length ? <Card><Empty text={t("none")} /></Card> : payouts.map((p: any) => (
        <Card key={p.id}
          title={`${p.staff?.codename ?? p.partner?.name} · ${t("payDate")} ${fmtDate(p.pay_date, lang)} · ${fmtMoney(p.total)}`}
          right={
            <div className="flex items-center gap-2">
              <Pill status={p.status} label={t(p.status)} />
              {p.status === "draft" && !isAdmin && <form action={markReviewed}><input type="hidden" name="id" value={p.id} /><button className="btn py-1">{t("markReviewed")}</button></form>}
              {isAdmin && p.status !== "paid" && <form action={markPaid}><input type="hidden" name="id" value={p.id} /><button className="btn py-1">{t("markPaid")}</button></form>}
            </div>
          }>
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>{t("case")}</th><th>{t("type")}</th><th>{t("base")}</th><th>{t("share")}</th><th>{t("amount")}</th></tr></thead>
            <tbody>{(p.payout_lines ?? []).map((l: any) => (
              <tr key={l.id}>
                <td>{l.case ? <A href={`/cases/${l.case.id}`}>{l.case.student?.codename} · {n(l.case.category)}</A> : "-"}</td>
                <td>{l.line_type === "adjustment" ? `${t("adjustment")}: ${l.note}` : l.line_type === "sub_agent" ? t("subAgent") : t(l.rule?.revenue_type ?? "commission")}</td>
                <td>{l.base_thb !== null ? fmtMoney(l.base_thb) : ""}</td>
                <td>{l.share !== null ? `${Math.round(Number(l.share) * 1000) / 10}%` : ""}</td>
                <td className={Number(l.amount) < 0 ? "text-red-700" : ""}>{fmtMoney(l.amount)}</td>
              </tr>))}</tbody>
          </table></div>
        </Card>
      ))}
    </div>
  );
}
