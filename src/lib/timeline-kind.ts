/**
 * What kind of thing a timeline entry is, for the glyph on the spine.
 *
 * A day used to read as a paragraph of similar-looking lines. One icon per
 * entry turns it into something you scan — and since the kinds are already
 * stored, this costs nothing in the database.
 */

export type TimelineGlyph =
  "meal" | "lodging" | "transport" | "sight" | "walk" | "note" | "activity";

/** Stored kinds vary by where an entry came from: typed, imported, or AI. */
const BY_KIND: Record<string, TimelineGlyph> = {
  meal: "meal",
  food: "meal",
  restaurant: "meal",
  breakfast: "meal",
  lunch: "meal",
  dinner: "meal",
  drinks: "meal",
  coffee: "meal",
  lodging: "lodging",
  hotel: "lodging",
  stay: "lodging",
  accommodation: "lodging",
  transport: "transport",
  flight: "transport",
  train: "transport",
  drive: "transport",
  transfer: "transport",
  sight: "sight",
  museum: "sight",
  landmark: "sight",
  attraction: "sight",
  walk: "walk",
  hike: "walk",
  stroll: "walk",
  note: "note",
  reminder: "note",
  activity: "activity",
};

/**
 * Béa writes its own directions rows as "Walk to X" / "Drive to X", so those
 * read as movement even when the stored kind is something blander.
 */
const TITLE_HINTS: [RegExp, TimelineGlyph][] = [
  [/^walk to /i, "walk"],
  [/^drive to /i, "transport"],
  [/^(fly|flight) /i, "transport"],
  [/\bcheck[- ]?in\b/i, "lodging"],
];

export function timelineGlyph(item: {
  kind?: string | null;
  title?: string | null;
}): TimelineGlyph {
  const title = (item.title ?? "").trim();
  for (const [pattern, glyph] of TITLE_HINTS) {
    if (pattern.test(title)) return glyph;
  }
  const kind = (item.kind ?? "").trim().toLowerCase();
  return BY_KIND[kind] ?? "activity";
}

/** Spoken label, for screen readers and for the entry's own caption. */
export function glyphLabel(glyph: TimelineGlyph): string {
  const labels: Record<TimelineGlyph, string> = {
    meal: "Meal",
    lodging: "Stay",
    transport: "Travel",
    sight: "Sight",
    walk: "Walk",
    note: "Note",
    activity: "Activity",
  };
  return labels[glyph];
}

/** "08:30" out of whatever got typed, or "" when there is no time to show. */
export function timeForRail(timeLabel: string | null | undefined): string {
  const text = (timeLabel ?? "").trim();
  if (!text) return "";
  const m = /(\d{1,2})[:h.](\d{2})\s*(am|pm)?/i.exec(text);
  if (m) {
    let hour = Number(m[1]);
    const mins = m[2]!;
    const suffix = m[3]?.toLowerCase();
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${mins}`;
  }
  const bare = /^(\d{1,2})\s*(am|pm)$/i.exec(text);
  if (bare) {
    let hour = Number(bare[1]);
    const suffix = bare[2]!.toLowerCase();
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:00`;
  }
  // "Morning", "After lunch" — real information, just not a clock time.
  return text.length <= 9 ? text : text.slice(0, 8).trimEnd() + "…";
}
