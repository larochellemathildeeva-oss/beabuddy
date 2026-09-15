/**
 * Undo copy and bookkeeping.
 *
 * Every Remove in Béa was instant and final, and a fourteen-stop import took
 * fourteen taps to unpick. Undo is kinder than "Are you sure?" — it does not
 * tax the people who meant it, and it rescues the ones who did not.
 *
 * The pure parts live here so the wording and the counting are testable; the
 * toast itself is in `useUndo`.
 */

export const UNDO_WINDOW_MS = 8_000;

/** "Removed Bar Raval." / "Removed 3 stops." — what just happened, briefly. */
export function removedLine(label: string, count = 1): string {
  if (count > 1) return `Removed ${count} ${plural(label, count)}.`;
  return `Removed ${label}.`;
}

/** "Added 14 stops." */
export function addedLine(label: string, count: number): string {
  return `Added ${count} ${plural(label, count)}.`;
}

/** "Put Bar Raval back." — the confirmation after undoing. */
export function restoredLine(label: string, count = 1): string {
  if (count > 1) return `Put ${count} ${plural(label, count)} back.`;
  return `Put ${label} back.`;
}

function plural(label: string, count: number): string {
  if (count === 1) return label;
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

/**
 * What an undo could not put back.
 *
 * Restoring is a fresh insert, so a row comes back with a new id. Anything
 * that pointed at the old id — nothing does today, but say it plainly rather
 * than promise more than we deliver.
 */
export function undoFailedLine(label: string): string {
  return `Couldn't put ${label} back. It may need adding again by hand.`;
}
