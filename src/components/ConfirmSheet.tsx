import { Sheet } from "@/components/Sheet";

/**
 * Asking before something irreversible happens.
 *
 * Béa's rule is undo, not confirmation: removing a timeline row takes it away
 * and offers it back for a few seconds, which is faster and kinder than a
 * dialog. But some things have no undo — deleting a trip, taking away
 * someone's access, walking out of a trip that is not yours — and those were
 * asking with the browser's native `confirm()`. A grey system box, in the
 * system's own words, on top of a warm cream app, with no way to name what
 * actually happens next.
 *
 * So: one sheet, the app's voice, and the consequence written out. The
 * confirm button carries the verb rather than saying "OK", because "OK" to a
 * question you half-read is how people delete things.
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** What will actually happen, in plain words. */
  body: string;
  /** The verb, not "OK" — "Delete", "Remove", "Leave". */
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} width="sm" showClose={false} above>
      <div className="text-center">
        <p className="text-[14.5px] text-muted-foreground">{body}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl border border-border px-3 py-2 text-[14.5px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-xl bg-destructive px-3 py-2 text-[14.5px] font-semibold text-destructive-foreground"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
