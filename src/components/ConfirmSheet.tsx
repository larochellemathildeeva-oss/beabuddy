import { Button } from "@/components/ui/button";
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
    <Sheet
      open={open}
      onClose={onClose}
      page
      above
      title={title}
      hint="Before you go on"
      crumb="Cancel"
    >
      <div>
        <p className="menu-row-note pb-5 text-[18px] leading-snug">{body}</p>
        <Button type="button" variant="destructive" onClick={onConfirm} className="menu-done">
          {confirmLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} className="menu-done mt-3">
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
