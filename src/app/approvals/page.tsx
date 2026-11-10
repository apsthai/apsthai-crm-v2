import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/components/app-shell";
import { inputCls } from "@/components/fields";
import { Flash } from "@/components/flash";
import { Submit } from "@/components/submit";
import { getMe } from "@/lib/auth";
import { addDays, fmtDate, fmtMonth, todayBangkok } from "@/lib/dates";
import { UndoButton } from "@/components/undo-success";
import { approve, reject } from "./actions";

type Item = {
  id: string; date: string; created_by: string | null; approved_by: string | null; approved_at: string | null;
  case_id: string; application_id: string | null;
  case: { intake: string; student: { codename: string }; category: { name_en: string }; case_staff: { end_date: string | null; staff: { codename: string } }[] };
  application: { programme: string | null; product: { school: { name: string } | null; partner: { name: string } | null } } | null;
};
const SELECT = "id, date, created_by, approved_by, approved_at, case_id, application_id, case:cases(intake, student:students(codename), category:categories(name_en), case_staff(end_date, staff:staff!case_staff_staff_id_fkey(codename))), application:applications(programme, product:products(school:schools(name), partner:partners(name)))";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");

  const since = addDays(todayBangkok(), -30);
  const [pending, recent, staff] = await Promise.all([
    sb.from("stage_updates").select(SELECT).eq("approval", "pending").order("date"),
    sb.from("stage_updates").select(SELECT).eq("approval", "approved").gte("approved_at", since).order("approved_at", { ascending: false }),
    sb.from("staff").select("id, codename"),
  ]);
  if (pending.error) throw new Error(pending.error.message);
  const who = new Map((staff.data ?? []).map((x) => [x.id as string, x.codename as string]));
  const items = (pending.data ?? []) as unknown as Item[];
  const done = ((recent.data ?? []) as unknown as Item[]).filter((x) => x.approved_at);

  // Which schools still need a fee before approval (their commission is a percentage of the fee).
  const caseIds = [...new Set(items.map((i) => i.case_id))];
  const { data: apps } = caseIds.length
    ? await sb.from("applications").select("id, case_id, result, commissionable_fee, product_id, product:products(school:schools(name), partner:partners(name), income_terms(rate_pct))").in("case_id", caseIds)
    : { data: [] };
  type A = { id: string; case_id: string; result: string; commissionable_fee: number | null; product: { school: { name: string } | null; partner: { name: string } | null; income_terms: { rate_pct: number | null }[] } };
  const missingFee = (i: Item) => ((apps ?? []) as unknown as A[])
    .filter((a) => a.case_id === i.case_id && (!i.application_id || a.id === i.application_id) && !["rejected", "withdrawn"].includes(a.result))
    .filter((a) => a.commissionable_fee === null && a.product.income_terms.some((t) => t.rate_pct !== null))
    .map((a) => a.product.school?.name ?? a.product.partner?.name ?? "a school");

  const place = (i: Item) => i.application ? `${i.application.product.school?.name ?? i.application.product.partner?.name ?? ""}${i.application.programme ? ` · ${i.application.programme}` : ""}` : "";
  const staffOf = (i: Item) => i.case.case_staff.filter((c) => !c.end_date).map((c) => c.staff.codename).join(", ") || "-";

  return (
    <AppShell active="/approvals">
      <h1 className="text-2xl font-semibold text-slate-900">Approvals</h1>
      <Flash ok={sp.ok} err={sp.err} />

      <Card title={`Waiting for approval (${items.length})`} sub="Approving makes the case Successful, gives the points to its staff and sets the amounts to collect from the contract.">
        {items.length === 0 && <p className="py-2 text-sm text-slate-400">Nothing waiting.</p>}
        <div className="flex flex-col">
          {items.map((i) => {
            const missing = missingFee(i);
            return (
              <div key={i.id} className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b border-slate-100 py-4 last:border-0">
                <div className="min-w-0 flex-[2_1_300px]">
                  <Link href={`/cases/${i.case_id}`} className="font-semibold text-navy hover:underline">{i.case.student.codename}</Link>
                  <div className="text-sm">{i.case.category.name_en} · {fmtMonth(i.case.intake)}{place(i) ? ` · ${place(i)}` : ""}</div>
                  <div className="text-[13px] text-slate-500">Staff: {staffOf(i)} · sent by {i.created_by ? who.get(i.created_by) : "System"} · enrolled {fmtDate(i.date)}</div>
                  {missing.length > 0 && (
                    <div className="mt-1.5 text-[13px] font-medium text-brand-red">
                      Fee missing for {missing.join(", ")}. <Link href={`/cases/${i.case_id}`} className="underline">Add it on the case page</Link> first.
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <form action={approve}>
                    <input type="hidden" name="id" value={i.id} />
                    {missing.length > 0
                      ? <button type="button" disabled className="rounded-lg border border-transparent bg-navy px-4 py-2 text-sm font-medium text-white opacity-40">Approve</button>
                      : <Submit>Approve</Submit>}
                  </form>
                  <details className="relative">
                    <summary className="cursor-pointer list-none rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-brand-red hover:bg-red-50">Reject</summary>
                    <form action={reject} className="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
                      <input type="hidden" name="id" value={i.id} />
                      <label className="flex flex-col gap-1 text-[13px] font-medium text-slate-600">Why? (required, the staff will see this)
                        <textarea name="reason" required rows={3} className={inputCls} />
                      </label>
                      <Submit variant="danger">Reject</Submit>
                    </form>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Approved in the last 30 days" sub="Undo puts the case back in progress, removes its points and cancels amounts not yet invoiced. Older cases can be undone from their case page.">
        {done.length === 0 && <p className="py-2 text-sm text-slate-400">None.</p>}
        <div className="flex flex-col">
          {done.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
              <div className="min-w-0">
                <Link href={`/cases/${i.case_id}`} className="font-medium text-navy hover:underline">{i.case.student.codename}</Link>
                <span className="text-sm"> · {i.case.category.name_en} · {fmtMonth(i.case.intake)}{place(i) ? ` · ${place(i)}` : ""}</span>
                <div className="text-[13px] text-slate-500">Approved {fmtDate(i.approved_at!.slice(0, 10))} by {i.approved_by ? who.get(i.approved_by) : "-"}</div>
              </div>
              <UndoButton caseId={i.case_id} />
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
