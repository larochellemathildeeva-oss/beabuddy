import { foldAccents } from "./fuzzy.ts";
import { haversine } from "./geo.ts";

/** The Nominatim fields we need to turn a hit into a short place label. */
export type NominatimHitLike = {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  type?: string;
  addresstype?: string;
  /** Nominatim jsonv2. LocationIQ's `json` uses `class` instead. */
  category?: string;
  /** LocationIQ / Nominatim `json` — same idea as `category`. */
  class?: string;
  importance?: number;
  address?: Record<string, string>;
  /** OSM's free-form tags. Only `brand` is read; present when `extratags=1`. */
  extratags?: Record<string, string>;
};

const LOCALITY_KEYS = [
  "city",
  "town",
  "village",
  "hamlet",
  "suburb",
  "neighbourhood",
  "municipality",
] as const;

const ADMIN_KEYS = ["state", "province"] as const;

const LOCALITY_TYPES = new Set([
  "city",
  "town",
  "village",
  "hamlet",
  "municipality",
  "suburb",
  "neighbourhood",
  "quarter",
  "isolated_dwelling",
  "island",
]);

const ADMIN_TYPES = new Set([
  "state_district",
  "county",
  "state",
  "region",
  "country",
  "continent",
  "administrative",
  "boundary",
  "municipality",
]);

const JUNK_LABEL =
  /administrative region|urban agglomeration|census (?:area|division)|metropolitan area|regional (?:district|municipality|county)|arrondissement|comunità montana/i;

const NEAR_DUP_METRES = 50_000;
const COLLISION_IMPORTANCE_GAP = 0.12;

function kindOf(hit: NominatimHitLike): string {
  return hit.addresstype || hit.type || "";
}

/** LocationIQ speaks `class`; Nominatim jsonv2 speaks `category`. Same field. */
export function hitCategory(hit: Pick<NominatimHitLike, "category" | "class">): string {
  return (hit.category || hit.class || "").toLowerCase();
}

function isJunkLabel(value: string | undefined): boolean {
  return Boolean(value && JUNK_LABEL.test(value));
}

function addressField(
  address: Record<string, string> | undefined,
  key: string,
): string | undefined {
  const value = address?.[key];
  return value || undefined;
}

export function localityName(address: Record<string, string> | undefined): string | undefined {
  if (!address) return undefined;
  for (const key of LOCALITY_KEYS) {
    const value = address[key];
    if (value && !isJunkLabel(value)) return value;
  }
  return undefined;
}

export function adminName(address: Record<string, string> | undefined): string | undefined {
  if (!address) return undefined;
  for (const key of ADMIN_KEYS) {
    const value = address[key];
    if (value && !isJunkLabel(value)) return value;
  }
  return undefined;
}

