// Where the app bar's back button goes when the browser has no earlier page
// (a fresh load, a shared link, an installed app opened on this screen). With
// history it goes back; without, it climbs to the screen this one belongs to.
const PARENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/trips\/[^/]+/, "/trips"],
  [/^\/trips\/(next|plan)(\/|$)/, "/trips"],
  [/^\/world\/next(\/|$)/, "/world"],
  [/^\/profile\/(bea|documents)(\/|$)/, "/profile"],
];

export function backFallback(pathname: string): string {
  for (const [pattern, parent] of PARENTS) {
    if (pattern.test(pathname)) return parent;
  }
  return "/";
}
