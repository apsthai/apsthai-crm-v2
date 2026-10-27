"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { bool, done, num, str } from "@/lib/actions";
import { todayBangkok } from "@/lib/format";

export async function createInvoice(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const ids = fd.getAll("receivable_id").map(String).filter(Boolean);
  const ret = `/money/invoices/new?${new URLSearchParams({ pick: `${str(fd, "payer_key")}|${str(fd, "currency")}` })}`;
  if (!ids.length) done(ret, "Pick at least one item");
  const { data: recs, error: e1 } = await sb.from("receivables")
    .select("id, amount, currency, payer_type, school_id, partner_id, payment_lines(amount), case:cases(intake, student:students(codename))").in("id", ids);
  if (e1) done(ret, e1);
  const first = recs![0];
  if (recs!.some((r: any) => r.currency !== first.currency)) done(ret, "All items must be in the same currency");
  const { data: inv, error } = await sb.from("invoices").insert({
    date: str(fd, "date") ?? todayBangkok(), due_date: str(fd, "due_date"),
    payer_type: first.payer_type, school_id: first.school_id, partner_id: first.partner_id,
    bill_to_name: str(fd, "bill_to_name"), bill_to_address: str(fd, "bill_to_address"), currency: first.currency,
  }).select("id").single();
  if (error) done(ret, error);
  const lines = recs!.map((r: any) => ({
    invoice_id: inv.id, receivable_id: r.id,
    description: [r.case?.student?.codename, r.case?.intake?.slice(0, 7)].filter(Boolean).join(" · "),
    amount: Number(r.amount) - (r.payment_lines ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0),
  }));
  const { error: e2 } = await sb.from("invoice_lines").insert(lines);
  if (e2) done(`/money/invoices/${inv.id}`, e2);
  redirect(`/money/invoices/${inv.id}`);
}

export async function setInvoiceStatus(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const id = str(fd, "id")!;
  const { error } = await sb.from("invoices").update({ status: str(fd, "status") }).eq("id", id);
  revalidatePath(`/money/invoices/${id}`);
  done(`/money/invoices/${id}`, error);
}

export async function updateInvoiceLine(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const id = str(fd, "invoice_id")!;
  const { error } = await sb.from("invoice_lines").update({ description: str(fd, "description"), amount: num(fd, "amount") }).eq("id", str(fd, "id"));
  revalidatePath(`/money/invoices/${id}`);
  done(`/money/invoices/${id}`, error);
}

export async function updateInvoiceHeader(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const id = str(fd, "id")!;
  const { error } = await sb.from("invoices").update({
    date: str(fd, "date"), due_date: str(fd, "due_date"), bill_to_name: str(fd, "bill_to_name"),
    bill_to_address: str(fd, "bill_to_address"), external_doc_no: str(fd, "external_doc_no"),
  }).eq("id", id);
  revalidatePath(`/money/invoices/${id}`);
  done(`/money/invoices/${id}`, error);
}

// VAT is 7% of the base: received + WHT = base x 1.07
function vatOf(fd: FormData, received: number, wht: number) {
  const typed = num(fd, "vat_thb");
  if (typed !== null) return typed;
  return bool(fd, "includes_vat") ? Math.round(((received + wht) * 7 / 107) * 100) / 100 : 0;
}

export async function recordPayment(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const invoiceId = str(fd, "invoice_id");
  const ret = invoiceId ? `/money/invoices/${invoiceId}` : "/money/payments/new";
  const received = num(fd, "received_thb");
  if (received === null) done(ret, "Received amount is required");
  const wht = num(fd, "wht_thb") ?? 0;
  const lines = fd.getAll("line_receivable").map(String).map((rid, i) => ({
    receivable_id: rid, amount: Number(String(fd.getAll("line_amount")[i] ?? "0").replace(/,/g, "")) || 0,
  })).filter((l) => l.amount !== 0);
  const { error } = await sb.rpc("record_payment", {
    p_invoice_id: invoiceId, p_received_date: str(fd, "received_date") ?? todayBangkok(), p_received_thb: received,
    p_vat_thb: vatOf(fd, received!, wht), p_wht_thb: wht, p_lines: lines.length ? lines : null,
  });
  revalidatePath("/money");
  if (invoiceId) revalidatePath(ret);
  done(invoiceId ? ret : "/money", error);
}

export async function deletePayment(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const ret = str(fd, "back") ?? "/money";
  const { error } = await sb.from("payments").delete().eq("id", str(fd, "id"));
  revalidatePath(ret);
  done(ret, error);
}
