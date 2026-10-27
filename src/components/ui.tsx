import Link from "next/link";

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Card({ title, children, right, className }: { title?: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ""}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const PILL: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800", completed: "bg-emerald-100 text-emerald-800", paid: "bg-emerald-100 text-emerald-800",
  enrolled: "bg-emerald-100 text-emerald-800", approved: "bg-emerald-100 text-emerald-800", reviewed: "bg-sky-100 text-sky-800",
  in_progress: "bg-sky-100 text-sky-800", invoiced: "bg-sky-100 text-sky-800", issued: "bg-sky-100 text-sky-800", offered: "bg-sky-100 text-sky-800",
  partially_paid: "bg-amber-100 text-amber-800", pending: "bg-amber-100 text-amber-800", expected: "bg-amber-50 text-amber-700",
  fail: "bg-red-100 text-red-800", failed: "bg-red-100 text-red-800", rejected: "bg-red-100 text-red-800", cancelled: "bg-slate-200 text-slate-600",
  withdrawn: "bg-slate-200 text-slate-600", skipped: "bg-slate-200 text-slate-600", draft: "bg-slate-100 text-slate-600", not_started: "bg-slate-100 text-slate-600",
};
export function Pill({ status, label }: { status: string; label: string }) {
  return <span className={`pill ${PILL[status] ?? "bg-slate-100 text-slate-700"}`}>{label}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="py-3 text-sm text-slate-400">{text}</p>;
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="link">{children}</Link>;
}

export function Submit({ children, className, confirm }: { children: React.ReactNode; className?: string; confirm?: string }) {
  return <button type="submit" className={className ?? "btn"} data-confirm={confirm}>{children}</button>;
}
