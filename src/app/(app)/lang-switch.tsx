"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { setLang } from "./shell-actions";

export function LangSwitch({ lang }: { lang: "th" | "en" }) {
  const path = usePathname();
  const sp = useSearchParams();
  const params = new URLSearchParams(sp);
  params.delete("ok"); params.delete("err");
  const back = params.toString() ? `${path}?${params}` : path;
  return (
    <form action={setLang}>
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="lang" value={lang === "th" ? "en" : "th"} />
      <button className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600">{lang === "th" ? "EN" : "ไทย"}</button>
    </form>
  );
}
