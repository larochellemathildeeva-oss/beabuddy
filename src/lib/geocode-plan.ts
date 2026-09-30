/**
 * Turning a planned stop into something safe to look up.
 *
 * Béa's planner returns a title and a detail line and no coordinates, so a
 * stop she adds lands with no position: invisible on the trip map, invisible
 * to Near, and re-looked-up every time you ask for directions.
 *
 * The obvious fix — ask the model for lat/lon — is the one thing not to do.
 * A model will answer confidently and wrongly, and this app already has the
 * scar: "never geocode a bare name", after a Montreal Harvey's was saved in
 * Slovakia. So every query built here is anchored to the trip's area, and a
 * trip with no area gets no lookups at all rather than a guess. A stop that
 * cannot be placed stays blank, which is a stop you can fix by hand, not a
 * pin in the wrong country.
 */

import {
  looksLikeStreetAddress,
  placeHintFromDetail,
  placeQueryCandidates,
} from "./direction-stops.ts";
import { autoPinTrusted, isNoiseWord } from "./match-confidence.ts";
import { japaneseAddressQueries, namesJapan, outsideAddressDistrict } from "./japan-address.ts";

export type PlanStop = {
  title: string;
  detail?: string | null | undefined;
  /** The venue as named on a map, when the parse pulled one out. */
  place?: string | null | undefined;
  /** A street address the source gave, as written. */
  address?: string | null | undefined;
};

/** At most this many lookups per stop, so a long plan stays bounded. */
export const QUERIES_PER_STOP = 3;

/**
 * Ordered queries for one stop, most specific first, each anchored to `area`.
 *
 * No area, no queries: the anchor is the whole safety argument, and a bare
 * venue name is exactly what put a Montreal burger in eastern Europe.
 */
export function planStopQueries(stop: PlanStop, area: string | null | undefined): string[] {
  const where = (area ?? "").trim();
  if (!where) return [];
  const title = stop.title.trim();
  if (!title) return [];

  // Most specific first: the address the source gave, then the venue's own
  // name, then whatever the title and the detail line suggest.
  const address = stop.address?.trim() || placeHintFromDetail(stop.detail ?? null);
  const place = stop.place?.trim() || "";
  // placeQueryCandidates stops at an address when it has one; the venue
  // is still worth its own try in case the address is not on the map.
  // A Japanese block address ("2-3-23 Shinsaibashisuji") as the map reads
  // it: as written, it found an address in Tokyo for an Osaka café.
  const japanese = address ? japaneseAddressQueries(address, namesJapan(where)) : [];
  const code = AIRPORT_CODE.test(place) ? place : null;
  const candidates = [
    // "JFK" alone finds a JFK Boulevard; "JFK Airport" finds the airport.
    ...(code ? [`${code} Airport`] : []),
    ...(japanese.length ? japanese.slice(0, 1) : []),
    ...(!japanese.length && address && looksLikeStreetAddress(address) ? [address] : []),
    ...(place ? placeQueryCandidates(place, null) : []),
    ...placeQueryCandidates(title, japanese.length ? null : address),
    // The chōme alone, last: near enough when the block is not on the map.
    ...japanese.slice(1),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates.length > 0 ? candidates : [title]) {
    const query = `${candidate}, ${where}`;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(query);
    if (out.length >= QUERIES_PER_STOP) break;
  }
  return out;
}

/**
 * Stops worth looking up: titled, and not already placed.
 *
 * Placed means both halves. Half a coordinate is not a location you can draw,
 * measure or route from — it is a stop that still needs finding.
 */
export function stopsNeedingLocation<
  T extends PlanStop & { lat?: number | null; lon?: number | null },
>(stops: readonly T[]): T[] {
  return stops.filter(
    (s) => s.title.trim() && !(typeof s.lat === "number" && typeof s.lon === "number"),
  );
}

/**
 * Roughly how long a batch will take, in seconds.
 *
 * Nominatim's policy is one request a second, so this is mostly waiting. The
 * number is shown to the person rather than hidden, because a silent
 * thirty-second pause reads as a hang.
 */
export function estimatedSeconds(stopCount: number, gapMs: number): number {
  return Math.ceil((stopCount * gapMs) / 1000);
}

/**
 * The trip's area as a box, so a stop can only be placed inside it.
 *
 * Anchoring the query text ("Queue de Castor, Montreal") was not enough: the
 * geocoder treats the city as a hint, and answered with a namesake stand at a
 * water park two hundred kilometres away. Searching bounded to the area's own
 * box, and checking the answer lands in it, turns that into "not found" —
 * which is a stop you fix by hand, not a pin in the wrong town.
 */
