export const payerKey = (r: { payer_type: string; school_id?: string | null; partner_id?: string | null; payer_name?: string | null }) =>
  r.payer_type === "school" ? `school:${r.school_id}` : r.payer_type === "partner" ? `partner:${r.partner_id}` : `individual:${r.payer_name}`;

export const remaining = (r: { amount: number | string; payment_lines?: { amount: number | string }[] }) =>
  Number(r.amount) - (r.payment_lines ?? []).reduce((a, p) => a + Number(p.amount), 0);
