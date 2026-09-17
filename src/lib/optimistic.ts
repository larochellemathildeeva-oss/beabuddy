/**
 * The shape of an optimistic write.
 *
 * Apply locally, send, and on failure put it back *loudly*. The loud part is
 * the point: a silent snap-back is indistinguishable from the app being
 * broken, because the only thing a person sees is their change undoing itself
 * for no stated reason. Whatever else fails, they should be told what did.
 */

/** Supabase-shaped results, plain throws, and void writes all pass through. */
export type WriteOutcome = { error?: unknown } | void | null | undefined;

export function outcomeError(outcome: WriteOutcome): unknown {
  if (outcome && typeof outcome === "object" && "error" in outcome) {
    return (outcome as { error?: unknown }).error ?? null;
  }
  return null;
}

/**
 * What to tell someone when a write did not land.
 *
 * Always names the thing and the action, because "Something went wrong" is
 * the message that makes people stop trusting an app. The provider's own text
 * is appended when it is likely to mean something to a reader, and dropped
 * when it is a stack trace or a bare code.
 */
export function writeFailureMessage(
  label: string,
  action: string,
  error?: unknown,
): { title: string; body: string } {
  const thing = label.trim() || "that change";
  const detail = readableError(error);
  return {
    title: `Couldn't ${action} ${thing}`,
    body: detail ? `${detail} Your change has been put back.` : "Your change has been put back.",
  };
}

/** Provider text worth showing, or null. */
export function readableError(error: unknown): string | null {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  const text = raw.trim();
  if (!text) return null;
  // Anything that reads like machinery rather than a sentence is noise to a
  // person: stack frames, bare SQL states, JSON blobs.
  if (text.length > 160) return null;
  // "at Object.foo (bundle.js:1:2)" — dotted, so \w+ alone is not enough.
  if (/\bat\s+[\w$.]+\s*\(/.test(text)) return null;
  if (/^[A-Z0-9_]{4,}$/.test(text)) return null;
  if (text.startsWith("{") || text.startsWith("[")) return null;
  return text.endsWith(".") ? text : `${text}.`;
}

/**
 * Run one optimistic write.
 *
 * Returns whether it landed, so a caller can decide whether to celebrate. It
 * never throws for a failed write — the report is the toast, and a throw here
 * would just become an unhandled rejection in an onClick.
 */
export async function runOptimistic(opts: {
  /** Update local state now. */
  apply: () => void;
  /**
   * Send it. Return a Supabase-shaped result or throw.
   *
   * PromiseLike rather than Promise on purpose: a Supabase query builder is a
   * thenable, not a real promise, so requiring Promise here would force every
   * call site to wrap its query in an extra async arrow for no benefit.
   */
  write: () => PromiseLike<WriteOutcome>;
  /** Re-read the truth. Called on success and on failure alike. */
  reconcile: () => Promise<void>;
  /** Say what went wrong, in the interface. */
  report: (message: { title: string; body: string }) => void;
  /** What the change was about: "Bar Alimentar", "the budget". */
  label: string;
  /** The verb, lower case: "save", "remove", "tick off". */
  action: string;
}): Promise<boolean> {
  opts.apply();
  let failure: unknown = null;
  try {
    failure = outcomeError(await opts.write());
  } catch (thrown) {
    failure = thrown ?? new Error("write failed");
  }

  // Reconcile either way. On success it settles the row where the server
  // actually put it; on failure it is what undoes the optimistic change.
  try {
    await opts.reconcile();
  } catch {
    /* A failed re-read must not mask the write error we are about to report. */
  }

  if (failure) {
    opts.report(writeFailureMessage(opts.label, opts.action, failure));
    return false;
  }
  return true;
}
