/**
 * "Notes from Béa" on World and Home: one or two lines in Béa's voice, made
 * from the traveller's own numbers, never invented. Béa speaks of herself in
 * the third person and uses no emoji (`bea-voice.ts`).
 */

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function worldNote(stats: {
  cities: number;
  countries: number;
  continents: number;
  bucket: number;
}): string {
  if (stats.cities === 0 && stats.countries === 0) {
    return stats.bucket > 0
      ? `${count(stats.bucket, "place is", "places are")} waiting on the bucket list. Béa will colour the globe once you've been.`
      : "Add the first city you've been to, and Béa starts colouring the globe.";
  }
  const where =
    stats.cities > 0
      ? `${count(stats.cities, "city", "cities")} across ${count(stats.countries, "country", "countries")}`
      : count(stats.countries, "country", "countries");
  const reach = stats.continents > 1 ? ` on ${stats.continents} of 7 continents` : "";
  const next =
    stats.bucket > 0
      ? ` ${count(stats.bucket, "place is", "places are")} still waiting on the bucket list.`
      : " Béa keeps count.";
  return `${where}${reach} so far.${next}`;
}

export function tripNote(trip: {
  /** Days until the trip starts; 0 or less once it has. */
  daysUntil: number;
  /** Day of the trip, from 1, while it is under way. */
  day: number | null;
  days: number | null;
  todosOpen: number;
  /** Packing done, 0–100, when there is a list. */
  packedPct: number | null;
  /** The next stop's name and when, while under way. */
  next: { title: string; when: string } | null;
}): string {
  if (trip.day !== null) {
    const day = trip.days ? `Day ${trip.day} of ${trip.days}.` : `Day ${trip.day}.`;
    return trip.next
      ? `${day} Next up: ${trip.next.title}, ${trip.next.when}.`
      : `${day} Nothing else is planned today, so the rest of it is yours.`;
  }
  const lead =
    trip.daysUntil <= 1
      ? "The trip starts tomorrow."
      : `${count(trip.daysUntil, "day", "days")} to go.`;
  if (trip.todosOpen > 0)
    return `${lead} ${count(trip.todosOpen, "to-do is", "to-dos are")} still open, and Béa is keeping them in view.`;
  if (trip.packedPct !== null && trip.packedPct < 100)
    return `${lead} Packing is ${trip.packedPct}% done.`;
  return `${lead} Everything Béa knows about is ready.`;
}
