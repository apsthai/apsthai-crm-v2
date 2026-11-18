import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { addMonths, fmtDate, fmtMonth } from "@/lib/dates";
import { n2 } from "@/lib/fin";
import { PrintButton } from "../../invoices/[id]/print/print-button";

const NAVY = "#1f3864";
type One<T> = T | T[] | null;
const one = <T,>(x: One<T>): T | null => (Array.isArray(x) ? x[0] ?? null : x);

type Line = {
  id: string; line_type: string; base_thb: number | null; share: number | null; amount: number; note: string | null; created_at: string;
  rule: One<{ method: string; value: number | null }>;
  kase: One<{ intake: string | null; student: One<{ codename: string }>; category: One<{ name_en: string }> }>;
  pl: One<{ payment: One<{ received_date: string; invoice: One<{ invoice_no: string | null }> }>; rv: One<{ school: One<{ name: string }> }> }>;
};

async function load(id: string) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const { data } = await sb.from("payouts")
    .select(`id, recipient_type, pay_date, status, total, paid_date, paid_amount, note,
      staff:staff!payouts_staff_id_fkey(codename, firstname, lastname), partner:partners(name),
      lines:payout_lines(id, line_type, base_thb, share, amount, note, created_at, rule:payout_rules(method, value),
        kase:cases(intake, student:students(codename), category:categories(name_en)),
        pl:payment_lines(payment:payments(received_date, invoice:invoices(invoice_no)), rv:receivables(school:schools(name))))`)
    .eq("id", id).maybeSingle();
  return { sb, p: data };
}

function whoOf(p: NonNullable<Awaited<ReturnType<typeof load>>["p"]>) {
  const st = one(p.staff as One<{ codename: string; firstname: string | null; lastname: string | null }>);
  const pa = one(p.partner as One<{ name: string }>);
  return st ? { short: st.codename, full: [st.firstname, st.lastname].filter(Boolean).join(" ") || st.codename } : { short: pa?.name ?? "", full: pa?.name ?? "" };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { p } = await load((await params).id);
  // The title becomes the PDF's file name when saved from the browser.
  return { title: p ? `Payout ${whoOf(p).short} ${p.pay_date}` : "Payout" };
}

