import { preferenceGroups } from "../data/atlas.ts";

const BUILT_IN = new Set(preferenceGroups.flatMap((g) => g.tags));

/**
 * The interests as one line: "Food, architecture and quieter streets."
 * Béa's own tags read in lower case after the first; a tag typed by hand (a
 * name, "UNESCO sites") is kept as typed.
 */
export function interestLine(tags: readonly string[]): string {
  const words = tags
    .slice(0, 4)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t, i) => (i > 0 && BUILT_IN.has(t) ? t.toLowerCase() : t));
  const line = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0];
  return line ? `${line[0]!.toUpperCase()}${line.slice(1)}.` : "";
}
