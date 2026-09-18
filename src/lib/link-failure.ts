import type { PartialReason } from "./places.functions.ts";

/**
 * What to say when a pasted link gave up nothing.
 *
 * There used to be one message for every cause: "That link didn't give up any
 * details. Open it once in your browser, then paste the long address-bar link
 * instead." That advice only helps for one of the three causes. For a short
 * link that never resolved it is a red herring, and for a site that answered
 * with a login wall it is simply wrong — the long link is the login wall.
 *
 * Each message says what happened, then the one thing worth trying next. None
 * of them blames the reader, and none promises something Béa cannot do.
 */
export function linkFailureMessage(reason: PartialReason | undefined, host?: string): string {
  const site = siteName(host);
  switch (reason) {
    case "unreachable":
      return `Béa couldn't reach ${site} just now. Check your connection and try again — or type the name and she'll find it on the map.`;
    case "refused":
      return `${site} didn't answer with a page Béa can read — a lot of sites hide their details behind a login. Type the name instead and she'll look it up.`;
    case "no-details":
    default:
      return `That page didn't name a place Béa could recognise. Type the name and she'll find it on the map — the link stays saved either way.`;
  }
}

/**
 * Said when the name came through but the map did not.
 *
 * Deliberately not an error: the read worked and the name is right. It exists
 * because an empty map with no explanation is how a wrong location went
 * unnoticed — silence reads as "this is fine" either way, so it has to say
 * which way it is.
 */
export function unlocatedMessage(name?: string): string {
  const what = name?.trim() ? `"${name.trim()}"` : "that one";
  return `Saved ${what}, but Béa couldn't tell which one — add the city, or search the map below to pin it.`;
}

/** "www.instagram.com" → "Instagram". Falls back to something neutral. */
export function siteName(host?: string): string {
  const bare = (host ?? "")
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  if (!bare) return "that page";
  const known: Record<string, string> = {
    "instagram.com": "Instagram",
    "tiktok.com": "TikTok",
    "x.com": "X",
    "twitter.com": "X",
    "facebook.com": "Facebook",
    "maps.app.goo.gl": "Google Maps",
    "goo.gl": "Google Maps",
    "google.com": "Google Maps",
    "maps.apple.com": "Apple Maps",
    "yelp.com": "Yelp",
    "tripadvisor.com": "Tripadvisor",
  };
  if (known[bare]) return known[bare];
  // A subdomain of something known — maps.google.com, www.yelp.co.uk.
  for (const [domain, label] of Object.entries(known)) {
    if (bare.endsWith(`.${domain}`)) return label;
  }
  return bare;
}

/** The host of a URL, for the message above. Never throws on rubbish. */
export function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
