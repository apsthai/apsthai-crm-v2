import Link from "next/link";

const TABS = [["/admin/staff", "Staff & KPI"], ["/admin/schools", "Schools & rates"], ["/admin/services", "Services"],
  ["/admin/rules", "Team commission"], ["/admin/rates", "Exchange rates"], ["/admin/targets", "Targets"]];

export function AdminHeader({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
      <nav className="flex flex-wrap gap-1 rounded-lg bg-slate-200 p-1 text-sm" aria-label="Admin">
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className={active === href
            ? "rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 shadow-sm"
            : "rounded-md px-3 py-1.5 text-slate-600 hover:text-slate-900"}>{label}</Link>
        ))}
      </nav>
    </div>
  );
}
