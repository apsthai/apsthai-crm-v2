import "server-only";
import { cookies } from "next/headers";
import { dict, type Key, type Lang } from "./dict";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return v === "en" ? "en" : "th";
}

export async function getT() {
  const lang = await getLang();
  const t = (k: Key | (string & {})) =>
    (dict as Record<string, readonly [string, string]>)[k]?.[lang === "en" ? 1 : 0] ?? k;
  // pick the right language from a master row with name_th / name_en
  const n = (row?: { name_th?: string | null; name_en?: string | null } | null) =>
    !row ? "" : (lang === "en" ? row.name_en : row.name_th) || row.name_en || row.name_th || "";
  return { t, n, lang };
}
