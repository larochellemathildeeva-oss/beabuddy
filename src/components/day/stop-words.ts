import type { RouteLeg } from "@/lib/directions.functions";
import { dayDistance } from "@/lib/day-map";
import { formatMetres } from "@/lib/geo";
import { placeArtFor, placeArtUrl } from "@/lib/place-art";
import { placed as hasPosition } from "@/lib/trip-map";

/**
 * The words and classes the day views share (Companion, Map, Timeline), kept
 * apart from the components in `stop-bits.tsx`.
 */

/** The painted picture for a stop, from its kind and name. */
export function stopArtUrl(item: { kind?: string | null; title?: string | null }): string {
  return placeArtUrl(placeArtFor({ category: item.kind, kind: item.kind, name: item.title }));
}

/** The numbered disc: a different accent per stop in Colorful. */
export function seqClass(number: number): string {
  return `seq-${((Math.max(1, number) - 1) % 5) + 1}`;
}

/** A measured leg, as the master says it: "9 min walk · 426 m". */
export function legWords(leg: Pick<RouteLeg, "mode" | "duration" | "distance" | "estimated">): {
  walking: boolean;
  time: string;
  distance: string;
} {
  const minutes = Math.max(1, Math.round(leg.duration / 60));
  const time =
    minutes < 60
      ? `${minutes} min`
      : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  return {
    walking: leg.mode === "walking",
    time: `${leg.estimated ? "~" : ""}${time}`,
    distance: formatMetres(leg.distance),
  };
}

/** A leg is worth a number only when it was measured. */
export function measured(leg: RouteLeg | null | undefined): leg is RouteLeg {
  return Boolean(leg && leg.distance > 0 && leg.duration > 0 && !leg.farApartKm);
}

/** "Day 1 · Thu, Oct 1" — or the group's own label for an undated pile. */
export function dayTitle(key: string, ordinal: string, label: string): string {
  if (!key) return label;
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return [ordinal, label].filter(Boolean).join(" · ");
  const when = `${date.toLocaleDateString(undefined, { weekday: "short" })}, ${date.toLocaleDateString(
    undefined,
    { month: "short", day: "numeric" },
  )}`;
  return [ordinal, when].filter(Boolean).join(" · ");
}

type Placeable = {
  title: string;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

/**
 * How far a day goes: the measured legs added up when every one is measured,
 * else "about" the straight line between the placed stops. Empty when there
 * is nothing to measure — never a made-up figure.
 */
export function dayLengthLabel<T extends Placeable>(
  items: readonly T[],
  legFor?: ((from: T, to: T) => RouteLeg | null | undefined) | undefined,
): string {
  if (items.length < 2) return "";
  const legs = items.slice(1).map((to, i) => legFor?.(items[i]!, to));
  if (legs.every((leg) => measured(leg))) {
    return formatMetres(legs.reduce((sum, leg) => sum + (leg?.distance ?? 0), 0));
  }
  const metres = dayDistance(items.filter((item) => hasPosition(item)));
  return metres > 0 ? `about ${formatMetres(metres)}` : "";
}
