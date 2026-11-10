import { undoSuccess } from "@/app/approvals/actions";
import { Submit } from "@/components/submit";

// Admin only: put a successful case back in progress.
export function UndoButton({ caseId, back }: { caseId: string; back?: string }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-navy">Undo success</summary>
      <form action={undoSuccess} className="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
        <input type="hidden" name="case_id" value={caseId} />
        {back && <input type="hidden" name="back" value={back} />}
        <p className="text-slate-700">The case goes back to in progress, its points are removed and amounts not yet invoiced are cancelled.</p>
        <Submit variant="danger">Undo success</Submit>
      </form>
    </details>
  );
}
