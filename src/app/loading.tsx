// Shown while a page loads, so a click never looks like nothing happened.
export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-0 z-50" role="status" aria-label="Loading">
      <div className="h-1 w-full overflow-hidden bg-navy-50"><div className="h-1 w-1/3 animate-[loading_1s_ease-in-out_infinite] bg-navy" /></div>
      <div className="flex min-h-dvh items-center justify-center">
        <span className="size-8 animate-spin rounded-full border-4 border-navy/20 border-t-navy" />
      </div>
    </div>
  );
}
