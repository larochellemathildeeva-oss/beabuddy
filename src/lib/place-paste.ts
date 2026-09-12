/**
 * Mobile share sheets (Maps, Yelp, …) paste as a blob: place name, stars,
 * address, then a link — not a bare URL. Extract the https link Béa can read.
 */

const HTTPS_IN_TEXT = /https:\/\/[^\s<>"']+/gi;

/** Hosts people actually share for a single venue. */
function isLikelyPlaceHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "goo.gl" ||
    host === "maps.app.goo.gl" ||
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "maps.apple.com" ||
    host.endsWith(".maps.apple.com") ||
    host === "apple.com" ||
    host === "yelp.com" ||
    host.endsWith(".yelp.com") ||
    host === "tripadvisor.com" ||
    host.endsWith(".tripadvisor.com") ||
    host === "openstreetmap.org" ||
    host.endsWith(".openstreetmap.org")
  );
}

/** Trim punctuation that rides along when someone pastes from a message. */
export function cleanPastedHttpsUrl(raw: string): string | null {
  let s = raw.trim();
  // Trailing ) ] . , ; from chat apps wrapping the link
  while (/[),.;\]]+$/.test(s)) s = s.slice(0, -1);
  if (!/^https:\/\//i.test(s)) return null;
  try {
    const url = new URL(s);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function nameHintFromShare(text: string, urlRaw: string): string | undefined {
  const before = text
    .slice(0, text.indexOf(urlRaw))
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const first = before[0];
  if (!first) return undefined;
  // Skip rating-only / emoji-only lines
  if (/^[★☆⭐·.\s\d/]+$/.test(first)) return undefined;
  if (first.length < 2 || first.length > 80) return undefined;
  if (/^https?:\/\//i.test(first)) return undefined;
  return first;
}

/**
 * Pull a single place URL out of whatever landed on the clipboard.
 * Accepts a bare https link, share-sheet text with a link inside, or a
 * scheme-less maps.apple.com / maps.app.goo.gl path.
 */
export function extractPastedPlaceLink(text: string): { url: string; nameHint?: string } | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 4000) return null;

  const found = trimmed.match(HTTPS_IN_TEXT) ?? [];
  const cleaned = found.map(cleanPastedHttpsUrl).filter((u): u is string => Boolean(u));
  if (cleaned.length) {
    let best = cleaned[0]!;
    for (const candidate of cleaned) {
      try {
        if (isLikelyPlaceHost(new URL(candidate).hostname)) {
          best = candidate;
          break;
        }
      } catch {
        /* keep best */
      }
    }
    // Match the raw substring we used, for name-hint slicing
    const rawMatch = found.find((r) => cleanPastedHttpsUrl(r) === best) ?? best;
    const nameHint = nameHintFromShare(trimmed, rawMatch);
    return nameHint ? { url: best, nameHint } : { url: best };
  }

  // Scheme-less share: "maps.app.goo.gl/AbCd" or "maps.apple.com/?ll=…"
  const bare = trimmed.match(
    /^(?:https?:\/\/)?((?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com|www\.google\.com\/maps|google\.com\/maps)[^\s]*)$/i,
  );
  if (bare?.[1]) {
    const url = cleanPastedHttpsUrl(`https://${bare[1]}`);
    return url ? { url } : null;
  }

  return null;
}

/** True when the typed/pasted search field is really a link, not a place name. */
export function looksLikePastedPlaceLink(text: string): boolean {
  return extractPastedPlaceLink(text) != null;
}
