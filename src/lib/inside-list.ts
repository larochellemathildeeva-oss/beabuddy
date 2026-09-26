/**
 * What to see inside a stop: the galleries of a museum, the monuments of a
 * park, ticked off during the visit.
 *
 * Stored on the stop as `inside` (jsonb, see the itinerary_nesting
 * migration). Until that migration is applied the list lives in the stop's
 * note as "Inside: A, B" — which is also how the import writes it before
 * saving — so both forms are read here and turned into each other.
 *
 * Pure, so every edit is tested without a database.
 */

export type InsideEntry = { title: string; done: boolean };

/** At most this many entries, as the migration's check allows. */
export const INSIDE_MAX = 40;
const TITLE_MAX = 200;

/**
 * The column's value as entries, forgiving anything malformed: a row saved
 * by hand, or by an older app, should show what it can rather than nothing.
 */
export function readInside(value: unknown): InsideEntry[] {
  if (!Array.isArray(value)) return [];
  const out: InsideEntry[] = [];
  for (const raw of value) {
    const title =
      typeof raw === "string"
        ? raw
        : raw && typeof raw === "object" && typeof (raw as { title?: unknown }).title === "string"
          ? (raw as { title: string }).title
          : "";
    const clean = title.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
    if (!clean) continue;
    out.push({ title: clean, done: Boolean((raw as { done?: unknown })?.done) });
    if (out.length >= INSIDE_MAX) break;
  }
  return out;
}

/**
 * The "Inside: A, B" note taken out of a stop's note, as entries, with the
 * rest of the note kept as it was. The import writes the list this way; the
 * save moves it into its own column.
 */
export function splitInsideNote(detail: string | null | undefined): {
  detail: string | null;
  inside: InsideEntry[];
} {
  const notes = (detail ?? "").split(" · ").filter((n) => n.trim());
  const inside: InsideEntry[] = [];
  const rest: string[] = [];
  for (const note of notes) {
    if (note.startsWith("Inside: ")) {
      inside.push(...readInside(note.slice("Inside: ".length).split(", ")));
    } else {
      rest.push(note);
    }
  }
  return { detail: rest.length ? rest.join(" · ") : null, inside: inside.slice(0, INSIDE_MAX) };
}

/** Entries as the note form, for a database without the column. */
export function insideNote(entries: readonly InsideEntry[]): string | null {
  return entries.length ? `Inside: ${entries.map((e) => e.title).join(", ")}` : null;
}

export function toggleInside(entries: readonly InsideEntry[], index: number): InsideEntry[] {
  return entries.map((e, i) => (i === index ? { ...e, done: !e.done } : e));
}

/** Added at the end, unless it is already there or the list is full. */
export function addInside(entries: readonly InsideEntry[], title: string): InsideEntry[] {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
  if (!clean || entries.length >= INSIDE_MAX) return [...entries];
  if (entries.some((e) => e.title.toLowerCase() === clean.toLowerCase())) return [...entries];
  return [...entries, { title: clean, done: false }];
}

export function removeInside(entries: readonly InsideEntry[], index: number): InsideEntry[] {
  return entries.filter((_, i) => i !== index);
}

/**
 * The pill's words: "2 inside", "2 stops", "2 inside · 2 stops", or null
 * when there is nothing nested.
 */
export function nestPillLabel(insideCount: number, stopCount: number): string | null {
  const parts = [
    insideCount > 0 ? `${insideCount} inside` : "",
    stopCount > 0 ? `${stopCount} ${stopCount === 1 ? "stop" : "stops"}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
