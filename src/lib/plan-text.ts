/**
 * A plan read from a file, written back out as plain lines.
 *
 * Compare takes each plan as text. When a side is uploaded instead of pasted,
 * the file is read first and its stops become the lines below, grouped by
 * day, so the box shows what Béa read and can still be edited.
 */
export type PlanTextItem = {
  day_date?: string | null;
  day_number?: number | null;
  time_label?: string | null;
  title: string;
  detail?: string | null;
  /** Where it is, as a calendar's LOCATION or the reader pulled it out. */
  place?: string | null | undefined;
  address?: string | null | undefined;
};

export function planAsText(items: readonly PlanTextItem[]): string {
  const out: string[] = [];
  let day = "";
  for (const item of items) {
    const heading = item.day_date
      ? item.day_date
      : item.day_number != null
        ? `Day ${item.day_number}`
        : "";
    if (heading && heading !== day) {
      if (out.length) out.push("");
      out.push(heading);
      day = heading;
    }
    const time = item.time_label?.trim();
    const title = item.title.trim();
    const detail = item.detail?.trim() ?? "";
    // The place and its address, each unless something before it already says it.
    const said = `${title} ${detail}`;
    const place = item.place?.trim() ?? "";
    const address = item.address?.trim() ?? "";
    const parts = place && address && mentions(address, place) ? [address] : [place, address];
    const where = parts.filter((part) => part && !mentions(said, part)).join(", ");
    const notes = [detail, where ? `at ${where}` : ""].filter(Boolean).join(" · ");
    out.push(`${time ? `${time} ` : ""}${title}${notes ? ` — ${notes}` : ""}`);
  }
  return out.join("\n");
}

/** Whether `text` says `words` as whole words: "Dinner" does not say "Inn". */
function mentions(text: string, words: string): boolean {
  const escaped = words.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(
    text.toLowerCase(),
  );
}
