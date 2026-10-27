import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Named = { id: string; name_th: string; name_en: string };

export async function loadLookups(sb: SupabaseClient) {
  const [schools, levels, categories, channels, partners, staff] = await Promise.all([
    sb.from("schools").select("id, name, country, type").eq("active", true).order("name"),
    sb.from("levels").select("id, system, name_th, name_en, sort_order").eq("active", true).order("system").order("sort_order"),
    sb.from("categories").select("id, name_th, name_en, in_house, points").eq("active", true).order("sort_order"),
    sb.from("lead_channels").select("id, name_th, name_en").eq("active", true).order("sort_order"),
    sb.from("partners").select("id, name, type, default_share_pct").eq("active", true).order("name"),
    sb.from("staff").select("id, codename, handles_cases, active").eq("active", true).order("codename"),
  ]);
  return {
    schools: (schools.data ?? []) as { id: string; name: string; country: string; type: string }[],
    levels: (levels.data ?? []) as (Named & { system: string })[],
    categories: (categories.data ?? []) as (Named & { in_house: boolean; points: number | null })[],
    channels: (channels.data ?? []) as Named[],
    partners: (partners.data ?? []) as { id: string; name: string; type: string; default_share_pct: number | null }[],
    staff: (staff.data ?? []) as { id: string; codename: string; handles_cases: boolean }[],
  };
}

export const SYSTEM_LABEL: Record<string, string> = { UK: "UK", US: "US", TH: "ไทย / Thai", HE: "Higher education" };
