import Image from "next/image";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Field, inputCls } from "@/components/fields";
import { Flash } from "@/components/flash";
import { Submit } from "@/components/submit";
import { getMe } from "@/lib/auth";
import { saveSettings } from "../actions";
import { FinHeader } from "../tabs";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { supabase: sb, me } = await getMe();
  if (me.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const { data } = await sb.from("company_settings").select("*").eq("single", true).maybeSingle();
  const c = (data ?? {}) as Record<string, string | null>;
  const input = (name: string, label: string, extra = "") => (
    <Field label={label} className={extra}><input name={name} defaultValue={c[name] ?? ""} className={inputCls} /></Field>
  );
  const area = (name: string, label: string) => (
    <Field label={label}><textarea name={name} rows={3} defaultValue={c[name] ?? ""} className={inputCls} /></Field>
  );

  return (
    <AppShell active="/financial">
      <FinHeader active="/financial/settings" />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveSettings} className="flex flex-col gap-5">
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-4">
            <Image src="/apsthai-seal.png" alt="APSthai company seal" width={64} height={70} style={{ objectFit: "contain" }} />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Company on the invoice</h2>
              <p className="mt-0.5 text-[13px] text-slate-500">English is used for payers outside Thailand, Thai for payers in Thailand.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {input("name_en", "Name (English)")}
            {input("name_th", "Name (Thai)")}
            {area("address_en", "Address (English)")}
            {area("address_th", "Address (Thai)")}
            {input("phone", "Phone")}
            {input("email", "Email")}
            {input("tax_id", "Tax ID")}
          </div>
        </section>
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Bank account for payments</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">Shown under &quot;Payment details&quot; on every invoice. Only Admin can see and change it.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {input("bank_account_name", "Account name")}
            {input("bank_name", "Bank")}
            {input("bank_branch", "Branch")}
            {input("bank_account_no", "Account number")}
            {input("bank_swift", "SWIFT code")}
            {input("bank_address", "Bank address", "sm:col-span-2")}
          </div>
          <div className="flex justify-end"><Submit>Save</Submit></div>
        </section>
      </form>
    </AppShell>
  );
}
