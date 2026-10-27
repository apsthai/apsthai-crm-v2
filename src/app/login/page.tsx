import { getT } from "@/lib/i18n";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { t } = await getT();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="h1 mb-1">{t("appName")}</h1>
        <p className="muted mb-4">{t("login")}</p>
        <LoginForm labels={{ username: t("username"), password: t("password"), login: t("login"), failed: t("loginFailed") }} />
      </div>
    </main>
  );
}
