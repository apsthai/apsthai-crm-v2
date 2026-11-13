"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { monthStart, todayBangkok } from "@/lib/dates";

const s = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const num = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === null ? null : Number(v.replace(/,/g, ""));
};

// Every Financial action is admin only; RLS checks it too.
async function admin() {
  const ctx = await getMe();
  if (ctx.me.role !== "admin") redirect("/dashboard");
  return ctx.supabase;
}

function back(path: string, error?: { message: string } | string | null): never {
  revalidatePath("/", "layout");
  const msg = typeof error === "string" ? error : error?.message;
  redirect(`${path}${path.includes("?") ? "&" : "?"}${msg ? `err=${encodeURIComponent(msg)}` : "ok=1"}`);
}

// ---------- To collect

export async function addReceivable(fd: FormData) {
  const sb = await admin();
  const caseId = s(fd, "case_id");
  const amount = num(fd, "amount");
  if (!caseId || !amount) return back("/financial", "Choose a case and enter the amount");
  const { data: app } = await sb.from("applications").select("id").eq("case_id", caseId).order("created_at").limit(1);
  const { error } = await sb.from("receivables").insert({
    type: s(fd, "type") ?? "commission", payer_type: "individual", payer_name: "To be billed",
    case_id: caseId, application_id: app?.[0]?.id ?? null, amount, currency: s(fd, "currency") ?? "GBP",
    expected_date: todayBangkok(),
  });
  back("/financial", error);
}

export async function dropReceivable(fd: FormData) {
  const sb = await admin();
  const { error } = await sb.from("receivables").update({ status: "cancelled" }).eq("id", s(fd, "id")!).eq("status", "expected");
  back("/financial", error);
}

// ---------- Invoices

export type InvoiceState = { error: string | null };
type Draft = {
  payerId: string | null; name: string; kind: string; address: string; country: string; taxId: string;
  wht: boolean;
  lines: { receivableId: string; description: string; amount: number }[];
};

export async function createInvoice(_prev: InvoiceState, fd: FormData): Promise<InvoiceState> {
  const sb = await admin();
  let d: Draft;
  try { d = JSON.parse(String(fd.get("draft"))); } catch { return { error: "Something went wrong, please try again" }; }
  if (!d.name.trim()) return { error: "Enter who we are billing" };
  if (!d.lines.length) return { error: "Add at least one student" };
  if (d.lines.some((l) => !l.description.trim() || !(l.amount > 0))) return { error: "Every line needs text and an amount" };

  const { data: rvs, error: rvErr } = await sb.from("receivables").select("id, currency, status").in("id", d.lines.map((l) => l.receivableId));
  if (rvErr) return { error: rvErr.message };
  const currencies = [...new Set((rvs ?? []).map((r) => r.currency as string))];
  if (currencies.length !== 1) return { error: "All lines on one invoice must be in the same currency" };
  const onOther = await sb.from("invoice_lines").select("id, invoice:invoices!inner(status)")
    .in("receivable_id", d.lines.map((l) => l.receivableId)).neq("invoice.status", "cancelled");
  if ((rvs ?? []).some((r) => r.status !== "expected") || (onOther.data ?? []).length)
    return { error: "One of these amounts is already on another invoice (it may be a draft)" };

  // Save the payer so the next invoice fills in by itself.
  const payer = { name: d.name.trim(), kind: d.kind, address: d.address.trim() || null, country: d.country, tax_id: d.taxId.trim() || null };
  const pr = d.payerId
    ? await sb.from("payers").update(payer).eq("id", d.payerId).select("id").single()
    : await sb.from("payers").insert(payer).select("id").single();
  if (pr.error) return { error: pr.error.message.includes("payers_name_key") ? "A payer with this name already exists. Pick it from the list." : pr.error.message };

  const thai = d.country === "Thailand";
  const date = s(fd, "date") ?? todayBangkok();
  const issue = fd.get("issue") === "1";
  const inv = await sb.from("invoices").insert({
    payer_id: pr.data.id, payer_type: "individual", bill_to_name: payer.name, bill_to_address: payer.address,
    bill_to_country: payer.country, bill_to_tax_id: payer.tax_id, currency: currencies[0], date,
    thai_vat: thai, wht_pct: thai && d.kind === "company" && d.wht ? 3 : 0, status: "draft",
  }).select("id").single();
  if (inv.error) return { error: inv.error.message };

  // From here the draft exists, so any problem is shown on its page instead of the form.
  const id = inv.data.id as string;
  const fail = (e: { message: string }) => back(`/financial/invoices/${id}`, e);
  // The amount on the invoice is the agreed amount, so the amount to collect follows it.
  for (const l of d.lines) {
    const up = await sb.from("receivables").update({ amount: l.amount }).eq("id", l.receivableId);
    if (up.error) return fail(up.error);
  }
  const lines = await sb.from("invoice_lines").insert(d.lines.map((l) => ({
    invoice_id: id, receivable_id: l.receivableId, description: l.description.trim(), amount: l.amount,
  })));
  if (lines.error) return fail(lines.error);
  if (issue) {
    const is = await sb.from("invoices").update({ status: "issued" }).eq("id", id);
    if (is.error) return fail(is.error);
  }
  back(`/financial/invoices/${id}`);
  return { error: null };
}

