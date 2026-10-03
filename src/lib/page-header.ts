/**
 * When the page header collapses to a bar.
 *
 * Two thresholds, not one. A single threshold at 48px means a person resting
 * their scroll near the boundary gets the header flapping open and shut on
 * every pixel of drift — the thing that makes a collapsing header feel cheap.
 * So it compresses at 48 and only expands again at 24. Short pages also need
 * enough scroll range to absorb the header's height: compressing enlarges the
 * viewport, and the browser can clamp scrollTop below the expansion threshold.
 * Reserving the full expanded height is safe for long titles and Reading sizes
 * without guessing the compact height or changing the scroll position.
 */
export const COMPRESS_AT = 48;
export const EXPAND_AT = 24;

export function nextCompressed(
  scrollTop: number,
  compressed: boolean,
  { scrollRange = Infinity, headerHeight = 0 } = {},
): boolean {
  if (compressed) return scrollTop > EXPAND_AT;
  return scrollTop >= COMPRESS_AT && scrollRange - headerHeight >= COMPRESS_AT;
}

/**
 * The tab a screen belongs to, as a plain token for `data-tab`.
 *
 * Identity is one hue rotation of the same accent — lightness and chroma stay
 * fixed, so every tab has identical contrast against the page. That is the
 * payoff for the palette being in oklch rather than hex.
 */
export type TabId = "home" | "world" | "trips" | "recs" | "you";

export function tabIdForPath(pathname: string): TabId | null {
  if (pathname === "/") return "home";
  if (pathname === "/world" || pathname.startsWith("/world/")) return "world";
  if (pathname === "/trips" || pathname.startsWith("/trips/")) return "trips";
  if (pathname === "/recommendations" || pathname.startsWith("/recommendations/")) return "recs";
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return "you";
  return null;
}
