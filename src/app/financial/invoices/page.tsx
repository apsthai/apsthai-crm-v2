import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Flash } from "@/components/flash";
import { getMe } from "@/lib/auth";
import { daysBetween, fmtDate, todayBangkok } from "@/lib/dates";
import { money, STATUS_LOOK } from "@/lib/fin";
import { FinHeader } from "../tabs";

const TABS = [
  ["waiting", "Waiting", ["issued", "partially_paid"]],
  ["paid", "Paid", ["paid"]],
  ["draft", "Drafts", ["draft"]],
  ["cancelled", "Cancelled", ["cancelled"]],
] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const tab = TABS.find((t) => t[0] === sp.tab) ?? TABS[0];
  const today = todayBangkok();

  const { data, error } = await sb.from("invoices")
    .select("id, invoice_no, date, bill_to_name, currency, total, status, invoice_lines(id)")
    .order("date", { ascending: false }).order("invoice_no", { ascending: false });
  if (error) throw new Error(error.message);
  const all = data ?? [];
  const count = (st: readonly string[]) => all.filter((i) => st.includes(i.status)).length;
  const rows = all.filter((i) => (tab[2] as readonly string[]).includes(i.status));

  return (
    <AppShell active="/financial">
      <FinHeader active="/financial/invoices" />
      <Flash ok={sp.ok} err={sp.err} />
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold text-slate-900">Invoices</h2>
          <nav className="flex flex-wrap gap-1 rounded-lg bg-slate-200 p-1 text-[13px]" aria-label="Invoice status">
            {TABS.map(([key, label, st]) => (
              <Link key={key} href={`/financial/invoices?tab=${key}`}
                className={key === tab[0] ? "rounded-md bg-white px-2.5 py-1 font-semibold text-slate-900 shadow-sm" : "rounded-md px-2.5 py-1 text-slate-600 hover:text-slate-900"}>
                {label} {count(st)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">Invoice</th>
                <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">Billed to</th>
                <th className="border-b border-slate-200 px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="border-b border-slate-200 px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No invoices here.</td></tr>}
              {rows.map((i) => {
                const n = (i.invoice_lines ?? []).length;
                const late = (i.status === "issued" || i.status === "partially_paid") && daysBetween(i.date, today) > 30;
                const look = late ? ["Over 30 days", "bg-red-50 text-brand-red"] : STATUS_LOOK[i.status];
                return (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-4 py-2.5">
                      <Link href={`/financial/invoices/${i.id}`} className="font-medium text-navy hover:underline">{i.invoice_no ?? "Draft"}</Link>
                      <div className="text-xs text-slate-500">{fmtDate(i.date)} · {n} {n === 1 ? "student" : "students"}</div>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-2.5">{i.bill_to_name}</td>
                    <td className="border-b border-slate-100 px-4 py-2.5 text-right whitespace-nowrap">{money(Number(i.total ?? 0), i.currency)}</td>
                    <td className="border-b border-slate-100 px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${look[1]}`}>{look[0]}</span>
                      {late && i.status === "partially_paid" && <span className="ml-1 text-xs text-slate-500">part paid</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
