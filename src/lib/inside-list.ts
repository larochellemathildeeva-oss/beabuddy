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
const TITLE_MAX = 200;
const EXTRA_MAX = 200;

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
    out.push({
      title: clean,
      done: Boolean((raw as { done?: unknown })?.done),
      ...(address ? { address } : {}),
      ...(note ? { note } : {}),
    });
    if (out.length >= INSIDE_MAX) break;
  }
  return out;
}

/** Marks around an entry's note and address in the note form: never typed by hand. */
const OPEN = "‹";
const CLOSE = "›";

/** A piece of text safe inside the note form: none of its separators or marks. */
function forNote(text: string): string {
  return text
    .replace(/[‹›]/g, "")
    .replace(/\s+·\s+/g, ", ")
    .replace(/;/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

/** One entry as the note form writes it: "Miki Keiran ‹dashimaki› ‹@ 182 Higashiuoyacho›". */
function entryText(entry: InsideEntry): string {
  const parts = [forNote(entry.title)];
  if (entry.note) parts.push(`${OPEN}${forNote(entry.note)}${CLOSE}`);
  if (entry.address) parts.push(`${OPEN}@ ${forNote(entry.address)}${CLOSE}`);
  return parts.join(" ");
}

/**
 * The list after "Inside: ", back as entries. A plain list ("A, B") is split
 * on commas, as it always was; a list whose entries carry a note or address
 * is split on semicolons, since an address has commas of its own.
 */
export function readInsideText(text: string): InsideEntry[] {
  const detailed = text.includes(OPEN);
  const pieces = text.split(detailed ? /;\s*/ : ", ");
  return readInside(
    pieces.map((piece) => {
      if (!detailed) return piece;
      const at = piece.indexOf(OPEN);
      const title = at < 0 ? piece : piece.slice(0, at);
      let note: string | undefined;
      let address: string | undefined;
      for (const m of piece.matchAll(/‹([^›]*)›/g)) {
        const inner = m[1]!.trim();
        if (inner.startsWith("@")) address = inner.slice(1).trim();
        else note = inner;
      }
      return { title, done: false, ...(note ? { note } : {}), ...(address ? { address } : {}) };
    }),
  );
}

/** The note form of a list: "Inside: A, B", or with details "Inside: A ‹…›; B". */
export function insideText(entries: readonly InsideEntry[]): string {
  const detailed = entries.some((e) => e.note || e.address);
  return entries.map(entryText).join(detailed ? "; " : ", ");
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
  if (entries.some((e) => e.title.toLowerCase() === entry.title.toLowerCase())) return [...entries];
  return [...entries, entry];
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
