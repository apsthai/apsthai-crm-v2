import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Flash } from "@/components/flash";
import { getMe } from "@/lib/auth";
import { addMonths, daysBetween, fmtDate, fmtMonth, monthStart, todayBangkok } from "@/lib/dates";
import { flatRv, latestRates, RV_SELECT, type RvRaw } from "@/lib/fin-data";
import { fmtTHB, toTHB } from "@/lib/money";
import { FinHeader } from "./tabs";
import { AddByHand, CollectTable } from "./collect-table";

export default async function CollectPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const today = todayBangkok();
  const m0 = monthStart(today);

  const [rvRes, draftRes, invRes, payRes, casesRes, rates] = await Promise.all([
    sb.from("receivables").select(RV_SELECT).eq("status", "expected").order("created_at"),
    sb.from("invoice_lines").select("receivable_id, invoice:invoices!inner(status)").eq("invoice.status", "draft"),
    sb.from("invoices").select("id, date, currency, total, invoice_lines(receivable_id)").in("status", ["issued", "partially_paid"]),
    sb.from("payments").select("received_thb").gte("received_date", m0).lt("received_date", addMonths(m0, 1)),
    sb.from("cases").select("id, intake, student:students(codename), category:categories(name_en)").order("created_at", { ascending: false }),
    latestRates(sb),
  ]);
  if (rvRes.error) throw new Error(rvRes.error.message);

  const inDraft = new Set((draftRes.data ?? []).map((d) => d.receivable_id as string));
  const rows = ((rvRes.data ?? []) as unknown as RvRaw[]).map(flatRv).filter((r) => !inDraft.has(r.id));

  // Waiting invoices: what is still unpaid on them.
  const waiting = invRes.data ?? [];
  const rvIds = waiting.flatMap((i) => (i.invoice_lines ?? []).map((l) => l.receivable_id as string));
  const paidRes = rvIds.length ? await sb.from("payment_lines").select("receivable_id, amount").in("receivable_id", rvIds) : { data: [] };
  const paidBy = new Map<string, number>();
  for (const p of paidRes.data ?? []) paidBy.set(p.receivable_id, (paidBy.get(p.receivable_id) ?? 0) + Number(p.amount));
  let waitingTHB = 0, over30 = 0, missing = false;
  for (const i of waiting) {
    const left = Number(i.total) - (i.invoice_lines ?? []).reduce((s, l) => s + (paidBy.get(l.receivable_id) ?? 0), 0);
    const t = toTHB(left, i.currency, rates);
    waitingTHB += t.thb; missing ||= t.missing;
    if (daysBetween(i.date, today) > 30) over30++;
  }
  let notBilled = 0;
  for (const r of rows) { const t = toTHB(r.amount, r.currency, rates); notBilled += t.thb; missing ||= t.missing; }
  const moneyIn = (payRes.data ?? []).reduce((s, p) => s + Number(p.received_thb), 0);

  type C = { id: string; intake: string | null; student: { codename: string } | null; category: { name_en: string } | null };
  const cases = ((casesRes.data ?? []) as unknown as C[])
    .map((c) => ({ id: c.id, label: `${c.student?.codename ?? "?"} · ${c.category?.name_en ?? ""}${c.intake ? ` · ${fmtMonth(c.intake)}` : ""}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const tiles = [
    ["Not billed yet", fmtTHB(notBilled), `${rows.length} ${rows.length === 1 ? "amount" : "amounts"} · incl. VAT, at today's rates`],
    ["Billed, waiting for money", fmtTHB(waitingTHB), `${waiting.length} ${waiting.length === 1 ? "invoice" : "invoices"}${over30 ? ` · ${over30} over 30 days` : ""}`],
    ["Money in this month", fmtTHB(moneyIn), `${fmtMonth(today)} · ${(payRes.data ?? []).length} payments`],
  ];

  return (
    <AppShell active="/financial">
      <FinHeader active="/financial" />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="text-[13px] text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
          </div>
        ))}
      </div>
      {missing && <p className="text-xs text-amber-700">Some currencies have no exchange rate yet, so they count as zero above.</p>}
      <CollectTable rows={rows.map((r) => ({ ...r, approved: fmtDate(r.createdAt.slice(0, 10)) }))}
        addByHand={<AddByHand cases={cases} />} />
      <p className="text-[13px] text-slate-500">
        An amount can be edited on the invoice. A student left out stays here for a later invoice. &quot;Add an amount by hand&quot; covers money
        that did not come from an approval, such as a second-year commission.
      </p>
    </AppShell>
  );
}
