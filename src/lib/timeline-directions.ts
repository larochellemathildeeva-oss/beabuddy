import type { RouteLeg, RouteStep } from "./directions.functions.ts";
import { hasCoords, isSavedDirectionItem, type DirectionStop } from "./direction-stops.ts";
import { modeFromWord, modeWord } from "./travel-mode.ts";

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
  return `${modeWord(leg.mode)} to ${leg.to}`;
}

/**
 * A row's title for matching, with a saved journey's mode taken off: asked
 * again by transit, yesterday's "Walk to Hotel" is updated into "Transit to
 * Hotel" rather than left beside it. Any other title is only lower-cased.
 */
export function directionTitleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/^(walk|drive|transit) to /, "to ");
}

/** Google Maps / goo.gl maps links older builds appended to Transport detail. */
const EMBEDDED_MAPS_URL_SOURCE = String.raw`https?:\/\/(?:(?:www\.)?google\.[^/\s]+\/maps\S*|maps\.google\.\S*|maps\.app\.goo\.gl\S*|goo\.gl\/maps\S*)`;

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
    return [modeWord(leg.mode), prettyDistance(leg.distance), prettyDuration(leg.duration)].join(
      " · ",
    );
  }
  if (leg.sameSpot) return "Same place — no walk";
  if (leg.capped) return "Open in maps for this stretch";
  if (leg.unknownSpot) return "Exact spot unknown — open in maps";
  return "Open in maps";
}

export function unroutedLegCopy(
  leg: Pick<RouteLeg, "capped" | "unknownSpot" | "sameSpot">,
): string {
  if (leg.sameSpot) return "Same place — no walk";
  if (leg.capped) return "Turn-by-turn paused here — open in maps for this stretch";
  if (leg.unknownSpot) return "Exact spot unknown — open in maps to search it";
  return "Open in maps for this stretch";
}

/**
 * A saved or earlier-worked-out journey that still describes the stops. One
 * marked "Exact spot unknown" while a stop had no pin is out of date once both
 * stops are on the map: kept, it went on saying the spot was unknown after it
 * was found.
 */
export function savedLegStillFits<L extends Pick<RouteLeg, "unknownSpot">>(
  leg: L | undefined,
  from: { lat?: number | null; lon?: number | null },
  to: { lat?: number | null; lon?: number | null },
): L | undefined {
  if (leg?.unknownSpot && hasCoords(from) && hasCoords(to)) return undefined;
  return leg;
}

/** How a saved row's summary names the stop it leaves from. */
const FROM_MARK = " · from ";

/**
 * The stop a saved walk or drive leaves from, read off its summary line, or
 * "" for rows saved before it was kept (they name only where they go).
 */
export function directionSource(detail: string | null | undefined): string {
  const head = (detail ?? "").split("\n")[0] ?? "";
  const at = head.indexOf(FROM_MARK);
  return at < 0 ? "" : head.slice(at + FROM_MARK.length).trim();
}

/** Longest a saved row's turn-by-turn list gets; Maps has the rest. */
const MAX_SAVED_STEPS = 40;

/**
 * What a saved walk or drive keeps: the summary line, then one line per
 * turn — "Turn left onto Shijo-dori · 350 m". Kept in the row's detail so
 * the steps are there on any phone, with no new column to migrate.
 */
export function directionDetailWithSteps(
  leg: Pick<
    RouteLeg,
    "mode" | "distance" | "duration" | "capped" | "unknownSpot" | "sameSpot" | "steps"
  >,
  /** The stop it leaves from, kept on the summary line so the row knows its journey. */
  source?: string,
): string {
  const steps = (leg.steps ?? [])
    .map((step) => ({ ...step, instruction: step.instruction.replace(/\s+/g, " ").trim() }))
    .filter((step) => step.instruction)
    .slice(0, MAX_SAVED_STEPS)
    .map(
      (step) =>
        `${step.instruction}${step.distance > 0 ? ` · ${prettyDistance(Math.round(step.distance))}` : ""}`,
    );
  const from = source?.replace(/\s+/g, " ").trim();
  return [`${directionDetail(leg)}${from ? `${FROM_MARK}${from}` : ""}`, ...steps].join("\n");
}

/** "350 m" or "1.2 km" back into metres. */
function metresFrom(text: string): number {
  const m = /(\d+(?:\.\d+)?)\s*(km|m)\b/i.exec(text);
  if (!m) return 0;
  const value = Number(m[1]);
  return Math.round(m[2]!.toLowerCase() === "km" ? value * 1000 : value);
}

/** "1 h 5 min" or "15 min" back into seconds. */
function secondsFrom(text: string): number {
  const m = /(?:(\d+)\s*h\s*)?(\d+)\s*min\b/i.exec(text);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 60 + Number(m[2])) * 60;
}

