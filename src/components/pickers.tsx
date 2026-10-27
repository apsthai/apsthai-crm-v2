import { SYSTEM_LABEL, type Named } from "@/lib/lookups";

export function SchoolSelect({ name, schools, value, placeholder }: { name: string; schools: { id: string; name: string; country: string }[]; value?: string | null; placeholder?: string }) {
  return (
    <select name={name} className="input" defaultValue={value ?? ""}>
      <option value="">{placeholder ?? "-"}</option>
      {schools.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.country})</option>)}
    </select>
  );
}

export function LevelSelect({ name, levels, value, lang }: { name: string; levels: (Named & { system: string })[]; value?: string | null; lang: string }) {
  const systems = [...new Set(levels.map((l) => l.system))];
  return (
    <select name={name} className="input" defaultValue={value ?? ""}>
      <option value="">-</option>
      {systems.map((sys) => (
        <optgroup key={sys} label={SYSTEM_LABEL[sys] ?? sys}>
          {levels.filter((l) => l.system === sys).map((l) => <option key={l.id} value={l.id}>{lang === "en" ? l.name_en : l.name_th}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function NamedSelect({ name, items, value, lang, required, placeholder }: { name: string; items: Named[]; value?: string | null; lang: string; required?: boolean; placeholder?: string }) {
  return (
    <select name={name} className="input" defaultValue={value ?? ""} required={required}>
      <option value="">{placeholder ?? "-"}</option>
      {items.map((i) => <option key={i.id} value={i.id}>{lang === "en" ? i.name_en : i.name_th}</option>)}
    </select>
  );
}

export function academicYears(center: string) {
  const y = Number(center.slice(0, 4));
  const out: string[] = [];
  for (let k = y - 6; k <= y + 3; k++) out.push(`${k}/${String((k + 1) % 100).padStart(2, "0")}`);
  return out;
}
export function currentAcademicYear(today: string) {
  const [y, m] = today.split("-").map(Number);
  const s = m >= 7 ? y : y - 1;
  return `${s}/${String((s + 1) % 100).padStart(2, "0")}`;
}
