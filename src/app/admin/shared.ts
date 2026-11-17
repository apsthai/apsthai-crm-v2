// Small helpers shared by the Admin server actions.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";

export const s = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
export const num = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === null ? null : Number(v.replace(/,/g, ""));
};

// Every Admin action is admin only; RLS checks it too.
export async function adminDb() {
  const ctx = await getMe();
  if (ctx.me.role !== "admin") redirect("/dashboard");
  return ctx.supabase;
}

export function back(path: string, error?: { message: string } | string | null): never {
  revalidatePath("/", "layout");
  const msg = typeof error === "string" ? error : error?.message;
  redirect(`${path}${path.includes("?") ? "&" : "?"}${msg ? `err=${encodeURIComponent(msg)}` : "ok=1"}`);
}

// A delete the database refused because another record points to it.
export const inUse = (e: { message: string; code?: string } | null, what: string) =>
  e && (e.code === "23503" || e.message.includes("foreign key")) ? `${what} is already used elsewhere, so it cannot be deleted` : e;
