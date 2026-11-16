import { AppShell } from "@/components/app-shell";
import { getMe } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const { me } = await getMe();
  return (
    <AppShell active="/account">
      <h1 className="text-2xl font-semibold text-slate-900">My account</h1>
      <section className="flex max-w-md flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Change password</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Signed in as {me.codename}. At least 8 characters.</p>
        </div>
        <PasswordForm />
      </section>
    </AppShell>
  );
}