export type AreaBox = { south: number; north: number; west: number; east: number };

/** Nominatim and LocationIQ return `boundingbox` as [south, north, west, east] strings. */
export function areaBoxFrom(bbox: readonly (string | number)[] | null | undefined): AreaBox | null {
  if (!bbox || bbox.length !== 4) return null;
  const [south, north, west, east] = bbox.map(Number) as [number, number, number, number];
  if (![south, north, west, east].every(Number.isFinite) || south > north || west > east)
    return null;
  return { south, north, west, east };
}

/**
 * The box with a margin, so a stop just past the city line (an airport, a
 * suburb) still counts. A quarter of the box each way, never less than about
 * ten kilometres, because a city mapped as a point has a box of nothing.
 */
/**
 * A box of about 45 km each way around a point: where to look for a stop
 * when the trip's area is the wrong place (a Hiroshima day on a Kyoto trip)
 * but the stop before it is on the map.
 */
export function boxAround(point: { lat: number; lon: number }, km = 45): AreaBox {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.2, Math.cos((point.lat * Math.PI) / 180)));
  return {
    south: point.lat - dLat,
    north: point.lat + dLat,
    west: point.lon - dLon,
    east: point.lon + dLon,
  };
}

export function widenBox(box: AreaBox, fraction = 0.25, minDeg = 0.1): AreaBox {
  const dLat = Math.max((box.north - box.south) * fraction, minDeg);
  const dLon = Math.max((box.east - box.west) * fraction, minDeg);
  return {
    south: Math.max(-90, box.south - dLat),
    north: Math.min(90, box.north + dLat),
    west: Math.max(-180, box.west - dLon),
    east: Math.min(180, box.east + dLon),
  };
}

/** As the geocoder's `viewbox` parameter: west,north,east,south. */
export function boxViewbox(box: AreaBox): string {
  return [box.west, box.north, box.east, box.south].map((n) => n.toFixed(5)).join(",");
}

export function inBox(box: AreaBox, lat: number, lon: number): boolean {
  return lat >= box.south && lat <= box.north && lon >= box.west && lon <= box.east;
}

const AIRPORT_WORDS =
  /\b(?:airport|aeroporto|aeropuerto|a[ée]roport|flughafen|luchthaven)\b|空港|공항|机场|機場/i;

/** A stop that is an airport, by its name or its place: "Arrive at Kansai International Airport". */
/** "JFK", "LHR": a place written as an airport's three-letter code. */
const AIRPORT_CODE = /^[A-Z]{3}$/;

/**
 * An airport stop answered by an airport: right, whatever it is called. "JFK"
 * never matches "John F. Kennedy International Airport" by name, and Kansai
 * International Airport's pin is labelled by the road it sits on.
 */
export function airportMatch(
  stop: { title: string; place?: string | null | undefined },
  hit: Pick<CandidateHit, "label" | "category" | "kind">,
): boolean {
  return namesAirport(stop) && isAirportHit(hit);
}

export function namesAirport(stop: { title: string; place?: string | null | undefined }): boolean {
  if (AIRPORT_CODE.test(stop.place?.trim() ?? "")) return true;
  // The airport itself, not "Airport Museum" or "Airport Road Market".
  const name = (stop.place?.trim() || stop.title)
    .replace(/\s*[(（][^()（）]*[)）]/g, "")
    .replace(/\s+(?:terminal\s*\w*|t\d)$/i, "")
    .trim();
  return (
    /(?:airport|aeroporto|aeropuerto|a[ée]roport|flughafen|luchthaven|空港|공항|机场|機場)$/i.test(
      name,
    ) || /^(?:aeroporto|aeropuerto|a[ée]roport)\b/i.test(name)
  );
}

/** Words that name nothing but an airport. */
const AIRPORT_ONLY = new Set([
  "airport",
  "aeroporto",
  "aeropuerto",
  "aeroport",
  "flughafen",
  "luchthaven",
  "international",
  "intl",
  "arrive",
  "arrival",
  "arrivals",
  "depart",
  "departure",
  "departures",
  "at",
  "the",
  "from",
  "to",
  "terminal",
]);

/**
 * The words that say which airport: "narita" of "Narita International
 * Airport", "rome" and "fiumicino" of "Rome Fiumicino Airport". None for a
 * code ("JFK"), which the airport's own name rarely carries.
 */
