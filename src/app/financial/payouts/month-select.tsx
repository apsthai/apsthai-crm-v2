"use client";

import { useRouter } from "next/navigation";

export function MonthSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      Money in
      <select value={value} onChange={(e) => router.push(`/financial/payouts?m=${e.target.value}`)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] font-semibold text-slate-900 outline-none focus:border-navy">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function PrintRound() {
  return (
    <button type="button" onClick={() => window.print()}
      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-navy hover:border-navy">
      Print statement
    </button>
  );
}
