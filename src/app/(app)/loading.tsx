export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy>
      <div className="h-7 w-48 rounded bg-slate-200" />
      <div className="h-32 rounded-xl bg-slate-100" />
      <div className="h-64 rounded-xl bg-slate-100" />
    </div>
  );
}
