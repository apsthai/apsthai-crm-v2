import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Flash } from "@/components/flash";
import { getMe, seesAll } from "@/lib/auth";
import { AdminHeader } from "../tabs";
import { SchoolsTable, type SchoolRow } from "./schools-table";

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<{ open?: string; ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (!seesAll(me)) redirect("/dashboard");
  const sp = await searchParams;
  const [schoolsRes, catsRes, stagesRes, appsRes, eduRes, payersRes] = await Promise.all([
    sb.from("schools").select(`id, name, country, type, default_currency, notes, active,
      products(id, active, category:categories(id, name_en), terms:income_terms(id, seq, type, payer_type, rate_pct, amount, currency, repeat, trigger_stage_id, bill_month))`)
      .order("name"),
    sb.from("categories").select("id, name_en").eq("active", true).order("sort_order"),
    sb.from("stages").select("id, category_id, name_en, sort_order").eq("active", true).order("sort_order"),
    sb.from("applications").select("product_id"),
    sb.from("education").select("school_id"),
    sb.from("payers").select("school_id"),
  ]);
  if (schoolsRes.error) throw new Error(schoolsRes.error.message);
  // Delete shows only for what nothing uses yet.
  const usedProducts = new Set((appsRes.data ?? []).map((a) => a.product_id as string));
  const usedSchools = new Set([...(eduRes.data ?? []), ...(payersRes.data ?? [])].map((x) => x.school_id as string).filter(Boolean));
  const schools = ((schoolsRes.data ?? []) as unknown as SchoolRow[]).map((sc) => {
    const products = sc.products.map((p) => ({ ...p, canDelete: !usedProducts.has(p.id) }));
    return { ...sc, products, canDelete: !usedSchools.has(sc.id) && products.every((p) => p.canDelete) };
  });
  return (
    <AppShell active="/admin/schools">
      <AdminHeader active="/admin/schools" />
      <Flash ok={sp.ok} err={sp.err} />
      <SchoolsTable schools={schools} open={sp.open ?? null}
        categories={(catsRes.data ?? []) as { id: string; name_en: string }[]}
        stages={(stagesRes.data ?? []) as { id: string; category_id: string; name_en: string }[]} />
    </AppShell>
  );
}
