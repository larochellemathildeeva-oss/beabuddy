/**
 * Which city labels actually fit on the globe.
 *
 * Labels used to be drawn for the first N pins in projection order with no
 * regard for each other, so Toronto and Montreal printed on top of one another
 * as "TcMontreal" and Porto sat inside Lisbon. A label that cannot be read is
 * worse than no label: it damages the one underneath it too.
 */

export type LabelCandidate = {
  id: string;
  city: string;
  /** Projected pin position, in SVG units. */
  x: number;
  y: number;
};

type Rect = { left: number; right: number; top: number; bottom: number };

/** Roughly how wide 11px semibold text runs, per character. */
const CHAR_WIDTH = 5.4;
const LINE_HEIGHT = 11;
/** Labels sit up and to the right of their pin. */
const OFFSET_X = 7;
const OFFSET_Y = -6;
/** Breathing room so two labels are not merely touching. */
const PAD = 2;

function labelRect(candidate: LabelCandidate): Rect {
  const width = Math.max(candidate.city.length, 1) * CHAR_WIDTH;
  const left = candidate.x + OFFSET_X - PAD;
  const bottom = candidate.y + OFFSET_Y + PAD;
  return {
    left,
    right: left + width + PAD * 2,
    top: bottom - LINE_HEIGHT - PAD * 2,
    bottom,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

/**
 * Greedy left-to-right placement: keep a label only when its box is clear of
 * every label already kept.
 *
 * Deliberately not clever. A solver that nudges labels around would place more
 * of them, but a label that has drifted away from its own pin is a different
 * kind of wrong — and on a globe you can rotate, the honest fix for a hidden
 * name is to turn the globe.
 */
export function placeCityLabels(
  candidates: LabelCandidate[],
  options: { max?: number } = {},
): LabelCandidate[] {
  const max = options.max ?? 12;
  if (max <= 0) return [];

  const seen = new Set<string>();
  const unique: LabelCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.city.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  const kept: LabelCandidate[] = [];
  const rects: Rect[] = [];
  for (const candidate of unique) {
    if (kept.length >= max) break;
    const rect = labelRect(candidate);
    if (rects.some((placed) => overlaps(placed, rect))) continue;
    kept.push(candidate);
    rects.push(rect);
  }
  return kept;
}

/**
 * How many labels are worth attempting at a given zoom.
 *
 * Zoomed out, the pins themselves carry the story — where you have been, in
 * colour. Names only start earning their space once the globe is close enough
 * that they have somewhere to sit.
 */
export function labelBudget(zoom: number): number {
  if (zoom < 1.15) return 6;
  if (zoom < 1.6) return 12;
  return 20;
}
