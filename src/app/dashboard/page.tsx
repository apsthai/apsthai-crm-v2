import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Placeholder until the owner designs the dashboard. It only proves the sign-in works end to end.
export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signout");

  // A brand-new token can be rejected for a moment right after sign-in, so retry briefly.
  let staff: { codename: string; active: boolean } | null = null;
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.from("staff").select("codename, active").eq("auth_user_id", user.id).maybeSingle();
    if (!error) { staff = data; break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!staff?.active) redirect("/auth/signout?msg=inactive");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Image src="/logo.png" alt="APSthai" width={848} height={342} className="h-auto w-24" />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{staff.codename}</span>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:border-navy hover:text-navy">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">Today&apos;s overview will appear here.</p>
      </main>
    </div>
  );
}