function cleanName(name: string | undefined): string {
  if (!name) return "";
  return name
    .replace(/\s*\((?:administrative region|urban agglomeration)\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueParts(parts: (string | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;
    const folded = foldAccents(value);
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(value);
  }
  return out;
}

export function formatPlaceLine(hit: NominatimHitLike): string {
  const address = hit.address ?? {};
  const local = localityName(address) || cleanName(hit.name) || addressField(address, "country");
  const admin = adminName(address);
  const country = addressField(address, "country");
  return uniqueParts([local, admin, country]).join(", ");
}

export function isLocalityHit(hit: NominatimHitLike): boolean {
  const kind = kindOf(hit);
  if (LOCALITY_TYPES.has(kind)) return true;
  if (LOCALITY_TYPES.has(hit.type ?? "")) return true;
  const local = localityName(hit.address);
  const name = cleanName(hit.name);
  return Boolean(
    local && name && foldAccents(local) === foldAccents(name) && !isAdminJunkName(hit),
  );
}

function isAdminJunkName(hit: NominatimHitLike): boolean {
  return isJunkLabel(hit.name) || isJunkLabel(hit.display_name?.split(",")[0]);
}

export function queryMentionsHit(query: string, hit: NominatimHitLike): boolean {
  const needle = foldAccents(query);
  if (!needle) return false;
  const address = hit.address ?? {};
  const hints = ["country", "state", "province", "county", "state_district"]
    .map((key) => addressField(address, key))
    .filter((value): value is string => Boolean(value && foldAccents(value).length >= 3));
  return hints.some((hint) => needle.includes(foldAccents(hint)));
}

function isCountryHit(hit: NominatimHitLike): boolean {
  return kindOf(hit) === "country";
}

function isAdminRegion(hit: NominatimHitLike, query: string): boolean {
  if (isCountryHit(hit) && queryMentionsHit(query, hit)) return false;
  if (
    queryMentionsHit(query, hit) &&
    /administrative|agglomeration|region|county|province/i.test(query)
  ) {
    return false;
  }
  if (isAdminJunkName(hit)) return true;
  const kind = kindOf(hit);
  if (LOCALITY_TYPES.has(kind)) return false;
  return ADMIN_TYPES.has(kind) && !localityName(hit.address);
}

function rankScore(hit: NominatimHitLike, query: string): number {
  let score = (hit.importance ?? 0) * 10;
  const kind = kindOf(hit);
  if (kind === "city" || kind === "town" || kind === "municipality") score += 3;
  else if (kind === "village" || kind === "hamlet") score += 1;
  else if (ADMIN_TYPES.has(kind) && !LOCALITY_TYPES.has(kind)) score -= 4;

  const title = foldAccents(localityName(hit.address) || cleanName(hit.name));
  const needle = foldAccents(query);
  if (title && needle) {
    if (title === needle) score += 2;
    else if (title.startsWith(needle)) score += 1;
  }
  if (queryMentionsHit(query, hit)) score += 8;
  return score;
}

function coords(hit: NominatimHitLike): { lat: number; lon: number } | undefined {
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  return { lat, lon };
}

function sameCity(a: NominatimHitLike, b: NominatimHitLike): boolean {
  const aLocal = foldAccents(localityName(a.address) || cleanName(a.name));
  const bLocal = foldAccents(localityName(b.address) || cleanName(b.name));
  if (!aLocal || aLocal !== bLocal) return false;
  const aCountry = foldAccents(addressField(a.address, "country") ?? "");
  const bCountry = foldAccents(addressField(b.address, "country") ?? "");
  if (aCountry && bCountry && aCountry !== bCountry) return false;
  const aAdmin = foldAccents(adminName(a.address) ?? "");
  const bAdmin = foldAccents(adminName(b.address) ?? "");
  if (aAdmin && bAdmin && aAdmin !== bAdmin) return false;
  const aPos = coords(a);
  const bPos = coords(b);
  if (aPos && bPos) return haversine(aPos, bPos) < NEAR_DUP_METRES;
  return true;
}

function dedupeNearDuplicates(hits: NominatimHitLike[]): NominatimHitLike[] {
  const out: NominatimHitLike[] = [];
  for (const hit of hits) {
    if (!out.some((kept) => sameCity(kept, hit))) out.push(hit);
  }
  return out;
}

function isFarNameCollision(hit: NominatimHitLike, top: NominatimHitLike, query: string): boolean {
  if (queryMentionsHit(query, hit)) return false;
  const a = foldAccents(localityName(hit.address) || cleanName(hit.name));
  const b = foldAccents(localityName(top.address) || cleanName(top.name));
  if (!a || a !== b) return false;
  const aCountry = foldAccents(addressField(hit.address, "country") ?? "");
  const bCountry = foldAccents(addressField(top.address, "country") ?? "");
  if (!aCountry || !bCountry || aCountry === bCountry) return false;
  const gap = (top.importance ?? 0) - (hit.importance ?? 0);
  const topKind = kindOf(top);
  const hitKind = kindOf(hit);
  const topIsCity = topKind === "city" || topKind === "town";
  const hitIsVillage = hitKind === "village" || hitKind === "hamlet";
  return gap >= COLLISION_IMPORTANCE_GAP || (topIsCity && hitIsVillage);
}

function dropFarCollisions(hits: NominatimHitLike[], query: string): NominatimHitLike[] {
  const top = hits[0];
  if (!top) return hits;
  return hits.filter((hit, index) => index === 0 || !isFarNameCollision(hit, top, query));
}

/** Drop admin blobs, near-duplicates and weaker name-collisions, then rank cities first. */
export function refineNominatimHits(hits: NominatimHitLike[], query: string): NominatimHitLike[] {
  const usable = hits.filter((hit) => !isAdminRegion(hit, query));
  const source = usable.length ? usable : [...hits];
  const ranked = [...source].sort((a, b) => rankScore(b, query) - rankScore(a, query));
  return dropFarCollisions(dedupeNearDuplicates(ranked), query);
}

export function placeFromNominatim(hit: NominatimHitLike): {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  /** Nominatim's `type` — "cafe", "hotel", "aerodrome". The addresstype in
   *  `category` is often just "amenity", which says nothing useful. */
  placeType?: string;
  lat: number;
  lon: number;
} {
  const address = hit.address ?? {};
  const line = formatPlaceLine(hit);
  const local = localityName(address);
  const kind = kindOf(hit);
  // A branch mapped with no name of its own — common for a franchise point
  // that carries only `brand=Subway` — must not fall straight to the city:
  // that is how a real, in-stock Subway read as a search that found nothing
  // but "Montreal." The brand is the name this point actually has.
  const ownName = cleanName(hit.name) || cleanName(hit.extratags?.["brand"]);
  const rawName = ownName || local || line || "Saved place";
  const name = isLocalityHit(hit) ? local || rawName : rawName || local || "Saved place";
  const city = local ?? (isLocalityHit(hit) ? name : undefined);
  const country = addressField(address, "country");
  return {
    name,
    ...(line ? { address: line } : {}),
    ...(city ? { city } : {}),
    ...(country ? { country } : {}),
    ...(kind ? { category: kind.replace(/_/g, " ") } : {}),
    ...(hit.type ? { placeType: hit.type } : {}),
    lat: Number(hit.lat),
    lon: Number(hit.lon),
  };
}

/**
 * A shop / cafe / museum beats a street that happens to share the name.
 *
 * "harvey" near Montreal hits Rue Harvey (highway) before Harvey's
 * (amenity). Treating the street as "enough" meant the restaurant was never
 * tried under its real possessive spelling.
 */
export function isVenueHit(hit: Pick<NominatimHitLike, "category" | "class" | "type">): boolean {
  const category = hitCategory(hit);
  return (
    category === "amenity" ||
    category === "shop" ||
    category === "tourism" ||
    category === "craft" ||
    category === "office" ||
    category === "healthcare" ||
    (category === "leisure" && hit.type !== "park")
  );
}

/** City field value + hidden country after a geocoder pick. */
export function locationFromParsedPlace(place: {
  name: string;
  address?: string;
  city?: string;
  country?: string;
}): { city: string; country: string } {
  return {
    city: place.address || [place.city, place.country].filter(Boolean).join(", ") || place.name,
    country: place.country ?? "",
  };
}

/** Show city + country without repeating a country already in the city line. */
export function formatTripLocation(city?: string | null, country?: string | null): string {
  const local = city?.trim() ?? "";
  const nation = country?.trim() ?? "";
  if (!local) return nation;
  if (!nation) return local;
  if (foldAccents(local).includes(foldAccents(nation))) return local;
  return `${local}, ${nation}`;
}

/** Title + optional subtitle for the suggestion dropdown. */
export function placeSuggestionLines(place: { name: string; address?: string }): {
  title: string;
  subtitle?: string;
} {
  if (place.address) {
    const address = foldAccents(place.address);
    const name = foldAccents(place.name);
    if (!name || address === name || address.startsWith(name)) {
      return { title: place.address };
    }
    return { title: place.name, subtitle: place.address };
  }
  return { title: place.name };
}

/**
 * The patch that moves a saved row to a picked place.
 *
 * Editing an itinerary entry's place is not the same as creating one: the
 * title is the user's own words ("dinner with Marie") and a geocoder pick
 * should not overwrite it. Only where the entry is — the address and the
 * point — changes, and a pick without coordinates still writes the address,
 * because a written address is better than none while the map waits.
 */
export function placePatchForSavedRow(place: {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
}): { address: string; lat: number | null; lon: number | null } {
  const line = place.address || [place.city, place.country].filter(Boolean).join(", ");
  return {
    address: line || place.name,
    lat: place.lat ?? null,
    lon: place.lon ?? null,
  };
}
