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

export type InsideEntry = {
  title: string;
  done: boolean;
  /** Where it is, when known: a stall's own street address, opened in Maps from the list. */
  address?: string;
  /** What it is for: "dashimaki tamago". */
  note?: string;
};

/** At most this many entries, as the migration's check allows. */
export const INSIDE_MAX = 40;
/**
 * The migration also caps the stored list at 16 KiB. Kept well under it, as
 * the JSON's UTF-8 length, since the database's own measure of a jsonb value
 * is not the same count.
 */
export const INSIDE_BYTES_MAX = 12_000;

/** How much room a list takes, as the check sees it (roughly). */
export function insideBytes(entries: readonly InsideEntry[]): number {
  return new TextEncoder().encode(JSON.stringify(entries)).length;
}
const TITLE_MAX = 200;
/** The longest note or address an entry keeps. */
export const INSIDE_EXTRA_MAX = 200;
const EXTRA_MAX = INSIDE_EXTRA_MAX;

/** An optional text field of an entry, cleaned, or nothing. */
function extra(raw: unknown, key: "address" | "note"): string | undefined {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim().slice(0, EXTRA_MAX);
  return clean || undefined;
}

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
    const address = extra(raw, "address");
    const note = extra(raw, "note");
    const entry: InsideEntry = {
      title: clean,
      done: Boolean((raw as { done?: unknown })?.done),
      ...(address ? { address } : {}),
      ...(note ? { note } : {}),
    };
    // A list the database would refuse is cut where it would stop fitting.
    if (insideBytes([...out, entry]) > INSIDE_BYTES_MAX) break;
    out.push(entry);
    if (out.length >= INSIDE_MAX) break;
  }
  return out;
}

/**
 * Marks in the note form, never typed by hand: ‹…› around a note, ⟨…⟩
 * around an address. Two pairs, so no note can read back as an address.
 */
const NOTE_OPEN = "‹";
const NOTE_CLOSE = "›";
const ADDRESS_OPEN = "⟨";
const ADDRESS_CLOSE = "⟩";
const MARKS = /[‹›⟨⟩]/g;

/**
 * A piece of text safe inside the note form: without its marks, and without
 * " · ", which separates the notes of a stop.
 */
function forNote(text: string): string {
  return text
    .replace(MARKS, "")
    .replace(/\s+·\s+/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One entry as the detailed form writes it: "Miki Keiran ‹dashimaki› ⟨182 Higashiuoyacho⟩". */
function entryText(entry: InsideEntry): string {
  // A semicolon separates detailed entries, so none may stay inside one.
  const safe = (text: string) => forNote(text).replace(/;/g, ",");
  const parts = [safe(entry.title)];
  if (entry.note) parts.push(`${NOTE_OPEN}${safe(entry.note)}${NOTE_CLOSE}`);
  if (entry.address) parts.push(`${ADDRESS_OPEN}${safe(entry.address)}${ADDRESS_CLOSE}`);
  return parts.join(" ");
}

/**
 * The list after "Inside: ", back as entries. A plain list ("A, B") is split
 * on commas, as it always was. The detailed form, marked by ‹ or ⟨, is split
 * on semicolons, since an address or a name has commas of its own.
 */
export function readInsideText(text: string): InsideEntry[] {
  const detailed = text.includes(NOTE_OPEN) || text.includes(ADDRESS_OPEN);
  if (!detailed) return readInside(text.split(", "));
  return readInside(
    text.split(/;\s*/).map((piece) => {
      const marks = [piece.indexOf(NOTE_OPEN), piece.indexOf(ADDRESS_OPEN)].filter((i) => i >= 0);
      const title = marks.length ? piece.slice(0, Math.min(...marks)) : piece;
      const note = piece.match(/‹([^›]*)›/)?.[1]?.trim();
      const address = piece.match(/⟨([^⟩]*)⟩/)?.[1]?.trim();
      return { title, done: false, ...(note ? { note } : {}), ...(address ? { address } : {}) };
    }),
  );
}

/**
 * The note form of a list: "A, B" while every entry is a plain name that a
 * comma cannot split; otherwise the detailed form, "A ‹…› ⟨…⟩; B". A list
 * whose names need it but that carries no details is marked by an empty ‹›
 * on its first entry, so it is read back the same way.
 */
export function insideText(entries: readonly InsideEntry[]): string {
  const plain = entries.every((e) => !e.note && !e.address && !/,\s|;/.test(forNote(e.title)));
  if (plain) return entries.map((e) => forNote(e.title)).join(", ");
  const parts = entries.map(entryText);
  if (!parts.some((p) => p.includes(NOTE_OPEN) || p.includes(ADDRESS_OPEN)) && parts.length) {
    parts[0] = `${parts[0]} ${NOTE_OPEN}${NOTE_CLOSE}`;
  }
  return parts.join("; ");
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
      inside.push(...readInsideText(note.slice("Inside: ".length)));
    } else {
      rest.push(note);
    }
  }
  return { detail: rest.length ? rest.join(" · ") : null, inside: inside.slice(0, INSIDE_MAX) };
}

/** Entries as the note form, for a database without the column. */
export function insideNote(entries: readonly InsideEntry[]): string | null {
  return entries.length ? `Inside: ${insideText(entries)}` : null;
}

export function toggleInside(entries: readonly InsideEntry[], index: number): InsideEntry[] {
  return entries.map((e, i) => (i === index ? { ...e, done: !e.done } : e));
}

/**
 * Added at the end, with its note and address when given, unless it is
 * already there or the list is full.
 */
export function addInside(
  entries: readonly InsideEntry[],
  title: string,
  details: { note?: string | undefined; address?: string | undefined } = {},
): InsideEntry[] {
  const [entry] = readInside([{ title, done: false, ...details }]);
  if (!entry || entries.length >= INSIDE_MAX) return [...entries];
  const at = entries.findIndex((e) => e.title.toLowerCase() === entry.title.toLowerCase());
  // Already listed: what it did not know yet (a note, an address) is added.
  const next =
    at < 0
      ? [...entries, entry]
      : entries.map((e, i) =>
          i === at
            ? {
                ...e,
                ...(!e.note && entry.note ? { note: entry.note } : {}),
                ...(!e.address && entry.address ? { address: entry.address } : {}),
              }
            : e,
        );
  return insideBytes(next) > INSIDE_BYTES_MAX ? [...entries] : next;
}

/** Whether an entry with these details would still fit the list. */
export function insideHasRoom(
  entries: readonly InsideEntry[],
  title: string,
  details: { note?: string | undefined; address?: string | undefined } = {},
): boolean {
  if (entries.length >= INSIDE_MAX) return false;
  const [entry] = readInside([{ title, done: false, ...details }]);
  return !entry || insideBytes([...entries, entry]) <= INSIDE_BYTES_MAX;
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
