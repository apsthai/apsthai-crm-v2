"use server";
import { revalidatePath } from "next/cache";
import { getMe, requireAdmin } from "@/lib/auth";
import { done, num, str } from "@/lib/actions";

export async function generate(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const [cycle, start] = (str(fd, "schedule") ?? "|").split("|");
  const { data, error } = await sb.rpc("generate_payouts", { p_cycle: cycle, p_period_start: start });
  revalidatePath("/payouts");
  if (error) done("/payouts", error);
  done(`/payouts?made=${data ?? 0}`);
}

export async function markReviewed(fd: FormData) {
  const { supabase: sb } = await getMe();
  const { error } = await sb.from("payouts").update({ status: "reviewed" }).eq("id", str(fd, "id")).eq("status", "draft");
  revalidatePath("/payouts");
  done("/payouts", error);
}

export async function markPaid(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const { error } = await sb.from("payouts").update({ status: "paid" }).eq("id", str(fd, "id"));
  revalidatePath("/payouts");
  done("/payouts", error);
}

export async function addAdjustment(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const [kind, rid] = (str(fd, "recipient") ?? "|").split("|");
  const payDate = str(fd, "pay_date");
  const amount = num(fd, "amount");
  const note = str(fd, "note");
  if (!payDate || amount === null || !note) done("/payouts", "Pay date, amount and note are required");
  let q = sb.from("payouts").select("id").eq("recipient_type", kind).eq("pay_date", payDate!).neq("status", "paid");
  q = kind === "staff" ? q.eq("staff_id", rid) : q.eq("partner_id", rid);
  const { data: found } = await q.limit(1).maybeSingle();
  let payoutId = found?.id as string | undefined;
  if (!payoutId) {
    const { data, error } = await sb.from("payouts").insert({
      recipient_type: kind, staff_id: kind === "staff" ? rid : null, partner_id: kind === "partner" ? rid : null, pay_date: payDate,
    }).select("id").single();
    if (error) done("/payouts", error);
    payoutId = data.id;
  } else {
    await sb.from("payouts").update({ status: "draft" }).eq("id", payoutId).eq("status", "reviewed");
  }
  const { error } = await sb.from("payout_lines").insert({ payout_id: payoutId, line_type: "adjustment", case_id: str(fd, "case_id"), amount, note });
  revalidatePath("/payouts");
  done("/payouts", error);
}
