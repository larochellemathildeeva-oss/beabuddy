/**
 * Stops grouped by the part of town they are in, for the Timeline Editor's
 * Neighbourhood view: which of the day's stops share an area, so a day can be
 * read as "the Peace Park stops, then Miyajima".
 *
 * The area comes from the stop's saved address — the last part that names a
 * place rather than a street number or a postcode: "1-2 Nakajimacho, Naka
 * Ward" is Naka Ward, "Miyajima Omotesando" is itself. A stop with no address
 * is grouped under "No place yet", which says what would fix it.
 */
export const NO_AREA = "No place yet";

export function areaOf(address: string | null | undefined): string {
  const parts = (address ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    // Not a postcode, a house number or a country code.
    .filter((p) => !/^[\d\s-]+$/.test(p) && !/^[A-Z]{1,2}\d/.test(p) && p.length > 1);
  if (parts.length === 0) return NO_AREA;
  const last = parts[parts.length - 1]!;
  // "1-2 Nakajimacho" alone: the street name without its number.
  return last.replace(/^[\d-]+\s+/, "");
}

export type AreaGroup<T> = { area: string; items: T[] };

/** In the order the areas first appear in the day; stops keep their order. */
export function groupByArea<T extends { address: string | null }>(
  items: readonly T[],
): AreaGroup<T>[] {
  const groups: AreaGroup<T>[] = [];
  for (const item of items) {
    const area = areaOf(item.address);
    let group = groups.find((g) => g.area === area);
    if (!group) {
      group = { area, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  // Unplaced stops last: they belong to no area yet.
  return [...groups.filter((g) => g.area !== NO_AREA), ...groups.filter((g) => g.area === NO_AREA)];
}
