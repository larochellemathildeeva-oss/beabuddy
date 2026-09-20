/**
 * Reading a place out of a map URL.
 *
 * A shared Google Maps link is a short link that redirects to the canonical
 * place URL, and that resolved URL is where the useful data lives:
 *
 *   https://www.google.com/maps/place/Eiffel+Tower,+Av.+Gustave+Eiffel,+75007+Paris
 *     /@48.8582,2.2944,17z/data=!3m1!4b1!4m6!3m5!1s0x…!8m2!3d48.8583!4d2.2944
 *
 * Three things matter and all three used to be missed:
 *
 * 1. `!3d…!4d…` is the pin. `@lat,lng,17z` is only the map viewport centre,
 *    which can sit a street away, so the pin wins when both are present.
 * 2. The coordinates of a *place* URL are the place's, whether they were in
 *    what you pasted or only appeared after the redirect. Only a bare `@` on
 *    a non-place URL is a viewport we should not trust.
 * 3. The path name often carries the street address after the first comma.
 */

export type PlaceCoords = { lat: number; lon: number };

const NUM = String.raw`-?\d+(?:\.\d+)?`;

function coords(lat: string | undefined, lon: string | undefined): PlaceCoords | undefined {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  // 0,0 is the null island every broken geocoder lands on.
  if (latitude === 0 && longitude === 0) return undefined;
  return { lat: latitude, lon: longitude };
}

/** True when the URL names a specific place rather than a map view. */
export function isPlaceUrl(url: string): boolean {
  return /\/maps\/place\//i.test(url) || /\/place\//i.test(url);
}

/**
 * Coordinates that identify a place: the Google pin, an explicit query
 * parameter, or the `@` pair on a `/place/` URL. Never a bare viewport.
 */
export function placeCoordsFromUrl(url: string): PlaceCoords | undefined {
  // The pin, most precise of the three.
  const pin = new RegExp(String.raw`!3d(${NUM})!4d(${NUM})`).exec(url);
  const fromPin = coords(pin?.[1], pin?.[2]);
  if (fromPin) return fromPin;

  try {
    const u = new URL(url);
    const param =
      u.searchParams.get("ll") ||
      u.searchParams.get("coordinate") ||
      u.searchParams.get("daddr") ||
      u.searchParams.get("query") ||
      u.searchParams.get("q");
    const m = param ? new RegExp(String.raw`^(${NUM})\s*,\s*(${NUM})$`).exec(param.trim()) : null;
    const fromParam = coords(m?.[1], m?.[2]);
    if (fromParam) return fromParam;
  } catch {
    /* not a parseable URL — fall through */
  }

  if (isPlaceUrl(url)) {
    const at = new RegExp(String.raw`@(${NUM}),(${NUM})`).exec(url);
    const fromAt = coords(at?.[1], at?.[2]);
    if (fromAt) return fromAt;
  }
  return undefined;
}

/** The `@lat,lng` viewport centre — a fallback, not a place. */
export function viewportCoordsFromUrl(url: string): PlaceCoords | undefined {
  const at = new RegExp(String.raw`@(${NUM}),(${NUM})`).exec(url);
  return coords(at?.[1], at?.[2]);
}

/**
 * Pick the coordinates for a pasted link and the URL it resolved to.
 *
 * Place coordinates are taken from either URL — a short link carries none, so
 * refusing to read the resolved one meant every shared Google Maps link came
 * back with no point on the map at all. A viewport centre is still only
 * trusted from what was actually pasted.
 */
export function resolvePlaceCoords(
  pastedUrl: string,
  finalUrl: string,
  hasPlaceName: boolean,
): PlaceCoords | undefined {
  return (
    placeCoordsFromUrl(pastedUrl) ??
    placeCoordsFromUrl(finalUrl) ??
    viewportCoordsFromUrl(pastedUrl) ??
    (hasPlaceName ? undefined : viewportCoordsFromUrl(finalUrl))
  );
}

/** The raw `/place/<this>/` segment, decoded, or "" when there is none. */
export function placePathSegment(url: string): string {
  const m = /\/place\/([^/@?#]+)/.exec(url);
  if (!m?.[1]) return "";
  try {
    return decodeURIComponent(m[1]).replace(/\+/g, " ").trim();
  } catch {
    return m[1].replace(/\+/g, " ").trim();
  }
}

/**
 * The `?q=` text on an older-style Google Maps link that carries no
 * `/place/` segment at all — `maps.google.com/?q=Name,+Address&ftid=…`, one
 * of the shapes Google's own share sheet still generates. `q=` on this shape
 * is "Name, Address" in the same one-field blob `/place/` puts in its path,
 * so it goes through the same split. A bare "q=lat,lon" is a different,
 * already-handled case (`placeCoordsFromUrl`'s query-param check) — this
 * only reads `q` when it is not that.
 */
export function googleQueryPlaceText(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (host !== "google.com" && !host.endsWith(".google.com")) return "";
  const q = parsed.searchParams.get("q");
  if (!q) return "";
  const trimmed = q.trim();
  if (new RegExp(String.raw`^${NUM}\s*,\s*${NUM}$`).test(trimmed)) return "";
  return trimmed;
}

/** Does this look like a street address rather than more of the name? */
function looksLikeAddress(parts: string[]): boolean {
  if (parts.length === 0) return false;
  // A house number, a postcode, or simply enough comma-separated parts to be
  // "street, city, country" rather than "Bar Raval, Toronto".
  return parts.some((part) => /\d/.test(part)) || parts.length >= 2;
}

/**
 * Split "Eiffel Tower, Av. Gustave Eiffel, 75007 Paris, France" into a name
 * and an address. Google puts both in one path segment; keeping the whole
 * blob as the name gave a rec called "Eiffel Tower, Av. Gustave Eiffel,
 * 75007 Paris, France" and no address at all.
 */
export function splitPlacePathName(raw: string): { name: string; address?: string } {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { name: "" };
  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const [first, ...rest] = parts;
  if (!first) return { name: "" };
  if (rest.length === 0 || !looksLikeAddress(rest)) return { name: text };
  return { name: first, address: rest.join(", ") };
}

/** Strip the map site's own branding off a page title. */
export function cleanPageTitle(rawTitle: string): string {
  const head = rawTitle.split(/ [·|—–-] /)[0] ?? "";
  const cleaned = head
    .replace(/\s*-\s*Google Maps$/i, "")
    .replace(/\s*[·|—–-]\s*Apple Maps$/i, "")
    .trim();
  if (/^(google|apple)\s*maps$/i.test(cleaned)) return "";
  if (/^(google maps|apple maps|openstreetmap|yelp|tripadvisor)$/i.test(cleaned)) return "";
  return cleaned;
}
