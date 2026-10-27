import { Card } from "@/components/ui";
import { getMe } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { PasswordForm } from "./password-form";

export default async function Account() {
  const me = await getMe();
  const { t } = await getT();
  return (
    <div className="max-w-md space-y-4">
      <h1 className="h1">{t("account")}: {me.codename}</h1>
      <Card title={t("changePassword")}>
        <PasswordForm labels={{ pw: t("newPassword"), save: t("save"), ok: t("saved"), err: t("error") }} />
      </Card>
    </div>
  );
}
