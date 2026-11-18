// PDPA consent on the student: who gave it, when, and where the proof is kept (students.pdpa_consent_*).
export const PDPA_BY = [["student", "Student"], ["father", "Father"], ["mother", "Mother"], ["guardian", "Guardian"]] as const;
export const PDPA_HOW = ["Paper form", "Online form", "LINE", "Email"] as const;

// The proof is kept as "<how> · <note>", e.g. "Paper form · Drive/PDPA/2026".
export function pdpaLocation(how: string | null, note: string | null) {
  return [how, note].filter(Boolean).join(" · ") || null;
}
export function splitPdpaLocation(loc: string | null) {
  const [how, ...rest] = (loc ?? "").split(" · ");
  return (PDPA_HOW as readonly string[]).includes(how) ? { how, note: rest.join(" · ") } : { how: "", note: loc ?? "" };
}
export const pdpaByWord = (v: string | null) => PDPA_BY.find(([k]) => k === v)?.[1] ?? v ?? "";
