"use client";
import { useSearchParams } from "next/navigation";

export function Flash({ okText, errText }: { okText: string; errText: string }) {
  const sp = useSearchParams();
  const err = sp.get("err");
  if (err) return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{errText}: {err}</div>;
  if (sp.get("ok")) return <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{okText}</div>;
  return null;
}
