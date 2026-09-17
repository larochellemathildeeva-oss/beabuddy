import { useCallback } from "react";
import { toast } from "sonner";
import { removedLine, restoredLine, undoFailedLine, UNDO_WINDOW_MS } from "@/lib/undo";
import { readableError } from "@/lib/optimistic";
import { confirm } from "@/lib/haptics";

/**
 * Run something destructive, then offer to put it back.
 *
 * The action runs immediately — undo is not a delayed delete, because a
 * pending delete is worse: the row sits there looking alive, and closing the
 * tab commits it anyway. The row goes now, and `restore` re-creates it if the
 * toast is tapped in time.
 */
export function useUndo() {
  /** Remove one thing, with an undo toast. */
  const removeWithUndo = useCallback(
    async (input: {
      label: string;
      count?: number;
      remove: () => Promise<void>;
      restore: () => Promise<void>;
    }) => {
      const count = input.count ?? 1;
      try {
        await input.remove();
      } catch (e) {
        // No toast and no undo offer when nothing actually went — offering
        // Undo here would insert a second copy of a row that never left.
        // Say why where the reason is something a person can act on.
        toast.error(`Couldn't remove ${input.label}.`, {
          description: readableError(e) ?? "Try again in a moment.",
        });
        return;
      }
      confirm();
      toast(removedLine(input.label, count), {
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                await input.restore();
                confirm();
                toast.success(restoredLine(input.label, count));
              } catch (e) {
                toast.error(undoFailedLine(input.label), {
                  ...(readableError(e) ? { description: readableError(e)! } : {}),
                });
              }
            })();
          },
        },
      });
    },
    [],
  );

  /** Confirm a bulk add, with an undo that takes the whole batch back out. */
  const addedWithUndo = useCallback(
    (input: { message: string; label: string; count: number; undo: () => Promise<void> }) => {
      toast.success(input.message, {
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                await input.undo();
                confirm();
                toast.success(`Removed those ${input.count} again.`);
              } catch (e) {
                toast.error("Couldn't undo that.", {
                  description: readableError(e) ?? "Remove them by hand if you need to.",
                });
              }
            })();
          },
        },
      });
    },
    [],
  );

  return { removeWithUndo, addedWithUndo };
}
