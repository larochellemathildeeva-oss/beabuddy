/**
 * How long a stop is meant to take, as a choice rather than a typed number.
 *
 * A pick-list rather than a number field because the answer is always
 * rough — nobody plans a 47-minute museum — and a list cannot produce a
 * value the database refuses (1 to 44 640 minutes, see the stop-progress
 * migration).
 */

export const PLANNED_STAY_MIN = 1;
export const PLANNED_STAY_MAX = 44_640;

export const STAY_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240, 360] as const;

/** "45 min", "1 h", "1 h 30 min". */
export function stayLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * The choices to offer, keeping a value set some other way. A row that
 * already says 50 minutes should not have its answer silently replaced by
 * the nearest option just because someone opened the editor.
 */
export function stayChoices(current: number | null | undefined): number[] {
  const out: number[] = [...STAY_CHOICES];
  if (current != null && isPlannedStay(current) && !out.includes(current)) {
    out.push(current);
    out.sort((a, b) => a - b);
  }
  return out;
}

export function isPlannedStay(value: number): boolean {
  return Number.isInteger(value) && value >= PLANNED_STAY_MIN && value <= PLANNED_STAY_MAX;
}

/** A `<select>` value back into a column value: a stay, or null for none. */
export function parseStayChoice(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return isPlannedStay(n) ? n : null;
}
