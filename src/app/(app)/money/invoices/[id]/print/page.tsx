import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { fmtMoney } from "@/lib/format";
import { PrintButton } from "./print-button";

const EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const d = (iso?: string | null) => { if (!iso) return ""; const [y, m, dd] = iso.split("-").map(Number); return `${dd} ${EN[m - 1]} ${y}`; };

export default async function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase: sb } = await requireAdmin();
  const { data: inv } = await sb.from("invoices").select("*, invoice_lines(id, description, amount, receivable:receivables(type))").eq("id", id).maybeSingle();
  if (!inv) notFound();
  const lines = (inv.invoice_lines ?? []) as any[];

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-[13px] leading-relaxed text-slate-900 print:p-0">
      <div className="no-print mb-6 text-right"><PrintButton /></div>
      <div className="flex justify-between border-b border-slate-300 pb-4">
        <div>
          <p className="text-xl font-semibold text-sky-900">APS Thai</p>
          <p className="text-xs text-slate-500">For the best education in your own version</p>
          <p className="mt-2 text-xs">942/159, 19th Floor, Charn Issara Tower 1, Rama 4 Road,<br />Suriyawong, Bangrak, Bangkok 10500, Thailand<br />Tel 02-026-3221, 084-320-1789 · LINE @apsthai</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-wide">INVOICE</p>
          <p className="mt-2">No. <b>{inv.invoice_no}</b></p>
          <p>Date {d(inv.date)}</p>
          {inv.due_date && <p>Due {d(inv.due_date)}</p>}
        </div>
      </div>
      <div className="mt-5">
        <p className="text-xs uppercase text-slate-500">Bill to</p>
        <p className="font-semibold">{inv.bill_to_name}</p>
        <p className="whitespace-pre-line">{inv.bill_to_address}</p>
      </div>
      <table className="mt-6 w-full border-collapse">
        <thead><tr className="border-b border-slate-400 text-left"><th className="py-2 w-10">#</th><th className="py-2">Description</th><th className="py-2 text-right">Amount ({inv.currency})</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} className="border-b border-slate-200">
              <td className="py-2">{i + 1}</td>
              <td className="py-2">{l.receivable?.type === "commission" ? "Commission" : l.receivable?.type === "service_fee" ? "Service fee" : l.receivable?.type === "bonus" ? "Bonus" : ""}{l.description ? ` · ${l.description}` : ""}</td>
              <td className="py-2 text-right">{fmtMoney(l.amount, inv.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td /><td className="py-3 text-right font-semibold">Total</td><td className="py-3 text-right font-semibold">{fmtMoney(inv.total, inv.currency)}</td></tr></tfoot>
      </table>
    </div>
  );
}
