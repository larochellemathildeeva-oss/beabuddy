/**
 * Where tapping a saved rec takes you: the phone's maps app, on that place.
 *
 * A rec saved from a Google Maps link opens that link's place. Otherwise a
 * rec with a pin opens on the pin. One saved without a spot — typed in by
 * hand because the search could not find it — opens a search for its name
 * with its address or city, which the maps app resolves the way a person
 * would. That is what makes saving an unfound place worth doing: it still
 * opens somewhere useful.
 */
import { mapsPlaceUrl } from "./direction-stops.ts";

/** Google's own sites: google.com, google.fr, maps.google.co.jp … */
function isGoogleHost(host: string): boolean {
  return /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host);
}

/** A Google Maps link, read for the one place it names. */
type GooglePlaceRef =
  | { kind: "share"; url: string }
  | { kind: "place"; id: string }
  | { kind: "cid"; cid: string }
  | { kind: "page"; url: string };

function readGoogleLink(url: string | null | undefined): GooglePlaceRef | null {
  if (!url?.trim()) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  // Short share links resolve to the place they were shared from.
  if (
    host === "maps.app.goo.gl" ||
    host === "share.google" ||
    host === "g.page" ||
    (host === "goo.gl" && u.pathname.startsWith("/maps"))
  ) {
    return { kind: "share", url: u.toString() };
  }
  const onMaps = isGoogleHost(host) && (host.startsWith("maps.") || u.pathname.startsWith("/maps"));
  if (!onMaps) return null;
  let path = u.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // A stray "%" in a hand-edited link: read it as it is.
  }
  const whole = path + u.search;
  const placeId =
    u.searchParams.get("query_place_id") ||
    u.searchParams.get("place_id") ||
    /!19s(ChIJ[\w-]+)/.exec(whole)?.[1];
  if (placeId && /^ChIJ[\w-]+$/.test(placeId)) return { kind: "place", id: placeId };
  const cid = u.searchParams.get("cid");
  if (cid && /^\d{1,20}$/.test(cid)) return { kind: "cid", cid: BigInt(cid).toString() };
  const feature =
    /^0x[0-9a-f]+:0x([0-9a-f]{1,16})$/i.exec(u.searchParams.get("ftid") ?? "")?.[1] ??
    /!1s0x[0-9a-f]+:0x([0-9a-f]{1,16})/i.exec(whole)?.[1];
  if (feature) return { kind: "cid", cid: BigInt(`0x${feature}`).toString() };
  return /\/maps\/place\//.test(u.pathname) ? { kind: "page", url: u.toString() } : null;
}

/**
 * The Google Maps link a rec was saved from, as a link to that exact place.
 *
 * A pin and a name can open the wrong café next door, or a search. The link
 * the traveller pasted names the place itself: Google's short share link,
 * a `/maps/place/` page, or one carrying Google's place ID or feature ID.
 * It is the traveller's own link, not an answer from Google's APIs, so it is
 * kept like any other note on the rec and costs nothing to open. A place ID
 * (`ChIJ…`) opens through Maps URLs' documented `query_place_id`; a feature
 * ID (`0x…:0x…`) through its customer ID, the second half in decimal. Null
 * for anything else, including the search links Béa writes itself.
 */
export function googlePlaceLink(url: string | null | undefined, name: string): string | null {
  const ref = readGoogleLink(url);
  if (!ref) return null;
  if (ref.kind === "place") {
    const params = new URLSearchParams({ api: "1", query: name.trim() || "Place" });
    params.set("query_place_id", ref.id);
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }
  if (ref.kind === "cid") return `https://maps.google.com/?cid=${ref.cid}`;
  return ref.url;
}

/**
 * Which Google place a saved link names, as a key two recs can be compared
 * by: "place:ChIJ…" for a place ID, "cid:…" for a customer or feature ID
 * (the same number either way), "link:…" for a short share link. Storing
 * the ID is what Google's terms allow; nothing is asked of Google to get it.
 * A `/maps/place/` page with no ID names no key: its path is a name and a
 * view, and two of them differ for the same place.
 */
export function googlePlaceKey(url: string | null | undefined): string | null {
  const ref = readGoogleLink(url);
  if (!ref || ref.kind === "page") return null;
  if (ref.kind === "place") return `place:${ref.id}`;
  if (ref.kind === "cid") return `cid:${ref.cid}`;
  return `link:${ref.url}`;
}

export function recMapsUrl(rec: {
  name: string;
  address?: string | null | undefined;
  city?: string | null | undefined;
  country?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
  /** The link it was saved from; a Google Maps one opens that exact place. */
  url?: string | null | undefined;
}): string {
  const exact = googlePlaceLink(rec.url, rec.name);
  if (exact) return exact;
  if (rec.lat != null && rec.lon != null) {
    return mapsPlaceUrl(rec.name, { lat: rec.lat, lon: rec.lon }, rec.address);
  }
  const where = rec.address?.trim() || rec.city?.trim() || "";
  const parts = [rec.name.trim(), where, where === rec.address?.trim() ? "" : rec.country?.trim()];
  const query = parts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * A name typed into the search, as a draft: "Mandy's, Montreal" is a name
 * and a city. The city is only taken after a comma, never guessed from the
 * words — "Café Olimpico Mile End" stays one name.
 */
export function draftFromTyped(text: string): { name: string; city?: string } {
  const trimmed = text.trim();
  const comma = trimmed.indexOf(",");
  if (comma <= 0) return { name: trimmed };
  const name = trimmed.slice(0, comma).trim();
  const city = trimmed.slice(comma + 1).trim();
  return city ? { name, city } : { name };
}
