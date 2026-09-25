/**
 * Other ways to ask the map for a stop whose name is several names at once.
 *
 * Itineraries name places the way people talk about them: "Peace Park /
 * Atomic Bomb Dome / Cenotaph", "Itsukushima Shrine (厳島神社)", "Fushimi Inari
 * ・伏見稲荷大社". The geocoder matches one name, not a list or a translation in
 * brackets, so the whole string finds nothing even though each part would.
 *
 * Returns the parts worth trying after the full name has come back empty:
 * the text in brackets first (usually the name in the local script, which is
 * what OpenStreetMap holds), then each part of a list, in order. Never the
 * full name itself, never duplicates, at most `max`.
 */
export function placeQueryParts(name: string, max = 4): string[] {
  const full = tidy(name);
  const out: string[] = [];
  const add = (part: string) => {
    const t = tidy(part);
    // Two characters is a whole name in Chinese or Japanese (京都, 奈良).
    if (t.length < 2 || t === full || out.includes(t)) return;
    out.push(t);
  };

  const bracketed = [...name.matchAll(/[(（[【「『]([^)）\]】」』]*)[)）\]】」』]?/g)];
  for (const match of bracketed) add(match[1] ?? "");
  const outside = name.replace(/[(（[【「『][^)）\]】」』]*[)）\]】」』]?/g, " ");
  if (bracketed.length) add(outside);

  for (const source of [outside, name]) {
    for (const part of source.split(/\s*(?:\/|\||・|;|；|\s[–—+-]\s)\s*/)) add(part);
  }

  // "World Heritage Sea Route: Peace Park to Miyajima" — a label, then a
  // route. The two ends are places; the label and the whole route are not,
  // so the ends go first, where they start from before where they go.
  const colon = outside.indexOf(":");
  const body = colon >= 0 ? outside.slice(colon + 1) : outside;
  const route = body.match(/^\s*(?:from\s+)?(.+?)\s+(?:to|toward|towards|→|->)\s+(.+)$/i);
  if (route) {
    // "Walk to Peace Park": a lone verb before "to" is not a place. A lone
    // name is: "Hiroshima → Shin-Osaka" leaves from Hiroshima, and the
    // start is where a train or ferry is caught.
    const from = tidy(route[1] ?? "");
    const ends = [from && !MOVEMENT_VERB.test(from) ? from : "", tidy(route[2] ?? "")];
    out.unshift(...ends.filter((t) => t.length >= 2 && t !== full && !out.includes(t)));
  }
  if (colon >= 0) {
    add(outside.slice(colon + 1));
    add(outside.slice(0, colon));
  }
  return out.slice(0, max);
}

/** A single word before "to" that is the journey, not where it starts. */
const MOVEMENT_VERB =
  /^(?:walk|stroll|head|go|drive|ride|cycle|bike|return|transfer|move|get|hop|catch|take|board|travel|continue|proceed|cross|leave|depart|start|fly|sail|back|then|onward|onwards)$/i;

function tidy(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[(（[【「『)）\]】」』]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:/|・-]+|[\s,.:/|・-]+$/g, "")
    .trim();
}
