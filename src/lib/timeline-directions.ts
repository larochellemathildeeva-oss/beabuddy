import type { RouteLeg } from "./directions.functions.ts";
import type { DirectionStop } from "./direction-stops.ts";

export type { DirectionStop } from "./direction-stops.ts";

function prettyDistance(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function prettyDuration(s: number) {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export type TimelineDirectionItem = {
  day_date?: string;
  time_label?: string;
  kind: "Transport";
  title: string;
  detail: string;
  address?: string;
  lat?: number;
  lon?: number;
};

export function directionTitle(leg: Pick<RouteLeg, "mode" | "to">): string {
  return `${leg.mode === "walking" ? "Walk" : "Drive"} to ${leg.to}`;
}

export function directionDetail(
  leg: Pick<RouteLeg, "mode" | "distance" | "duration" | "mapUrl" | "capped" | "unknownSpot" | "sameSpot">,
): string {
  const parts: string[] = [];
  if (leg.distance > 0) {
    parts.push(leg.mode === "walking" ? "Walk" : "Drive");
    parts.push(prettyDistance(leg.distance));
    parts.push(prettyDuration(leg.duration));
  } else if (leg.sameSpot) {
    parts.push("Same place — no walk");
  } else if (leg.capped) {
    parts.push("Open in maps for this stretch");
  } else if (leg.unknownSpot) {
    parts.push("Exact spot unknown — open in maps");
  } else {
    parts.push("Open in maps");
  }
  if (leg.mapUrl) parts.push(leg.mapUrl);
  return parts.join(" · ");
}

export function unroutedLegCopy(leg: Pick<RouteLeg, "capped" | "unknownSpot" | "sameSpot">): string {
  if (leg.sameSpot) return "Same place — no walk";
  if (leg.capped) return "Turn-by-turn paused here — open in maps for this stretch";
  if (leg.unknownSpot) return "Exact spot unknown — open in maps to search it";
  return "Open in maps for this stretch";
}

function alreadyOnTimeline(title: string, existing: string[]): boolean {
  const key = title.trim().toLowerCase();
  return existing.some((item) => item.trim().toLowerCase() === key);
}

/** Turn looked-up legs into timeline Transport rows, skipping ones already saved. */
export function legsToTimelineItems(
  legs: RouteLeg[],
  stops: DirectionStop[],
  existingTitles: string[] = [],
): TimelineDirectionItem[] {
  return legs.flatMap((leg, i) => {
    const from = stops[i];
    const to = stops[i + 1];
    const title = directionTitle(leg);
    if (alreadyOnTimeline(title, existingTitles)) return [];
    const item: TimelineDirectionItem = {
      kind: "Transport",
      title,
      detail: directionDetail(leg),
    };
    if (from?.day_date) item.day_date = from.day_date;
    if (from?.time_label) item.time_label = from.time_label;
    const address = to?.address ?? from?.address;
    if (address) item.address = address;
    const lat = leg.toLat ?? to?.lat ?? undefined;
    const lon = leg.toLon ?? to?.lon ?? undefined;
    if (lat != null) item.lat = lat;
    if (lon != null) item.lon = lon;
    return [item];
  });
}
