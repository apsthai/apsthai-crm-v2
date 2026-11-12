"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/auth";

export type LoginState = { error: string | null; password: string | null; done: string | null };

// 8 characters, no look-alikes (0/O, 1/l/I).
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const newPassword = () => Array.from({ length: 8 }, () => CHARS[randomInt(CHARS.length)]).join("");

// Logins are managed by the admin-users Edge Function (it holds the service key and checks the caller is admin).
// The password is made here, sent once to the function and shown once to the admin. It is never stored or logged.
export async function manageLogin(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const { supabase, me } = await getMe();
  if (me.role !== "admin") return { error: "Admin only", password: null, done: null };
  const action = String(fd.get("action") ?? "");
  const staffId = String(fd.get("staff_id") ?? "");
  const password = action === "create_login" || action === "reset_password" ? newPassword() : undefined;
  const body = action === "set_active"
    ? { action, staff_id: staffId, active: fd.get("active") === "1" }
    : { action, staff_id: staffId, password };

  const { error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg; } catch { /* keep the generic message */ }
    return { error: msg, password: null, done: null };
  }
  revalidatePath("/admin/staff");
  const done = action === "create_login" ? "Login created" : action === "reset_password" ? "Password reset"
    : fd.get("active") === "1" ? "Login switched on" : "Login switched off";
  return { error: null, password: password ?? null, done };
}
