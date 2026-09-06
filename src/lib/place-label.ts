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
  category?: string;
  importance?: number;
  address?: Record<string, string>;
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

function isJunkLabel(value: string | undefined): boolean {
  return Boolean(value && JUNK_LABEL.test(value));
}

function addressField(address: Record<string, string> | undefined, key: string): string | undefined {
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
  return name.replace(/\s*\((?:administrative region|urban agglomeration)\)\s*/gi, " ").replace(/\s+/g, " ").trim();
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
  return Boolean(local && name && foldAccents(local) === foldAccents(name) && !isAdminJunkName(hit));
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

function isAdminRegion(hit: NominatimHitLike, query: string): boolean {
  if (queryMentionsHit(query, hit) && /administrative|agglomeration|region|county|province/i.test(query)) {
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
  lat: number;
  lon: number;
} {
  const address = hit.address ?? {};
  const line = formatPlaceLine(hit);
  const local = localityName(address);
  const kind = kindOf(hit);
  const rawName = cleanName(hit.name) || local || line || "Saved place";
  const name = isLocalityHit(hit) ? local || rawName : rawName || local || "Saved place";
  const city = local ?? (isLocalityHit(hit) ? name : undefined);
  const country = addressField(address, "country");
  return {
    name,
    ...(line ? { address: line } : {}),
    ...(city ? { city } : {}),
    ...(country ? { country } : {}),
    ...(kind ? { category: kind.replace(/_/g, " ") } : {}),
    lat: Number(hit.lat),
    lon: Number(hit.lon),
  };
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
