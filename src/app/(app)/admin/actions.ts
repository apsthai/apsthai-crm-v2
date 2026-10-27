"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { bool, done, num, str } from "@/lib/actions";

const r = (p: string) => { revalidatePath(p); return p; };

// ---- staff and logins ----
export async function addStaff(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const { error } = await sb.from("staff").insert({
    codename: str(fd, "codename"), firstname: str(fd, "firstname"), lastname: str(fd, "lastname"),
    username: str(fd, "username")?.toLowerCase(), role: str(fd, "role") ?? "staff", org: str(fd, "org"),
    handles_cases: bool(fd, "handles_cases"),
  });
  done(r("/admin/staff"), error);
}

export async function updateStaff(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const { error } = await sb.from("staff").update({
    codename: str(fd, "codename"), firstname: str(fd, "firstname"), lastname: str(fd, "lastname"),
    role: str(fd, "role"), org: str(fd, "org"), handles_cases: bool(fd, "handles_cases"),
  }).eq("id", str(fd, "id"));
  done(r("/admin/staff"), error);
}

export async function loginAction(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const action = str(fd, "action");
  const { data, error } = await sb.functions.invoke("admin-users", {
    body: { action, staff_id: str(fd, "id"), password: str(fd, "password") ?? undefined, active: str(fd, "active") === "true" },
  });
  if (error) {
    let msg = error.message;
    try { const body = await (error as { context?: Response }).context?.json(); if (body?.error) msg = body.error; } catch { /* keep message */ }
    done(r("/admin/staff"), msg);
  }
  done(r("/admin/staff"), data?.error ?? null);
}

export async function saveTeam(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const team = str(fd, "team_id")!;
  const want = new Set(fd.getAll("member").map(String));
  const { data: cur } = await sb.from("team_members").select("id, staff_id").eq("team_id", team);
  const toRemove = (cur ?? []).filter((m: any) => !want.has(m.staff_id)).map((m: any) => m.id);
  const toAdd = [...want].filter((s) => !(cur ?? []).some((m: any) => m.staff_id === s)).map((s) => ({ team_id: team, staff_id: s }));
  if (toRemove.length) { const { error } = await sb.from("team_members").delete().in("id", toRemove); if (error) done(r("/admin/staff"), error); }
  if (toAdd.length) { const { error } = await sb.from("team_members").insert(toAdd); if (error) done(r("/admin/staff"), error); }
  done(r("/admin/staff"));
}

// ---- schools ----
export async function saveSchool(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const row = {
    name: str(fd, "name"), country: str(fd, "country"), type: str(fd, "type"), is_partner: bool(fd, "is_partner"),
    default_currency: str(fd, "default_currency"), invoice_contact: str(fd, "invoice_contact"), notes: str(fd, "notes"),
    active: str(fd, "id") ? bool(fd, "active") : true,
  };
  const id = str(fd, "id");
  const { error } = id ? await sb.from("schools").update(row).eq("id", id) : await sb.from("schools").insert(row);
  done(r("/admin/schools"), error);
}

// ---- partners ----
export async function savePartner(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const row = {
    name: str(fd, "name"), type: str(fd, "type"), school_id: str(fd, "school_id"),
    default_share_pct: num(fd, "default_share_pct"), contact: str(fd, "contact"),
    active: str(fd, "id") ? bool(fd, "active") : true,
  };
  const id = str(fd, "id");
  const { error } = id ? await sb.from("partners").update(row).eq("id", id) : await sb.from("partners").insert(row);
  done(r("/admin/partners"), error);
}

// ---- products and income terms ----
export async function addProduct(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const [kind, id] = (str(fd, "provider") ?? "|").split("|");
  const { data, error } = await sb.from("products").insert({
    school_id: kind === "school" ? id : null, partner_id: kind === "partner" ? id : null,
    category_id: str(fd, "category_id"), contract_location: str(fd, "contract_location"),
  }).select("id").single();
  if (error) done(r("/admin/products"), error);
  done(r(`/admin/products?open=${data.id}`));
}

export async function updateProduct(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const id = str(fd, "id")!;
  const { error } = await sb.from("products").update({ contract_location: str(fd, "contract_location"), active: bool(fd, "active") }).eq("id", id);
  done(r(`/admin/products?open=${id}`), error);
}

export async function addTerm(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const product = str(fd, "product_id")!;
  const payerType = str(fd, "payer_type") ?? "school";
  const { data: last } = await sb.from("income_terms").select("seq").eq("product_id", product).order("seq", { ascending: false }).limit(1).maybeSingle();
  const { error } = await sb.from("income_terms").insert({
    product_id: product, seq: (last?.seq ?? 0) + 1, type: str(fd, "type"), payer_type: payerType,
    payer_partner_id: payerType === "partner" ? str(fd, "payer_partner_id") : null,
    trigger_stage_id: str(fd, "trigger_stage_id"), year_offset: num(fd, "year_offset"), repeat: str(fd, "repeat") ?? "once",
    rate_pct: num(fd, "rate_pct"), amount: num(fd, "rate_pct") === null ? num(fd, "amount") : null, currency: str(fd, "currency"),
  });
  done(r(`/admin/products?open=${product}`), error);
}

export async function removeTerm(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const product = str(fd, "product_id")!;
  const { error } = await sb.from("income_terms").delete().eq("id", str(fd, "id"));
  done(r(`/admin/products?open=${product}`), error);
}

// ---- categories and stages ----
export async function saveCategory(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const { error } = await sb.from("categories").update({
    name_th: str(fd, "name_th"), name_en: str(fd, "name_en"), points: num(fd, "points"),
    estimated_value_thb: num(fd, "estimated_value_thb"), active: bool(fd, "active"),
  }).eq("id", str(fd, "id"));
  done(r("/admin/categories"), error);
}

export async function saveStage(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const { error } = await sb.from("stages").update({
    name_th: str(fd, "name_th"), name_en: str(fd, "name_en"), probability_pct: num(fd, "probability_pct"), active: bool(fd, "active"),
  }).eq("id", str(fd, "id"));
  done(r("/admin/categories"), error);
}

// ---- exchange rates ----
export async function addRate(fd: FormData) {
  const { supabase: sb } = await requireAdmin();
  const { error } = await sb.from("exchange_rates").upsert({ currency: str(fd, "currency"), rate_thb: num(fd, "rate_thb"), as_of: str(fd, "as_of") }, { onConflict: "currency,as_of" });
  done(r("/admin/rates"), error);
}

