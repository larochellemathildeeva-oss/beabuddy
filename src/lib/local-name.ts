/**
 * A place's name in the local script, for a search the English name missed.
 *
 * In Japan, much of the map knows a place only by its Japanese name:
 * "エクセルシオール カフェ 心斎橋" finds the café that "Caffé Shinsaibashi"
 * does not. Béa asks Gemini for that name (local-name.server.ts) and searches
 * again. Only the name typed and the country go into the question, never
 * anything else about the trip. Pure, so it is tested.
 */

/** Countries whose map is written in a script other than Latin, and its language. */
const LOCAL_LANGUAGE: Record<string, string> = {
  JP: "Japanese",
  CN: "Simplified Chinese",
  TW: "Traditional Chinese",
  HK: "Traditional Chinese",
  MO: "Traditional Chinese",
  KR: "Korean",
  TH: "Thai",
  RU: "Russian",
  UA: "Ukrainian",
  BY: "Belarusian",
  BG: "Bulgarian",
  RS: "Serbian (Cyrillic)",
  MK: "Macedonian",
  GR: "Greek",
  CY: "Greek",
  IL: "Hebrew",
  EG: "Arabic",
  JO: "Arabic",
  MA: "Arabic",
  AE: "Arabic",
  SA: "Arabic",
  QA: "Arabic",
  OM: "Arabic",
  LB: "Arabic",
  IR: "Persian",
  GE: "Georgian",
  AM: "Armenian",
  KH: "Khmer",
  LA: "Lao",
  MM: "Burmese",
  MN: "Mongolian (Cyrillic)",
};

/** The language to ask for in this country, or null where the map is in Latin letters. */
export function localLanguageFor(countryCode: string | null | undefined): string | null {
  return LOCAL_LANGUAGE[(countryCode ?? "").toUpperCase()] ?? null;
}

/** A name that is worth translating: some Latin letters, and not already local. */
export function worthTranslating(name: string): boolean {
  const text = name.trim();
  return text.length >= 3 && text.length <= 120 && /\p{Script=Latin}/u.test(text);
}

export function localNamePrompt(name: string, language: string, country: string): string {
  return [
    `A traveller is looking for a place in ${country} on a map, by the name "${name}".`,
    `The map lists places there by their ${language} names.`,
    `Reply with the place's name as it is written in ${language} on signs and maps, and nothing else:`,
    "no quotes, no explanation, no romanisation. Keep the branch or area words if the name has them.",
    "If you do not know this place, write its name in the local script as a local would.",
    "If it cannot be written in that script at all, reply NONE.",
  ].join(" ");
}

/** The model's answer as a search, or null when it is empty, NONE, or not in the local script. */
export function readLocalName(reply: string | null | undefined, asked: string): string | null {
  const line = (reply ?? "")
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return null;
  const name = line.replace(/^["'「『“]+|["'」』”]+$/g, "").trim();
  if (!name || /^none\.?$/i.test(name) || name.length > 80) return null;
  if (name.toLowerCase() === asked.trim().toLowerCase()) return null;
  // The point is another script: an answer in Latin letters only would be
  // the same search again.
  if (!/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(name)) return null;
  return name;
}

type CountryBox = { country: string; bbox: readonly number[] };

/**
 * The country a point is in, from the countries' boxes: the smallest box that
 * holds it, since boxes overlap along borders. Close enough to choose a
 * language; null when no box holds it.
 */
export function countryAt(
  lat: number,
  lon: number,
  boxes: readonly CountryBox[],
  code: (name: string) => string | null,
): string | null {
  let best: { code: string; area: number } | null = null;
  for (const box of boxes) {
    const [w, s, e, n] = box.bbox;
    if (w == null || s == null || e == null || n == null) continue;
    if (lat < s || lat > n || lon < w || lon > e) continue;
    const found = code(box.country);
    const area = (e - w) * (n - s);
    if (found && (!best || area < best.area)) best = { code: found, area };
  }
  return best?.code ?? null;
}
