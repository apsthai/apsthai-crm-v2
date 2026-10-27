import { getT } from "@/lib/i18n";
import { signOut } from "@/app/(app)/shell-actions";

export default async function NoAccess() {
  const { t } = await getT();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-sm text-center">
        <p className="mb-4">{t("noAccess")}</p>
        <form action={signOut}><button className="btn-ghost">{t("logout")}</button></form>
      </div>
    </main>
  );
}
