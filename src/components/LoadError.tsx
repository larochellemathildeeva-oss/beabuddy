/**
 * A read that failed, said plainly with a way to try again. Shown instead of
 * an empty state, because "nothing here yet" after a failed read looks like
 * the traveller's things were deleted.
 */
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="card-soft p-5 text-center">
      <p className="text-[16px] font-semibold">Couldn't load {what}</p>
      <p className="mt-1 text-[16px] text-muted-foreground">
        Check your connection. Nothing has been deleted.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-12 rounded-[var(--r-button)] border border-[var(--field-border)] px-5 text-[16px] font-semibold"
      >
        Try again
      </button>
    </div>
  );
}
