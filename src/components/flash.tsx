// Result of the last save, passed back in the URL by the server action.
export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-brand-red">Could not save: {err}</p>;
  if (ok) return <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Saved.</p>;
  return null;
}
