export const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-navy focus:ring-3 focus:ring-navy/15";

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-[13px] font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
