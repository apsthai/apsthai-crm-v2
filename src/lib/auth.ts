import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export type Me = {
  id: string; codename: string; role: "admin" | "staff"; org: string; handles_cases: boolean;
};

// The signed-in staff member, or a redirect to /login.
export const getMe = cache(async (): Promise<Me & { supabase: Awaited<ReturnType<typeof createClient>> }> => {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) redirect("/login");
  const { data: me } = await supabase
    .from("staff").select("id, codename, role, org, handles_cases, active")
    .eq("auth_user_id", u.user.id).maybeSingle();
  if (!me || !me.active) redirect("/no-access");
  return { ...(me as Me), supabase };
});

export async function requireAdmin() {
  const me = await getMe();
  if (me.role !== "admin") redirect("/");
  return me;
}
