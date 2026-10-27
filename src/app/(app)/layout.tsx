import Link from "next/link";
import { Suspense } from "react";
import { Flash } from "@/components/flash";
import { PendingUI } from "@/components/pending";
import { getMe } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { LangSwitch } from "./lang-switch";
import { signOut } from "./shell-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const { t, lang } = await getT();
  const isAdmin = me.role === "admin";
  const { count: pending } = isAdmin
    ? await me.supabase.from("stage_updates").select("id", { count: "exact", head: true }).eq("approval", "pending")
    : { count: 0 };

  const nav = [
    { href: "/", label: t("myWork") },
    { href: "/students", label: t("students") },
    { href: "/cases", label: t("cases") },
    ...(isAdmin ? [{ href: "/approvals", label: `${t("approvals")}${pending ? ` (${pending})` : ""}` }] : []),
    ...(isAdmin ? [{ href: "/money", label: t("money") }] : []),
    { href: "/payouts", label: t("payouts") },
    { href: "/dashboard", label: t("dashboard") },
    ...(isAdmin ? [{ href: "/admin", label: t("admin") }] : []),
  ];

  return (
    <div className="min-h-screen">
      <Suspense><PendingUI /></Suspense>
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <Link href="/" className="font-semibold text-sky-800">APSthai CRM</Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto text-sm sm:order-none sm:w-auto">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100">{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Suspense><LangSwitch lang={lang} /></Suspense>
            <Link href="/account" className="text-slate-600 hover:underline">{me.codename}</Link>
            <form action={signOut}><button className="text-slate-500 hover:underline">{t("logout")}</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">
        <Suspense><Flash okText={t("saved")} errText={t("error")} /></Suspense>
        {children}
      </main>
    </div>
  );
}
