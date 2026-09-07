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

/** Google Maps / goo.gl maps links older builds appended to Transport detail. */
const EMBEDDED_MAPS_URL_SOURCE =
  String.raw`https?:\/\/(?:(?:www\.)?google\.[^/\s]+\/maps\S*|maps\.google\.\S*|maps\.app\.goo\.gl\S*|goo\.gl\/maps\S*)`;

/**
 * Drop raw maps URLs that older builds saved into Transport detail text.
 * The timeline already has an "Open in maps" control — the URL must not
 * sit in the note line (it overflows the phone and reads like junk).
 * Ordinary https links (hotel booking, etc.) are left alone.
 */
export function stripEmbeddedMapsUrl(detail: string | null | undefined): string {
  if (!detail) return "";
  return detail
    .replace(new RegExp(`\\s*·\\s*(?:${EMBEDDED_MAPS_URL_SOURCE})`, "gi"), "")
    .replace(new RegExp(EMBEDDED_MAPS_URL_SOURCE, "gi"), "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*·\s*$/g, "")
    .trim();
}

/**
 * While the traveller is editing a detail field, keep their draft even if a
 * realtime row refresh arrives with a different sanitized value.
 */
export function syncDetailDraft(
  focused: boolean,
  localDraft: string,
  remoteDetail: string | null | undefined,
): string {
  return focused ? localDraft : stripEmbeddedMapsUrl(remoteDetail);
}

export function directionDetail(
  leg: Pick<RouteLeg, "mode" | "distance" | "duration" | "capped" | "unknownSpot" | "sameSpot">,
): string {
  if (leg.distance > 0) {
    return [
      leg.mode === "walking" ? "Walk" : "Drive",
      prettyDistance(leg.distance),
      prettyDuration(leg.duration),
    ].join(" · ");
  }
  if (leg.sameSpot) return "Same place — no walk";
  if (leg.capped) return "Open in maps for this stretch";
  if (leg.unknownSpot) return "Exact spot unknown — open in maps";
  return "Open in maps";
}

export function unroutedLegCopy(leg: Pick<RouteLeg, "capped" | "unknownSpot" | "sameSpot">): string {
  if (leg.sameSpot) return "Same place — no walk";
  if (leg.capped) return "Turn-by-turn paused here — open in maps for this stretch";
  if (leg.unknownSpot) return "Exact spot unknown — open in maps to search it";
  return "Open in maps for this stretch";
}

/** Turn looked-up legs into timeline Transport rows. Callers upsert by title. */
export function legsToTimelineItems(
  legs: RouteLeg[],
  stops: DirectionStop[],
  _existingTitles: string[] = [],
): TimelineDirectionItem[] {
  return legs.flatMap((leg, i) => {
    const from = stops[i];
    const to = stops[i + 1];
    const title = directionTitle(leg);
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
