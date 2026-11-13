import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { n2, thaiDate, thaiTotals } from "@/lib/fin";
import { PrintButton } from "./print-button";

const NAVY = "#1f3864";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { supabase: sb } = await getMe();
  const { data } = await sb.from("invoices").select("invoice_no").eq("id", (await params).id).maybeSingle();
  return { title: data?.invoice_no ?? "Draft invoice" };
}

export default async function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const { id } = await params;
  const [{ data: inv }, { data: co }] = await Promise.all([
    sb.from("invoices").select("id, invoice_no, date, status, currency, total, bill_to_name, bill_to_address, bill_to_country, bill_to_tax_id, thai_vat, wht_pct, invoice_lines(description, amount, created_at)").eq("id", id).maybeSingle(),
    sb.from("company_settings").select("*").eq("single", true).maybeSingle(),
  ]);
  if (!inv) notFound();
  const c = (co ?? {}) as Record<string, string | null>;
  const th = !!inv.thai_vat;
  const lines = [...(inv.invoice_lines ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const total = Number(inv.total ?? 0);
  const t = thaiTotals(total, Number(inv.wht_pct));
  // A Thai invoice lists amounts before VAT; the last line takes the rounding so the lines add up to the subtotal.
  const shown = lines.map((l) => (th ? Math.round(Number(l.amount) * 10000 / 107) / 100 : Number(l.amount)));
  if (th && shown.length) shown[shown.length - 1] = Math.round((t.sub - shown.slice(0, -1).reduce((a, b) => a + b, 0)) * 100) / 100;
  const no = inv.invoice_no ?? (th ? "ร่าง" : "DRAFT");
  const L = th
    ? { title: "ใบแจ้งหนี้", billTo: "ลูกค้า", no: "เลขที่", date: "วันที่", taxId: "เลขประจำตัวผู้เสียภาษี", item: "ลำดับ", desc: "รายการ", cur: "สกุลเงิน", amount: "จำนวนเงิน",
        pay: "รายละเอียดการชำระเงิน", accName: "ชื่อบัญชี", bank: "ธนาคาร", branch: "สาขา", bankAddr: "ที่อยู่ธนาคาร", accNo: "เลขที่บัญชี", swift: "SWIFT",
        tel: "โทร", ref: `กรุณาระบุเลขที่ ${no} ในการชำระเงิน` }
    : { title: "INVOICE", billTo: "BILL TO", no: "Invoice No.", date: "Date", taxId: "Tax ID", item: "No.", desc: "Transaction", cur: "Currency", amount: "Amount",
        pay: "PAYMENT DETAILS", accName: "Account Name", bank: "Bank", branch: "Branch", bankAddr: "Bank Address", accNo: "Account Number", swift: "SWIFT Code",
        tel: "Tel", ref: `Please quote ${no} as the payment reference.` };
  const bank = [[L.accName, c.bank_account_name], [L.bank, c.bank_name], [L.branch, c.bank_branch], [L.bankAddr, th ? null : c.bank_address],
    [L.accNo, c.bank_account_no], [L.swift, th ? null : c.bank_swift]].filter(([, v]) => v);
  const blank = Math.max(0, 6 - lines.length);
  const cell = { padding: "5px 8px", border: "1px solid #e5e7eb" } as const;

  return (
    <div className="min-h-dvh bg-slate-200 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 0 } @media print { .no-print { display: none !important } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap items-center justify-between gap-3 px-4">
        <Link href={`/financial/invoices/${inv.id}`} className="text-sm text-navy hover:underline">← Back to the invoice</Link>
        <div className="flex items-center gap-3">
          {inv.status === "draft" && <span className="text-sm text-amber-800">Draft: issue it to give it a number.</span>}
          {inv.status === "cancelled" && <span className="text-sm text-brand-red">This invoice is cancelled.</span>}
          <PrintButton />
        </div>
      </div>
      <div style={{ width: 794, minHeight: 1123, boxSizing: "border-box", padding: "56px 64px", background: "#fff", color: "#111827", fontSize: 13,
        fontFamily: th ? "'IBM Plex Sans Thai', Arial, sans-serif" : "Arial, Helvetica, sans-serif", display: "flex", flexDirection: "column", gap: 22 }}
        className="mx-auto shadow-lg print:shadow-none">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, paddingBottom: 14, borderBottom: `2px solid ${NAVY}` }}>
          <Image src="/apsthai-seal.png" alt="APSthai company seal" width={96} height={106} style={{ objectFit: "contain" }} />
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{th ? c.name_th : c.name_en}</div>
            <div style={{ fontSize: 11, maxWidth: 420 }}>{th ? c.address_th : c.address_en}</div>
            <div style={{ fontSize: 11 }}>{[c.phone && `${L.tel}: ${c.phone}`, c.email && `Email: ${c.email}`].filter(Boolean).join(" | ")}</div>
            {c.tax_id && <div style={{ fontSize: 11 }}>{L.taxId}: {c.tax_id}</div>}
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: 26, fontWeight: 700, color: NAVY, letterSpacing: "0.02em" }}>{L.title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em" }}>{L.billTo}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{inv.bill_to_name}</div>
            {inv.bill_to_address && <div style={{ whiteSpace: "pre-line" }}>{inv.bill_to_address}</div>}
            {!th && inv.bill_to_country && <div style={{ marginTop: 10 }}>{inv.bill_to_country}</div>}
            {inv.bill_to_tax_id && <div style={{ marginTop: 6 }}>{L.taxId} {inv.bill_to_tax_id}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 12px", alignContent: "start", minWidth: 220 }}>
            <div style={{ fontWeight: 700, textAlign: "right" }}>{L.no}</div>
            <div style={{ fontWeight: 700, border: "1px solid #d1d5db", padding: "1px 8px", textAlign: "right" }}>{no}</div>
            <div style={{ fontWeight: 700, textAlign: "right" }}>{L.date}</div>
            <div style={{ textAlign: "right" }}>{th ? thaiDate(inv.date) : fmtDate(inv.date)}</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: NAVY, color: "#fff" }}>
              <th style={{ padding: "5px 8px", width: 40 }}>{L.item}</th>
              <th style={{ padding: "5px 8px", textAlign: "left" }}>{L.desc}</th>
              <th style={{ padding: "5px 8px", width: 80 }}>{L.cur}</th>
              <th style={{ padding: "5px 8px", width: 110 }}>{L.amount}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} style={{ background: i % 2 ? "#f3f4f6" : "#fff" }}>
                <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
                <td style={cell}>{l.description}</td>
                <td style={{ ...cell, textAlign: "center" }}>{inv.currency}</td>
                <td style={{ ...cell, textAlign: "right" }}>{n2(shown[i])}</td>
              </tr>
            ))}
            {Array.from({ length: blank }, (_, i) => (
              <tr key={`b${i}`} style={{ background: (lines.length + i) % 2 ? "#f3f4f6" : "#fff" }}>
                <td style={{ ...cell, padding: "9px 8px" }} /><td style={cell} /><td style={cell} /><td style={cell} />
              </tr>
            ))}
          </tbody>
        </table>
        {th ? (
          <div style={{ marginLeft: "auto", width: 320, display: "flex", flexDirection: "column", fontSize: 13 }}>
            {[["รวมเป็นเงิน", t.sub], ["ภาษีมูลค่าเพิ่ม 7%", t.vat], [`ยอดรวมทั้งสิ้น (${inv.currency})`, t.total, true],
              ...(Number(inv.wht_pct) > 0 ? [["หัก ภาษี ณ ที่จ่าย 3%", t.wht], [`ยอดชำระสุทธิ (${inv.currency})`, t.net, true]] : [])]
              .map(([k, v, bold]) => (
                <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: bold ? 700 : 400,
                  borderTop: bold ? `2px solid ${NAVY}` : undefined, borderBottom: bold ? `2px solid ${NAVY}` : undefined }}>
                  <span>{k}</span><span>{n2(Number(v))}</span>
                </div>
              ))}
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 40, padding: "7px 0", borderTop: `2px solid ${NAVY}`, borderBottom: `2px solid ${NAVY}`, fontSize: 14, fontWeight: 700 }}>
            <span>TOTAL ({inv.currency})</span><span>{n2(total)}</span>
          </div>
        )}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ background: NAVY, color: "#fff", fontWeight: 700, padding: "4px 8px", fontSize: 12 }}>{L.pay}</div>
          {bank.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "200px minmax(0, 1fr)", gap: "3px 12px", fontSize: 12 }}>
              {bank.map(([k, v]) => <div key={k} style={{ display: "contents" }}><div style={{ fontWeight: 700 }}>{k}</div><div>{v}</div></div>)}
            </div>
          ) : <div className="no-print" style={{ fontSize: 12, color: "#b4142a" }}>Bank details are not filled in yet (Financial · Settings).</div>}
          <div style={{ fontSize: 11, fontStyle: "italic", marginTop: 2 }}>{L.ref}</div>
        </div>
      </div>
    </div>
  );
}