export function airportNameWords(stop: {
  title: string;
  place?: string | null | undefined;
}): string[] {
  const place = stop.place?.trim() ?? "";
  if (AIRPORT_CODE.test(place)) return [];
  return foldArea((place || stop.title).replace(/\s*[(（][^()（）]*[)）]/g, ""))
    .split(" ")
    .filter((word) => word.length > 1 && !AIRPORT_ONLY.has(word) && !/^t?\d+$/.test(word));
}

/** An answer that is an airport, or somewhere in one ("Kansai Airport Station"). */
export function isAirportHit(hit: Pick<CandidateHit, "label" | "category" | "kind">): boolean {
  return (
    hit.category === "aeroway" ||
    hit.kind === "aerodrome" ||
    hit.kind === "terminal" ||
    AIRPORT_WORDS.test(hit.label?.split(",")[0] ?? "")
  );
}

const TRANSIT_WORDS = /\b(?:station|stop|stn|platform|pier|wharf|terminal)\b|駅|停/i;

/** A bus, tram or train stop, or a platform: where you catch something, not the place it is named for. */
function isTransitStop(hit: Pick<CandidateHit, "category" | "kind">): boolean {
  return (
    (hit.category === "highway" && hit.kind === "bus_stop") ||
    (hit.category === "railway" && (hit.kind === "tram_stop" || hit.kind === "platform")) ||
    hit.category === "public_transport"
  );
}

const foldArea = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Of the geocoder's answers for a trip's town, the one named for it. Asked
 * for "Mexico City, Mexico", LocationIQ answers the country first: its box
 * was all of Mexico, and a "Casa Azul" 400 km away was inside it.
 * Null when none is; callers fall back to the first answer.
 */
export function areaHitFor<
  T extends {
    display_name?: string | undefined;
    class?: string | undefined;
    type?: string | undefined;
    namedetails?: Record<string, string> | undefined;
  },
>(hits: readonly T[], where: string): T | null {
  const town = foldArea(where.split(",")[0] ?? "");
  if (!town) return null;
  // By any of its names: LocationIQ calls the city "Cuzco" and the region
  // around it "Cusco", so matching the label alone chose the region, and
  // every stop in town was flagged 126 km from its middle.
  const named = hits.filter((hit) =>
    [(hit.display_name ?? "").split(",")[0] ?? "", ...Object.values(hit.namedetails ?? {})].some(
      (name) => foldArea(name) === town,
    ),
  );
  return named.find(isSettlement) ?? named[0] ?? null;
}

/** A city, town or village, not the region or province of the same name. */
function isSettlement(hit: { class?: string | undefined; type?: string | undefined }): boolean {
  return (
    hit.class === "place" && /^(?:city|town|village|hamlet|municipality)$/.test(hit.type ?? "")
  );
}

/** One answer from the geocoder, as the plan lookup reads it. */
export type CandidateHit = {
  lat: number;
  lon: number;
  label?: string;
  category?: string;
  kind?: string;
  alsoNamed?: string[];
};

/**
 * The answer worth keeping from one lookup, and whether it can be trusted.
 *
 * A geocoder that cannot find a venue often answers with the town instead
 * ("Lençóis Maranhenses National Park, Barreirinhas" → Barreirinhas). Taking
 * the first answer meant that fallback ended the search: it was then judged
 * a whole area, not pinned, and the stop's other queries never ran. So the
 * first answer that plausibly is the stop wins; failing that, the first one
 * inside the box is returned untrusted, for the caller to keep looking.
 */
