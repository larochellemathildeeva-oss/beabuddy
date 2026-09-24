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
    for (const part of source.split(/\s*(?:\/|\||・|;|；|\s[–—-]\s)\s*/)) add(part);
  }
  return out.slice(0, max);
}

function tidy(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[(（[【「『)）\]】」』]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:/|・-]+|[\s,.:/|・-]+$/g, "")
    .trim();
}
