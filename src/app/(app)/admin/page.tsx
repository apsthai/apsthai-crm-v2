import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export default async function AdminHome() {
  await requireAdmin();
  const { t } = await getT();
  const items = [
    { href: "/admin/staff", label: t("staffUsers") },
    { href: "/admin/schools", label: t("schools") },
    { href: "/admin/partners", label: t("partners") },
    { href: "/admin/products", label: t("products") },
    { href: "/admin/categories", label: `${t("categories")} / ${t("stages")}` },
    { href: "/admin/rates", label: t("rates") },
  ];
  return (
    <div className="space-y-4">
      <h1 className="h1">{t("admin")}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => <Link key={i.href} href={i.href} className="card hover:border-sky-400">{i.label}</Link>)}
      </div>
    </div>
  );
}