export function pickHit(
  hits: readonly CandidateHit[],
  box: AreaBox,
  stop: {
    title: string;
    place?: string | null | undefined;
    address?: string | null | undefined;
  },
): { hit: CandidateHit; trusted: boolean } | null {
  // An airport is only ever an airport: "Hotel Kansai" shares a word with
  // Kansai International Airport, and was pinned for it 30 km away.
  const airport = namesAirport(stop);
  // The place before the bus stop named after it ("原爆ドーム前", Atomic Bomb
  // Dome stop): same spot, but not the place, so never trusted for it.
  const stopWanted = TRANSIT_WORDS.test(`${stop.title} ${stop.place ?? ""}`);
  const inside = [...hits]
    .sort((a, b) => (stopWanted ? 0 : Number(isTransitStop(a)) - Number(isTransitStop(b))))
    .filter(
      (hit) =>
        Number.isFinite(hit.lat) &&
        Number.isFinite(hit.lon) &&
        inBox(box, hit.lat, hit.lon) &&
        (!airport || (isAirportHit(hit) && !isTransitStop(hit))),
    );
  // A Japanese address names its district, and so does every label there:
  // a find in another district is a namesake, however well its name matches.
  // An airport named by more than its town must be that one: "Tokyo
  // International Airport" is Haneda, 60 km from Narita.
  const airportName = airport ? airportNameWords(stop) : [];
  const airportScore = (hit: CandidateHit) => {
    const names = [hit.label?.split(",")[0] ?? "", ...(hit.alsoNamed ?? [])].map(foldArea);
    return airportName.filter((word) => names.some((name) => name.includes(word))).length;
  };
  const trustedHits = airport
    ? airportName.length
      ? inside
          .filter((hit) => airportScore(hit) > 0)
          .sort((a, b) => airportScore(b) - airportScore(a))
      : inside
    : inside.filter(
        (hit) => autoPinTrusted(stop, hit) && !outsideAddressDistrict(stop.address, hit.label),
      );
  // Of the answers that pass, the one named for all of the stop over one
  // sharing a word of it: "Geysir Glíma Restaurant", not the souvenir shop
  // "Geysir" in Akureyri. And for an airport, the airport over the hotel
  // named after it.
  const trusted = airport
    ? (trustedHits.find(
        (hit) =>
          hit.category !== "tourism" &&
          (!airportName.length || airportScore(hit) === airportScore(trustedHits[0]!)),
      ) ?? trustedHits[0])
    : (trustedHits.find((hit) => namesAllOf(stop, hit)) ??
      trustedHits.find((hit) => placesWholeAddress(stop.address, hit)) ??
      trustedHits[0]);
  if (trusted) return { hit: trusted, trusted: true };
  return inside[0] ? { hit: inside[0], trusted: false } : null;
}

/**
 * How far out of town a stop may be, in km, when its note says it is a ride
 * away: "getting there: drive, 45 min" puts Þingvellir 40 km from
 * Reykjavík, and Boulders Beach 30 km from Cape Town. Straight-line, about
 * what a road covers at 80 km/h. Null for a walk, the metro or a short hop,
 * which keep a stop in town.
 */
export function outingReachKm(detail: string | null | undefined): number | null {
  const note = (detail ?? "").split(" · ").find((part) => /^getting there\b/i.test(part.trim()));
  if (!note || !/\b(?:drive|driving|car|taxi|bus|coach|train|rail|ferry|boat)\b/i.test(note))
    return null;
  const hours = note.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hrs?|hours?)\b/i);
  const mins = note.match(/(\d+)\s*(?:min|mins|minutes?)\b/i);
  const minutes =
    (hours ? Number(hours[1]!.replace(",", ".")) * 60 : 0) + (mins ? Number(mins[1]) : 0);
  if (minutes < 20) return null;
  return Math.round(minutes * 1.3);
}

/**
 * Every word of a street address in the answer's label, town and all: "84
 * Railway Parade, Leura" is the one in Leura, not the Railway Parade in
 * Katoomba with the same number.
 */
function placesWholeAddress(address: string | null | undefined, hit: CandidateHit): boolean {
  if (!address || !looksLikeStreetAddress(address) || !address.includes(",")) return false;
  const label = foldArea(hit.label ?? "");
  return foldArea(address)
    .split(" ")
    .filter((word) => word.length > 1)
    .every((word) => label.includes(word));
}

/** Every word of the stop's venue (or title) in the answer's own name. */
function namesAllOf(
  stop: { title: string; place?: string | null | undefined },
  hit: CandidateHit,
): boolean {
  const words = foldArea((stop.place?.trim() || stop.title).replace(/\s*[(（][^()（）]*[)）]/g, ""))
    .split(" ")
    .filter((word) => word.length > 1 && !isNoiseWord(word));
  if (words.length < 2) return false;
  const names = [hit.label?.split(",")[0] ?? "", ...(hit.alsoNamed ?? [])].map(foldArea);
  return names.some((name) => words.every((word) => name.includes(word)));
}

/**
 * Stops placed far from where the rest of the trip is, to flag for checking.
 *
 * For pins already saved before the bounded search existed. The middle is the
 * median of the placed stops; a stop counts as far when it is more than
 * `minKm` away and more than four times the typical distance from the middle,
 * so a road trip's stops, all far apart, are not all flagged.
 *
 * A far stop with company is a day trip, not a wrong pin: Hiroshima on a
 * Kyoto trip is 300 km from the middle, but so is the rest of that day. So a
 * stop is not flagged when another stop of the same day (of the trip, for
 * stops with no day) is within `minKm` of it. A wrong pin, a namesake across
 * the country, stands alone.
 */
