"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setLang(fd: FormData) {
  const lang = fd.get("lang") === "en" ? "en" : "th";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  const back = String(fd.get("back") ?? "/");
  redirect(back.startsWith("/") ? back : "/");
}
