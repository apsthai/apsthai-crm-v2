import { Field, inputCls } from "@/components/fields";
import type { LevelOpt } from "@/lib/education";

const SYSTEM: Record<string, string> = { TH: "Thai", UK: "UK / international", US: "US", HE: "University" };

// Current school (pick from the list or type a new one) and year. Both optional.
export function EducationFields({ schoolNames, levels, defaultSchool = "", defaultLevel = "", listId = "school-names" }:
  { schoolNames: string[]; levels: LevelOpt[]; defaultSchool?: string; defaultLevel?: string; listId?: string }) {
  const systems = [...new Set(levels.map((l) => l.system))];
  return (
    <>
      <Field label="Current school">
        <input name="current_school" list={listId} defaultValue={defaultSchool} placeholder="Type or pick a school" className={inputCls} autoComplete="off" />
        <datalist id={listId}>{schoolNames.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      <Field label="Year">
        <select name="current_level" defaultValue={defaultLevel} className={inputCls}>
          <option value="">-</option>
          {systems.map((sys) => (
            <optgroup key={sys} label={SYSTEM[sys] ?? sys}>
              {levels.filter((l) => l.system === sys).map((l) => <option key={l.id} value={l.id}>{l.name_en}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
    </>
  );
}
