// Where the app bar's back button goes when the browser has no earlier page
// (a fresh load, a shared link, an installed app opened on this screen). With
// history it goes back; without, it climbs to the screen this one belongs to.
const PARENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/trips\/[^/]+/, "/trips"],
  [/^\/trips\/(next|plan)(\/|$)/, "/trips"],
  [/^\/world\/next(\/|$)/, "/world"],
  [/^\/profile\/(bea|documents)(\/|$)/, "/profile"],
  // Opened from You (Calendar from Trips); Memories from Photos, Story from Memories.
  [/^\/(preferences|photos|expenses)(\/|$)/, "/profile"],
  [/^\/calendar(\/|$)/, "/trips"],
  [/^\/memories(\/|$)/, "/photos"],
  [/^\/story(\/|$)/, "/memories"],
];

export function backFallback(pathname: string): string {
  for (const [pattern, parent] of PARENTS) {
    if (pattern.test(pathname)) return parent;
  }
  return "/";
}

// The five tab roots are landing pages: nothing sits above them, so the app
// bar shows no back button there.
const TAB_ROOTS = new Set(["/", "/world", "/trips", "/recommendations", "/profile"]);

export function isLandingPage(pathname: string): boolean {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return TAB_ROOTS.has(trimmed);
}