export async function issueInvoice(fd: FormData) {
  const sb = await admin();
  const id = s(fd, "id")!;
  const { error } = await sb.from("invoices").update({ status: "issued" }).eq("id", id).eq("status", "draft");
  back(`/financial/invoices/${id}`, error);
}

export async function cancelInvoice(fd: FormData) {
  const sb = await admin();
  const id = s(fd, "id")!;
  const { error } = await sb.from("invoices").update({ status: "cancelled" }).eq("id", id);
  back(`/financial/invoices/${id}`, error);
}

export async function deleteDraft(fd: FormData) {
  const sb = await admin();
  const id = s(fd, "id")!;
  const l = await sb.from("invoice_lines").delete().eq("invoice_id", id);
  if (l.error) return back(`/financial/invoices/${id}`, l.error);
  const { error } = await sb.from("invoices").delete().eq("id", id).eq("status", "draft");
  if (error) return back(`/financial/invoices/${id}`, error);
  back("/financial/invoices");
}

// ---------- Money in

export async function recordPayment(fd: FormData) {
  const sb = await admin();
  const id = s(fd, "invoice_id")!;
  const date = s(fd, "date") ?? todayBangkok();
  const thb = num(fd, "received_thb");
  if (!thb || thb <= 0) return back(`/financial/invoices/${id}`, "Enter the THB that came in");
  // Part paid: the amount per student in the invoice currency. Otherwise everything left on the invoice.
  let lines: { receivable_id: string; amount: number }[] | null = null;
  if (fd.get("part") === "1") {
    try { lines = JSON.parse(String(fd.get("lines"))); } catch { lines = []; }
    if (!lines?.some((l) => l.amount > 0)) return back(`/financial/invoices/${id}`, "Enter how much of each student was paid");
  }
  const { error } = await sb.rpc("record_payment", {
    p_invoice_id: id, p_received_date: date, p_received_thb: thb, p_vat_thb: 0, p_wht_thb: num(fd, "wht_thb") ?? 0,
    p_lines: lines,
  });
  if (error) return back(`/financial/invoices/${id}`, error);
  // Work out the commission for that month's round straight away.
  const g = await sb.rpc("generate_payouts", { p_cycle: "next_month", p_period_start: monthStart(date) });
  back(`/financial/invoices/${id}`, g.error);
}

export async function deletePayment(fd: FormData) {
  const sb = await admin();
  const id = s(fd, "invoice_id")!;
  const { error } = await sb.rpc("delete_payment", { p_payment_id: s(fd, "payment_id")! });
  back(`/financial/invoices/${id}`, error);
}

// ---------- Payouts

export async function refreshRound(fd: FormData) {
  const sb = await admin();
  const period = s(fd, "period")!;
  const { error } = await sb.rpc("generate_payouts", { p_cycle: "next_month", p_period_start: period });
  back(`/financial/payouts?m=${period.slice(0, 7)}`, error);
}

export async function markRoundChecked(fd: FormData) {
  const sb = await admin();
  const period = s(fd, "period")!;
  const dates = String(fd.get("dates") ?? "").split(",").filter(Boolean);
  const { error } = await sb.from("payouts").update({ status: "reviewed" }).in("pay_date", dates).eq("status", "draft");
  back(`/financial/payouts?m=${period.slice(0, 7)}`, error);
}

export async function markPaid(fd: FormData) {
  const sb = await admin();
  const period = s(fd, "period")!;
  const amount = num(fd, "paid_amount");
  if (amount === null) return back(`/financial/payouts?m=${period.slice(0, 7)}`, "Enter the amount transferred");
  const { error } = await sb.from("payouts").update({
    status: "paid", paid_date: s(fd, "paid_date") ?? todayBangkok(), paid_amount: amount, note: s(fd, "note"),
  }).eq("id", s(fd, "payout_id")!).neq("status", "paid");
  back(`/financial/payouts?m=${period.slice(0, 7)}`, error);
}

// ---------- Settings

export async function saveSettings(fd: FormData) {
  const sb = await admin();
  const keys = ["name_en", "name_th", "address_en", "address_th", "phone", "email", "tax_id",
    "bank_account_name", "bank_name", "bank_branch", "bank_address", "bank_account_no", "bank_swift"];
  const row = Object.fromEntries(keys.map((k) => [k, s(fd, k)]));
  const { error } = await sb.from("company_settings").update(row).eq("single", true);
  back("/financial/settings", error);
}
