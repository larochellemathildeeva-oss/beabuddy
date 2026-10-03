/**
 * When the page header collapses to a bar.
 *
 * Two thresholds, not one. A single threshold at 48px means a person resting
 * their scroll near the boundary gets the header flapping open and shut on
 * every pixel of drift — the thing that makes a collapsing header feel cheap.
 * So it compresses at 48 and only expands again at 24. Short pages also need
 * enough scroll range to absorb the header's height: compressing enlarges the
 * viewport, and the browser can clamp scrollTop below the expansion threshold.
 * Only the expanded-to-compact height difference needs to fit, so moderately
 * scrolling pages can still compress without guessing a height from the font.
 */
export const COMPRESS_AT = 48;
export const EXPAND_AT = 24;

export function nextCompressed(
  scrollTop: number,
  compressed: boolean,
  { scrollRange = Infinity, expandedHeight = 0, compactHeight = 0 } = {},
): boolean {
  if (compressed) return scrollTop > EXPAND_AT;
  return (
    scrollTop >= COMPRESS_AT &&
    scrollRange - Math.max(0, expandedHeight - compactHeight) >= COMPRESS_AT
  );
}

/** Measure the compact layout off-screen, without changing the live scroll area. */
export function measureHeaderHeights(header: HTMLElement) {
  const expanded = header.getBoundingClientRect();
  const compact = header.cloneNode(true) as HTMLElement;
  compact.setAttribute("data-compressed", "");
  compact.setAttribute("aria-hidden", "true");
  Object.assign(compact.style, {
    position: "absolute",
    width: `${expanded.width}px`,
    visibility: "hidden",
    pointerEvents: "none",
    transition: "none",
    animation: "none",
  });
  for (const child of compact.querySelectorAll<HTMLElement>("*")) child.style.transition = "none";
  header.parentElement!.append(compact);
  try {
    return {
      expandedHeight: expanded.height,
      compactHeight: compact.getBoundingClientRect().height,
    };
  } finally {
    compact.remove();
  }
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