export function strayStopIds<
  T extends {
    id: string;
    lat: number | null;
    lon: number | null;
    day_date?: string | null | undefined;
  },
>(items: readonly T[], minKm = 50): Set<string> {
  const placed = items.filter(
    (i): i is T & { lat: number; lon: number } => i.lat != null && i.lon != null,
  );
  const out = new Set<string>();
  if (placed.length < 3) return out;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
  };
  const mid = { lat: median(placed.map((p) => p.lat)), lon: median(placed.map((p) => p.lon)) };
  const km = (p: { lat: number; lon: number }) => distanceKm(p, mid);
  const typical = median(placed.map(km));
  const company = (p: (typeof placed)[number]) =>
    placed.some(
      (q) => q !== p && (q.day_date ?? null) === (p.day_date ?? null) && distanceKm(p, q) <= minKm,
    );
  for (const p of placed) {
    const d = km(p);
    if (d > minKm && d > typical * 4 && !company(p)) out.add(p.id);
  }
  return out;
}

/** Straight-line distance between two points, in km. */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((a.lat - b.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((a.lon - b.lon) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

/** Parts of a geocoder's label that say nothing a traveller reads. */
const LABEL_NOISE =
  /^(?:\d[\d\s-]*|.*\b(?:regi[aã]o|microrregi[aã]o|mesorregi[aã]o|region|metropolitana)\b.*)$/i;

/**
 * Where a found place is, short enough for the card: "Mercado Municipal,
 * Rua Barão do Rio Branco, Centro, Barreiras" out of Nominatim's full
 * chain of districts, regions, postcode and country.
 *
 * Saved as the stop's address when the plan gave none, so a pinned stop says
 * where it was pinned — which is also how a wrong one gets noticed.
 */
export function labelAddress(label: string | null | undefined, parts = 4): string | null {
  const kept = (label ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !LABEL_NOISE.test(part))
    .slice(0, parts);
  return kept.length > 0 ? kept.join(", ") : null;
}

const MACRONS: Record<string, string> = {
  ā: "a",
  ē: "e",
  ī: "i",
  ō: "o",
  ū: "u",
  Ā: "A",
  Ē: "E",
  Ī: "I",
  Ō: "O",
  Ū: "U",
};

/**
 * Other ways the map may name a place the plan names in romanised Japanese,
 * tried only when the plan's own name finds nothing that is it: without
 * macrons ("Togetsukyō" → "Togetsukyo"), a shrine or temple by its English
 * word ("Ikuta Jinja" → "Ikuta Shrine", "Kōdai-ji" → "Kodaiji Temple"), a
 * bridge whose name already says bridge ("Togetsukyo Bridge" → "Togetsukyo"),
 * and a slope with its hyphen ("Ninenzaka" → "Ninen-zaka"). At most three,
 * none the same as the name itself. Pure, so it is tested.
 */
export function nameVariants(name: string): string[] {
  const base = name
    .replace(/\s*[(（][^()（）]*[)）]/g, "")
    .replace(/\s*\/.*$/, "")
    .trim();
  if (!base) return [];
  const plain = base.replace(/[āēīōūĀĒĪŌŪ]/g, (c) => MACRONS[c] ?? c);
  const out: string[] = [];
  const add = (v: string) => {
    const t = v.replace(/\s+/g, " ").trim();
    if (
      t &&
      t.toLowerCase() !== base.toLowerCase() &&
      !out.some((o) => o.toLowerCase() === t.toLowerCase())
    )
      out.push(t);
  };
  const shrine = plain.match(/^(.+?)[\s-]*(?:jinja|jingu|jingū|taisha)$/i);
  if (shrine) add(`${shrine[1]} Shrine`);
  const temple = plain.match(/^(.+?)-(?:ji|dera|in)$/i);
  if (temple) add(`${temple[1]}${plain.match(/-(ji|dera|in)$/i)![1]!.toLowerCase()} Temple`);
  const bridge = plain.match(/^(.+?(?:kyo|bashi|hashi))\s+bridge$/i);
  if (bridge) add(bridge[1]!);
  // One word ending in -zaka: "Ninenzaka", "Sannenzaka"; never "Osaka".
  const slope = plain.match(/^(\p{L}{3,}?)(zaka)$/iu);
  if (slope) add(`${slope[1]}-${slope[2]}`);
  add(plain);
  return out.slice(0, 3);
}
