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
    const detail = item.detail?.trim();
    out.push(`${time ? `${time} ` : ""}${item.title.trim()}${detail ? ` — ${detail}` : ""}`);
  }
  return out.join("\n");
}