// One person's (or partner's) payout for one round, as an A4 page to print or save as PDF and send to them.
export default async function PayoutSummary({ params }: { params: Promise<{ id: string }> }) {
  const { sb, p } = await load((await params).id);
  if (!p) notFound();
  const { data: co } = await sb.from("company_settings").select("name_en, address_en, phone, email, tax_id").eq("single", true).maybeSingle();
  const c = (co ?? {}) as Record<string, string | null>;
  const team = p.recipient_type === "staff";
  const who = whoOf(p);
  const lines = [...(p.lines as unknown as Line[])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  // The round's money came in during the month before the pay month.
  const moneyMonth = addMonths(`${p.pay_date.slice(0, 7)}-01`, -1);
  const total = Number(p.total);
  const status = p.status === "paid" ? `Paid ${fmtDate(p.paid_date)} · ฿${n2(Number(p.paid_amount ?? total))}`
    : p.status === "reviewed" ? `Checked · to be paid ${fmtDate(p.pay_date)}` : "Not checked yet (draft)";
  const cell = { padding: "6px 8px", borderBottom: "1px solid #e5e7eb" } as const;
  const head = { padding: "6px 8px", textAlign: "left" as const, fontWeight: 600 };

  return (
    <div className="min-h-dvh bg-slate-200 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 0 } @media print { .no-print { display: none !important } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap items-center justify-between gap-3 px-4">
        <Link href={`/financial/payouts?m=${moneyMonth.slice(0, 7)}`} className="text-sm text-navy hover:underline">← Back to payouts</Link>
        <div className="flex items-center gap-3">
          {p.status === "draft" && <span className="text-sm text-amber-800">Not checked yet: amounts can still change.</span>}
          <PrintButton />
        </div>
      </div>
      <div style={{ width: 794, minHeight: 1123, boxSizing: "border-box", padding: "56px 64px", background: "#fff", color: "#111827", fontSize: 13,
        fontFamily: "'IBM Plex Sans Thai', Arial, sans-serif", display: "flex", flexDirection: "column", gap: 20 }}
        className="mx-auto shadow-lg print:shadow-none">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, paddingBottom: 14, borderBottom: `2px solid ${NAVY}` }}>
          <Image src="/apsthai-seal.png" alt="APSthai company seal" width={88} height={97} style={{ objectFit: "contain" }} />
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: NAVY }}>{c.name_en}</div>
            <div style={{ fontSize: 11, maxWidth: 420 }}>{c.address_en}</div>
            <div style={{ fontSize: 11 }}>{[c.phone && `Tel: ${c.phone}`, c.email && `Email: ${c.email}`].filter(Boolean).join(" | ")}</div>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 24, fontWeight: 700, color: NAVY }}>
          PAYOUT SUMMARY
          <div style={{ fontSize: 13, fontWeight: 400, color: "#374151", marginTop: 2 }}>{team ? "Team commission" : "Partner share"} · money in {fmtMonth(moneyMonth)}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em" }}>{team ? "PAID TO" : "PARTNER"}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{who.full}</div>
            {team && who.full !== who.short && <div>({who.short})</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 12px", alignContent: "start" }}>
            <div style={{ fontWeight: 700, textAlign: "right" }}>Pay date</div><div style={{ textAlign: "right" }}>{fmtDate(p.pay_date)}</div>
            <div style={{ fontWeight: 700, textAlign: "right" }}>Status</div><div style={{ textAlign: "right" }}>{status}</div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: NAVY, color: "#fff" }}>
              <th style={{ ...head, width: 28, textAlign: "center" }}>No.</th>
              <th style={head}>Student · service</th>
              <th style={head}>Invoice · money in</th>
              <th style={{ ...head, textAlign: "right" }}>{team ? "Before VAT (THB)" : "THB in"}</th>
              <th style={{ ...head, textAlign: "right" }}>Share</th>
              <th style={{ ...head, textAlign: "right" }}>Amount (THB)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const k = one(l.kase);
              const pl = one(l.pl);
              const pay = one(pl?.payment ?? null);
              const school = one(one(pl?.rv ?? null)?.school ?? null)?.name;
              const rule = one(l.rule);
              const share = team
                ? `${rule?.method === "percent" ? `${Number(rule.value)}%` : "Fixed"}${l.share && Number(l.share) < 1 ? ` × 1/${Math.round(1 / Number(l.share))}` : ""}`
                : `${Math.round(Number(l.share ?? 0) * 10000) / 100}%`;
              return (
                <tr key={l.id} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                  <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{one(k?.student ?? null)?.codename ?? l.note}</div>
                    <div style={{ color: "#6b7280" }}>{[one(k?.category ?? null)?.name_en, school].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td style={cell}>
                    <div>{one(pay?.invoice ?? null)?.invoice_no ?? (l.line_type === "commission" ? "Stage done" : "")}</div>
                    {pay && <div style={{ color: "#6b7280" }}>{fmtDate(pay.received_date)}</div>}
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>{l.base_thb != null ? n2(Number(l.base_thb)) : ""}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{share}</td>
                  <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{n2(Number(l.amount))}</td>
                </tr>
              );
            })}
            {lines.length === 0 && <tr><td colSpan={6} style={{ ...cell, textAlign: "center", color: "#6b7280" }}>Nothing in this round.</td></tr>}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 40, padding: "7px 0", borderTop: `2px solid ${NAVY}`, borderBottom: `2px solid ${NAVY}`, fontSize: 14, fontWeight: 700 }}>
          <span>TOTAL (THB)</span><span>{n2(total)}</span>
        </div>
        {p.status === "paid" && Number(p.paid_amount ?? total) !== total && (
          <div style={{ textAlign: "right", fontSize: 12 }}>Transferred: ฿{n2(Number(p.paid_amount))}{p.note ? ` · ${p.note}` : ""}</div>
        )}
        {p.note && !(p.status === "paid" && Number(p.paid_amount ?? total) !== total) && <div style={{ fontSize: 12 }}>Note: {p.note}</div>}

        <div style={{ marginTop: "auto", fontSize: 11, color: "#4b5563", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontWeight: 700, color: NAVY }}>How this is worked out</div>
          {team ? (
            <div>Commission is a percentage of the money the school paid us, before VAT, counted in the month the money came in.
              When two people share a case, the amount is split equally (1/2). Paid in the month after the money came in.</div>
          ) : (
            <div>The partner&apos;s share is the agreed percentage of the THB that came in for the students it referred, VAT included.
              Paid on the last day of the month after the money came in (27 December in December).</div>
          )}
          <div style={{ marginTop: 6 }}>Questions about this summary: please contact APSthai{c.email ? ` at ${c.email}` : ""}.</div>
        </div>
      </div>
    </div>
  );
}
