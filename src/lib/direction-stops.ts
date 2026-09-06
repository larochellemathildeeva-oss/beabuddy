export type DirectionStop = {
  title: string;
  day_date?: string | null;
  time_label?: string | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
};

type CityStop = {
  city: string;
  place_name?: string | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  arrive_on?: string | null;
};

type TimelineItem = {
  title: string;
  kind?: string | null;
  day_date?: string | null;
  time_label?: string | null;
  address?: string | null;
  detail?: string | null;
  lat?: number | null;
  lon?: number | null;
};

/** Walk/Drive rows Béa already saved from Get directions — skip them on the next lookup. */
export function isSavedDirectionItem(item: { kind?: string | null; title?: string | null }): boolean {
  return /^(walk|drive) to /i.test((item.title ?? "").trim());
}

export function looksLikeStreetAddress(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return /^\d+[a-z]?\s+\S+/i.test(text);
}

/**
 * Planner items stash the venue or street in `detail` ("1038 Canada Place, Vancouver; suggest…")
 * and leave `address` / coords empty. Pull the first clause when it looks like a place.
 */
export function placeHintFromDetail(detail?: string | null): string | null {
  if (!detail?.trim()) return null;
  const first = detail
    .split(/[;·|]|\bsuggest\b/i)[0]!
    .replace(/\s+/g, " ")
    .trim();
  if (first.length < 4 || first.length > 180) return null;
  if (looksLikeStreetAddress(first)) return first;
  if (/^(browse|explore|suggest|book|reserve|enjoy|visit|walk|stroll|head|take|grab)\b/i.test(first)) {
    return null;
  }
  if (/\b(including|flagships)\b/i.test(first)) return null;
  if (/^[A-Z0-9À-ÖØ-öø-ÿ]/.test(first) && first.split(/\s+/).length <= 12) return first;
  return null;
}

export function addressForStop(item: { address?: string | null; detail?: string | null }): string | null {
  const stored = item.address?.trim();
  if (stored) return stored;
  return placeHintFromDetail(item.detail);
}

export function hasCoords(
  point?: { lat?: number | null; lon?: number | null } | null,
): point is { lat: number; lon: number } {
  return (
    typeof point?.lat === "number" &&
    typeof point?.lon === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    (point.lat !== 0 || point.lon !== 0)
  );
}

function mapsPoint(
  name: string,
  point: { lat?: number | null; lon?: number | null } | null | undefined,
  area: string,
): string {
  if (hasCoords(point)) return `${point.lat},${point.lon}`;
  const region = area.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
  const query = region ? `${name}, ${region}` : name;
  return encodeURIComponent(query);
}

export function mapsDirUrl(
  from: { title: string; lat?: number | null; lon?: number | null },
  to: { title: string; lat?: number | null; lon?: number | null },
  area: string,
  mode: "walking" | "driving" = "walking",
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${mapsPoint(from.title, from, area)}&destination=${mapsPoint(to.title, to, area)}&travelmode=${mode}`;
}

export function asDirectionStop(item: TimelineItem): DirectionStop {
  const address = addressForStop(item);
  const stop: DirectionStop = { title: item.title.trim() };
  if (item.day_date) stop.day_date = item.day_date;
  if (item.time_label) stop.time_label = item.time_label;
  if (address) stop.address = address;
  if (item.lat != null) stop.lat = item.lat;
  if (item.lon != null) stop.lon = item.lon;
  return stop;
}

/** Timeline activities only — ignore Walk/Drive rows we already added. */
export function timelineStopsForDirections(items: TimelineItem[]): DirectionStop[] {
  return items.filter((item) => item.title.trim() && !isSavedDirectionItem(item)).map(asDirectionStop);
}

/** Cities when the trip has a route; otherwise the timeline. */
export function stopsForDirections(cities: CityStop[], items: TimelineItem[]): DirectionStop[] {
  if (cities.length >= 2) {
    return cities.map((stop) => {
      const title = (stop.place_name || stop.city).trim() || stop.city;
      const next: DirectionStop = { title };
      if (stop.arrive_on) next.day_date = stop.arrive_on;
      if (stop.address?.trim()) next.address = stop.address.trim();
      if (stop.lat != null) next.lat = stop.lat;
      if (stop.lon != null) next.lon = stop.lon;
      return next;
    });
  }
  return timelineStopsForDirections(items);
}
