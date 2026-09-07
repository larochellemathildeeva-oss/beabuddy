import { parseLocalDate } from "./trip-dates.ts";

export type TimelineDayGroup<T extends { day_date: string | null }> = {
  /** YYYY-MM-DD, or "" for undated items. */
  key: string;
  label: string;
  items: T[];
};

/** Pretty heading for a timeline day, e.g. "Sat · Sep 12". */
export function formatTimelineDayLabel(dayDate: string): string {
  const date = parseLocalDate(dayDate);
  if (!date) return dayDate;
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday} · ${monthDay}`;
}

/**
 * Group ordered timeline rows by calendar day, preserving relative order.
 * Undated rows land in a trailing "No date" group.
 */
export function groupTimelineByDay<T extends { day_date: string | null }>(
  items: T[],
): TimelineDayGroup<T>[] {
  const groups: TimelineDayGroup<T>[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const key = item.day_date ?? "";
    const existing = indexByKey.get(key);
    if (existing !== undefined) {
      groups[existing]!.items.push(item);
      continue;
    }
    indexByKey.set(key, groups.length);
    groups.push({
      key,
      label: key ? formatTimelineDayLabel(key) : "No date",
      items: [item],
    });
  }

  // Keep dated days in first-seen order; undated always last.
  const dated = groups.filter((g) => g.key !== "");
  const undated = groups.filter((g) => g.key === "");
  return [...dated, ...undated];
}
