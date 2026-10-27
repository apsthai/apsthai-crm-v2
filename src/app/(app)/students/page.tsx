import Link from "next/link";
import { A, Card, Empty } from "@/components/ui";
import { getMe } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase: sb } = await getMe();
  const { t } = await getT();
  const q = ((await searchParams).q ?? "").trim();
  let query = sb.from("students").select("id, codename, nickname, firstname, lastname, cases(count)")
    .is("merged_into", null).order("created_at", { ascending: false }).limit(200);
  if (q) {
    const like = `%${q.replace(/[%,()]/g, " ")}%`;
    query = query.or(`codename.ilike.${like},nickname.ilike.${like},firstname.ilike.${like},lastname.ilike.${like}`);
  }
  const { data } = await query;
  const rows = (data ?? []) as { id: string; codename: string; nickname: string; firstname: string | null; lastname: string | null; cases: { count: number }[] }[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">{t("students")}</h1>
        <Link href="/students/new" className="btn">{t("newStudent")}</Link>
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={t("search")} className="input max-w-sm" />
        <button className="btn-ghost">{t("search")}</button>
      </form>
      <Card>
        {rows.length === 0 ? <Empty text={t("none")} /> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>{t("codename")}</th><th>{t("firstname")}</th><th>{t("lastname")}</th><th>{t("cases")}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><A href={`/students/${r.id}`}>{r.codename}</A></td>
                    <td>{r.firstname}</td><td>{r.lastname}</td><td>{r.cases?.[0]?.count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
