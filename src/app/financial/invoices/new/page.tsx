import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getMe } from "@/lib/auth";
import { todayBangkok } from "@/lib/dates";
import { flatRv, RV_SELECT, type RvRaw } from "@/lib/fin-data";
import { InvoiceForm } from "./invoice-form";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const ids = ((await searchParams).r ?? "").split(",").filter(Boolean);

  const [rvRes, draftRes, payersRes] = await Promise.all([
    sb.from("receivables").select(RV_SELECT).eq("status", "expected").order("created_at"),
    sb.from("invoice_lines").select("receivable_id, invoice:invoices!inner(status)").eq("invoice.status", "draft"),
    sb.from("payers").select("id, name, kind, address, country, tax_id, school_id").eq("active", true).order("name"),
  ]);
  if (rvRes.error) throw new Error(rvRes.error.message);
  const inDraft = new Set((draftRes.data ?? []).map((d) => d.receivable_id as string));
  const open = ((rvRes.data ?? []) as unknown as RvRaw[]).map(flatRv).filter((r) => !inDraft.has(r.id));
  const start = open.filter((r) => ids.includes(r.id));
  if (!start.length) redirect("/financial?err=" + encodeURIComponent("Those amounts are no longer waiting to be billed"));

  const payers = (payersRes.data ?? []) as { id: string; name: string; kind: string; address: string | null; country: string | null;
    tax_id: string | null; school_id: string | null }[];
  // Suggest the school's own payer when every student is at the same school.
  const schoolIds = [...new Set(start.map((r) => r.schoolId))];
  const suggested = schoolIds.length === 1 && schoolIds[0] ? payers.find((p) => p.school_id === schoolIds[0])?.id ?? null : null;

  return (
    <AppShell active="/financial">
      <div>
        <Link href="/financial" className="text-sm text-navy hover:underline">← To collect</Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">New invoice</h1>
      </div>
      <InvoiceForm start={start} others={open.filter((r) => !ids.includes(r.id))} payers={payers}
        suggested={suggested} schoolName={start[0].school} today={todayBangkok()} />
    </AppShell>
  );
}
