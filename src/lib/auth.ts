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
  if (!u.user) redirect("/auth/signout");
  // Right after sign-in the database can briefly reject a brand-new token (clock skew, PGRST303).
  // Retry instead of treating that as "no access"; only a clean "not found / inactive" means no access.
  let me: { active: boolean } & Record<string, unknown> | null = null;
  for (let attempt = 0; ; attempt++) {
    const res = await supabase
      .from("staff").select("id, codename, role, org, handles_cases, active")
      .eq("auth_user_id", u.user.id).maybeSingle();
    if (!res.error) { me = res.data; break; }
    if (attempt >= 3) throw new Error(`Could not load your staff record: ${res.error.message}`);
    await new Promise((r) => setTimeout(r, 700));
  }
  if (!me || !me.active) redirect("/no-access");
  return { ...(me as unknown as Me), supabase };
});

export async function requireAdmin() {
  const me = await getMe();
  if (me.role !== "admin") redirect("/");
  return me;
}