/**
 * A saved "Walk to X" / "Drive to X" / "Transit to X" row read back as a leg, so the
 * timeline draws it as the travel between two stops — with its steps
 * folded away — instead of as one more stop. Null for any other row.
 */
export function legFromDirectionRow(row: {
  title: string;
  detail?: string | null;
  lat?: number | null;
  lon?: number | null;
}): RouteLeg | null {
  const m = /^(walk|drive|transit) to (.+)$/i.exec(row.title.trim());
  if (!m) return null;
  const [head = "", ...lines] = (row.detail ?? "").split("\n").map((line) => line.trim());
  const source = directionSource(head);
  const summary = stripEmbeddedMapsUrl(source ? head.slice(0, head.indexOf(FROM_MARK)) : head);
  const steps: RouteStep[] = lines.filter(Boolean).map((line) => {
    const cut = line.lastIndexOf(" · ");
    const tail = cut >= 0 ? line.slice(cut + 3) : "";
    const distance = tail ? metresFrom(tail) : 0;
    return { instruction: distance ? line.slice(0, cut) : line, distance };
  });
  // "Walk · 1.2 km · 15 min": the summary names distance and time; a
  // "Same place" or "Open in maps" line names neither.
  const measured = /·/.test(summary);
  const leg: RouteLeg = {
    from: source,
    to: m[2]!.trim(),
    mode: modeFromWord(m[1]!) ?? "driving",
    distance: measured ? metresFrom(summary) : 0,
    duration: measured ? secondsFrom(summary) : 0,
    steps,
    mapUrl: "",
  };
  if (/^same place/i.test(summary)) leg.sameSpot = true;
  if (/exact spot unknown/i.test(summary)) leg.unknownSpot = true;
  if (/^open in maps for this stretch/i.test(summary)) leg.capped = true;
  if (row.lat != null && row.lon != null) {
    leg.toLat = row.lat;
    leg.toLon = row.lon;
  }
  return leg;
}

/**
 * Where a saved walk or drive leads: the day, the stop it arrives at and, for
 * rows that keep it, the stop it leaves from. Without `from` it is the key of
 * a row saved before sources were kept, which names only where it goes.
 */
export function directionKey(
  day: string | null | undefined,
  title: string,
  from?: string | null,
): string {
  const to = `${day ?? ""}|${title.trim().toLowerCase()}`;
  return from == null ? to : `${to}|from:${from.trim().toLowerCase()}`;
}

/**
 * The timeline split in two: the stops, and the saved walks and drives
 * between them, keyed by the day and stop each one arrives at. "Add to
 * timeline" used to put every leg on the list as a stop of its own, so a
 * day of six stops read as eleven.
 */
export function splitDirectionRows<
  T extends {
    title: string;
    kind?: string | null;
    day_date?: string | null;
    detail?: string | null;
    lat?: number | null;
    lon?: number | null;
  },
>(items: readonly T[]): { stops: T[]; travel: Map<string, RouteLeg> } {
  const stops: T[] = [];
  const travel = new Map<string, RouteLeg>();
  for (const item of items) {
    const leg = isSavedDirectionItem(item) ? legFromDirectionRow(item) : null;
    if (!leg) {
      stops.push(item);
      continue;
    }
    const key = directionKey(item.day_date, leg.to, leg.from || null);
    if (!travel.has(key)) travel.set(key, leg);
  }
  return { stops, travel };
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
      detail: directionDetailWithSteps(leg, from?.title),
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

export type PlacedTimelineStop = { id: string; lat: number; lon: number };

/**
 * Coordinates the router worked out for stops that had none.
 *
 * Building directions geocodes every stop — that is how it knows a drive is
 * 27.5 km — and then the app threw the answers away. The trip map sat above
 * the directions saying none of these stops has a location yet, while the
 * directions underneath it plainly knew where all of them were, and every
 * Refresh paid for the same lookups again at a second apiece.
 *
 * Leg `i` runs from stop `i` to stop `i + 1`, so each leg carries both ends.
 * Only stops that arrived without a position are returned: a coordinate the
 * user picked themselves is never overwritten by a geocoder's guess.
 */
export function placedFromLegs(
  legs: readonly Pick<RouteLeg, "fromLat" | "fromLon" | "toLat" | "toLon">[],
  stops: readonly DirectionStop[],
): PlacedTimelineStop[] {
  const found = new Map<string, PlacedTimelineStop>();

  const offer = (stop: DirectionStop | undefined, lat?: number, lon?: number) => {
    if (!stop?.id || typeof lat !== "number" || typeof lon !== "number") return;
    if (stop.lat != null && stop.lon != null) return;
    if (found.has(stop.id)) return;
    found.set(stop.id, { id: stop.id, lat, lon });
  };

  legs.forEach((leg, i) => {
    offer(stops[i], leg.fromLat, leg.fromLon);
    offer(stops[i + 1], leg.toLat, leg.toLon);
  });

  return [...found.values()];
}
