/**
 * Telling a plan someone already has from a plan they want made.
 *
 * These are different jobs and the panel offers both, but it opens on the one
 * that invents things, with a big text box underneath. So the natural move —
 * paste the itinerary you already wrote and press the button — asks Béa to
 * imagine a trip rather than read the one in front of her. She then obliges:
 * in build mode the instructions tell her to use realistic opening patterns
 * and travel times, and the rule about never inventing times that are not in
 * the source applies only to import. The times come back wrong because that
 * is precisely what was asked for.
 *
 * Nobody should have to know that. A finished itinerary looks nothing like a
 * request, and the difference is visible in the text itself: an itinerary has
 * clock times and numbered days, and a request has wishes. So look, and say
 * so — rather than leaving it to a segmented control the person did not know
 * was load-bearing.
 */

const CLOCK = /\b([01]?\d|2[0-3])[:h][0-5]\d\b|\b(1[0-2]|0?[1-9])\s*(am|pm)\b/gi;
const DAY_MARKER = /\bday\s*\d|\bdays?\s+(one|two|three|four|five)\b|^\s*day\b/gim;
const DATE_MARKER =
  /\b\d{4}-\d{2}-\d{2}\b|\b(mon|tues?|wed(nes)?|thur?s?|fri|sat(ur)?|sun)(day)?\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/gi;

function countOf(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

export type PlanShape = {
  /** Clock times found: "9:00 AM", "13:00", "7h30". */
  times: number;
  /** "Day 1", a weekday, a date. */
  days: number;
  /** True when this reads as a plan that already exists. */
  existing: boolean;
};

/**
 * Does this text read as an itinerary rather than a request?
 *
 * Deliberately conservative. Guessing "import" for someone describing the
 * trip they want is a worse mistake than missing an itinerary, because the
 * first silently refuses to plan and the second is the behaviour they already
 * have. So it wants real structure: either several clock times, or several
 * day markers, or one of each — and enough text that a stray "9pm" in a
 * sentence cannot carry it.
 */
export function readPlanShape(text: string): PlanShape {
  const body = text.trim();
  if (body.length < 80) return { times: 0, days: 0, existing: false };

  const times = countOf(body, CLOCK);
  const days = countOf(body, DAY_MARKER) + countOf(body, DATE_MARKER);
  const existing = times >= 3 || days >= 3 || (times >= 1 && days >= 1);
  return { times, days, existing };
}

/** One line saying what Béa noticed, or null when she noticed nothing. */
export function pastedPlanNote(shape: PlanShape): string | null {
  if (!shape.existing) return null;
  if (shape.times > 0 && shape.days > 0) {
    return `This looks like a plan you already have — Béa can see ${shape.times} time${
      shape.times === 1 ? "" : "s"
    } and days in it.`;
  }
  if (shape.times > 0) {
    return `This looks like a plan you already have — Béa can see ${shape.times} times in it.`;
  }
  return "This looks like a plan you already have — Béa can see the days in it.";
}
