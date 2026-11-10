import Image from "next/image";
import Link from "next/link";

import { getMe } from "@/lib/auth";

// The header loads who is signed in itself (cached per request), and shows Approvals with a count to admin only.
export async function AppShell({ active, children }: { name?: string; active: string; children: React.ReactNode }) {
  const { supabase, me } = await getMe();
  const isAdmin = me.role === "admin";
  const { count } = isAdmin
    ? await supabase.from("stage_updates").select("id", { count: "exact", head: true }).eq("approval", "pending")
    : { count: 0 };
  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/cases", label: "Cases" },
    ...(isAdmin ? [{ href: "/approvals", label: "Approvals", badge: count ?? 0 }] : []),
  ] as { href: string; label: string; badge?: number }[];
  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/dashboard" aria-label="APSthai CRM home">
            <Image src="/logo.png" alt="APSthai" width={848} height={342} priority className="h-auto w-24" />
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href}
                className={active.startsWith(n.href)
                  ? "flex items-center gap-1.5 rounded-lg bg-navy-50 px-3 py-2 font-semibold text-navy"
                  : "flex items-center gap-1.5 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-navy"}>
                {n.label}
                {n.badge ? <span className="rounded-full bg-brand-red px-1.5 text-xs leading-5 font-semibold text-white">{n.badge}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{me.codename}</span>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] hover:border-navy hover:text-navy">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-7 pb-12 sm:px-6">{children}</main>
    </div>
  );
}

export function Card({ title, sub, right, children, className = "" }:
  { title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {sub && <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>}
          </div>
          {right && <div className="text-[13px] text-slate-500">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tile({ label, value, sub, tone = "ink" }:
  { label: string; value: string; sub?: string; tone?: "ink" | "navy" | "red" }) {
  const color = tone === "red" ? "text-brand-red" : tone === "navy" ? "text-navy" : "text-slate-900";
  return (
    <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1 rounded-xl border border-slate-200 bg-white px-[18px] py-4">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className={`text-[28px] leading-tight font-semibold ${color}`}>{value}</span>
      {sub && <span className="text-[13px] text-slate-500">{sub}</span>}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">{children}</h2>;
}

export function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2.5 rounded-full bg-navy-50">
      <div className="h-2.5 rounded-full bg-navy" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
