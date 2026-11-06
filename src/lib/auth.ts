import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Me = { id: string; codename: string; role: string; employment: string };

// The signed-in staff member, or a redirect. Cached per request.
export const getMe = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signout");

  // A brand-new token can be rejected for a moment right after sign-in, so retry briefly.
  let me: (Me & { active: boolean }) | null = null;
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.from("staff")
      .select("id, codename, role, employment, active").eq("auth_user_id", user.id).maybeSingle();
    if (!error) { me = data; break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!me?.active) redirect("/auth/signout?msg=inactive");
  return { supabase, me: me as Me };
});
