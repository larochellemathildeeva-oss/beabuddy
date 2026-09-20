/**
 * Which stops sit together, for a day you read rather than walk.
 *
 * A day of eleven rows is eleven decisions. But four of those rows are often
 * one decision — they are the same few streets, and you will do them in one
 * go whatever order they are written in. Saying so turns a list into a shape,
 * and it costs nothing: the positions are already stored, and the run is
 * already consecutive on the timeline.
 *
 * Grouped by distance, not by name. The obvious alternative is to read a
 * district out of the address, and it does not survive contact with real
 * addresses — "1038 Canada Place, Vancouver" and "Gastown" and "2 Chome-11-3
 * Meieki, Nakamura Ward" do not have a neighbourhood in the same position, or
 * at all. A name Béa invented for a group of your stops would be wrong often
 * enough to notice, and there is no version of this feature worth that.
 * Distance is a fact she already has.
 */

import { haversine } from "./geo.ts";
import { formatMetres } from "./near.ts";

export type Clusterable = {
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

export type WalkableRun = {
  /** Index into the list handed in, for rendering a label above that row. */
  startIndex: number;
  length: number;
  /** The widest gap inside the run — what "together" actually meant here. */
  spanMetres: number;
};

/** Close enough that the order within the group stops mattering much. */
export const TOGETHER_WITHIN_METRES = 700;

/** Below this it is a pair, and a pair is already legible without a label. */
export const MINIMUM_RUN = 3;

function placed(item: Clusterable): { lat: number; lon: number } | null {
  const { lat, lon } = item;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // 0,0 is where a failed geocode lands, not a stop.
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

/**
 * Runs of consecutive stops that all sit within walking distance of each
 * other, longest-first is not needed — they come back in day order.
 *
 * An unplaced stop ends the run rather than being folded into it. Béa does not
 * know where it is, so she cannot claim it is near anything; quietly including
 * it would make the label a guess in a sentence that reads like a fact.
 *
 * A run covering the whole day is dropped. "These 6 are close together" about
 * all six stops is not a grouping, it is a description of the city, and it
 * takes up a line to say nothing.
 */
export function walkableRuns<T extends Clusterable>(
  items: readonly T[],
  options?: { withinMetres?: number; minimum?: number },
): WalkableRun[] {
  const within = options?.withinMetres ?? TOGETHER_WITHIN_METRES;
  const minimum = options?.minimum ?? MINIMUM_RUN;
  if (items.length < minimum) return [];

  const runs: WalkableRun[] = [];
  let start = 0;

  /** Widest gap between any two in items[from..to], or null if one is unplaced. */
  const spanOf = (from: number, to: number): number | null => {
    let widest = 0;
    for (let i = from; i <= to; i += 1) {
      const a = placed(items[i]!);
      if (!a) return null;
      for (let j = i + 1; j <= to; j += 1) {
        const b = placed(items[j]!);
        if (!b) return null;
        const metres = haversine(a, b);
        if (metres > widest) widest = metres;
      }
    }
    return widest;
  };

  const close = (run: { start: number; end: number }) => {
    const length = run.end - run.start + 1;
    if (length < minimum) return;
    // A run that is the whole day describes the city, not a group of stops.
    if (length === items.length) return;
    const span = spanOf(run.start, run.end);
    if (span === null) return;
    runs.push({ startIndex: run.start, length, spanMetres: span });
  };

  for (let i = 1; i <= items.length; i += 1) {
    // Extending past the end, past an unplaced stop, or past the radius all
    // end the run the same way: whatever we had is what we had.
    const extends_ =
      i < items.length && placed(items[i]!) !== null && (spanOf(start, i) ?? Infinity) <= within;
    if (extends_) continue;
    close({ start, end: i - 1 });
    start = i;
  }

  return runs;
}

/** What to put above the run. Facts only — no invented district names. */
export function walkableRunLabel(run: WalkableRun): string {
  return `${run.length} stops within ${formatMetres(run.spanMetres)} of each other`;
}

/** Label by the row it belongs above, for rendering inside an existing list. */
export function runLabelsByIndex(runs: readonly WalkableRun[]): Map<number, string> {
  return new Map(runs.map((run) => [run.startIndex, walkableRunLabel(run)]));
}
