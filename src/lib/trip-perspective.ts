/**
 * Which way you are looking at a trip.
 *
 * The trip page has been one long scroll: the timeline, then the stops, then
 * prep, then the budget, then the map. That shape answers "show me
 * everything", which is the question you ask while writing a plan and almost
 * never the one you ask while travelling.
 *
 * Four perspectives, because a trip is genuinely four different questions:
 *
 *   companion  where am I now, and what is next
 *   map        where are today's stops in relation to each other
 *   timeline   the day as a list, to read and to edit
 *   trip       everything that belongs to the trip rather than to a day —
 *              stops, prep, packing, documents, budget, people
 *
 * The first three are scoped to a day. The fourth is deliberately not: a
 * packing list is not a Tuesday thing. Keeping it as a peer rather than
 * burying it is what stops a day-centric screen from losing half the product.
 */

export const TRIP_PERSPECTIVES = [
  {
    id: "companion",
    label: "Companion",
    hint: "Where you are now, what is next, and when to leave.",
  },
  {
    id: "map",
    label: "Map Split",
    hint: "The day on a map, with the stops beside it.",
  },
  {
    id: "timeline",
    label: "Timeline",
    hint: "The day in order: reorder, retime, add and edit.",
  },
  {
    id: "trip",
    label: "Trip",
    hint: "Stops, to-dos, packing, budget, people and details.",
  },
] as const;

export type TripPerspective = (typeof TRIP_PERSPECTIVES)[number]["id"];

/** Whether a perspective shows one day, or the trip as a whole. */
export function isDayScoped(perspective: TripPerspective): boolean {
  return perspective !== "trip";
}

/**
 * Where to open.
 *
 * On the trip, "Now" is the only view with a right answer, so it wins. Before
 * and after, there is no now — the day list is what you came for, and
 * offering a companion view for a trip that has not started would be a screen
 * with nothing on it.
 */
export function defaultPerspective(isUnderway: boolean): TripPerspective {
  return isUnderway ? "companion" : "timeline";
}

/** Read a perspective out of a URL or storage without trusting it. */
export function asPerspective(raw: unknown): TripPerspective | null {
  const found = TRIP_PERSPECTIVES.find((p) => p.id === raw);
  return found ? found.id : null;
}

/**
 * Is today inside the trip?
 *
 * Undated trips are never underway. A trip with a start and no end is a
 * single day, the same reading `tripTodayView` already uses, so the two
 * screens cannot disagree about whether you are on the trip.
 */
export function tripIsUnderway(
  trip: { start_date?: string | null | undefined; end_date?: string | null | undefined },
  today: string,
): boolean {
  const start = trip.start_date?.trim();
  if (!start) return false;
  const end = trip.end_date?.trim() || start;
  return today >= start && today <= end;
}
