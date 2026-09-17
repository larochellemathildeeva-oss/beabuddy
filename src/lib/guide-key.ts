/**
 * Which guide belongs to a path.
 *
 * Guides used to be looked up by literal pathname, which was fine while every
 * screen had a fixed URL. A trip is now `/trips/<id>`, so a literal key can
 * never match it and the page would silently have no guide — the quietest
 * possible regression, since nothing breaks, the button just stops explaining
 * anything.
 *
 * So: exact match first, then a registered pattern whose `$param` segments
 * match anything. Exact always wins, so a specific key is never shadowed by a
 * pattern that also happens to fit.
 */
export function guideKeyForPath(pathname: string, keys: readonly string[]): string | null {
  if (keys.includes(pathname)) return pathname;

  const parts = segments(pathname);
  // Longest pattern first: `/trips/$id/day/$n` should beat `/trips/$id`.
  const patterns = keys.filter((k) => k.includes("$")).sort((a, b) => b.length - a.length);

  for (const key of patterns) {
    const keyParts = segments(key);
    if (keyParts.length !== parts.length) continue;
    const fits = keyParts.every((part, i) => part.startsWith("$") || part === parts[i]);
    if (fits) return key;
  }
  return null;
}

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}
