/**
 * Which tab a path belongs to.
 *
 * Kept out of the component because the interesting case is the one that is
 * easy to get wrong: a route with *no* tab. Fifteen of Béa's routes are
 * reached from inside a tab rather than from the bar — `/preferences`,
 * `/story`, `/expenses` and so on. Clamping those to 0 would park the
 * indicator under Home and tell a person they are somewhere they are not, so
 * the answer for "no tab owns this" is -1 and the indicator hides.
 */

/** "/" matches only itself; every other tab owns its whole subtree. */
export function pathMatchesTab(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (pathname === to) return true;
  // `/trips` owns `/trips/abc` but must not own a sibling like `/tripsy`.
  return pathname.startsWith(`${to}/`);
}

/** Index of the owning tab, or -1 when the route lives outside the bar. */
export function activeTabIndex(pathname: string, tabs: readonly { to: string }[]): number {
  // Longest match wins, so a nested tab route is not stolen by a shorter one.
  let best = -1;
  let bestLength = -1;
  tabs.forEach((tab, i) => {
    if (!pathMatchesTab(pathname, tab.to)) return;
    if (tab.to.length > bestLength) {
      best = i;
      bestLength = tab.to.length;
    }
  });
  return best;
}

/**
 * How far along the bar the indicator sits, as a percentage of its own width.
 * The indicator is one column wide, so this is the whole of the geometry — no
 * measuring, no resize observer, nothing to go stale.
 */
export function indicatorOffset(index: number): string {
  return `translateX(${Math.max(index, 0) * 100}%)`;
}
