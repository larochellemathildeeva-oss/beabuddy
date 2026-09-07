/** Word counts for tour copy caps — keeps the walk from drifting into a wall of text. */

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** First-run / quick walk bodies stay short enough to read on a phone. */
export const QUICK_BODY_MAX = 40;
/** Deep Dive can be a beat longer; still not a paragraph essay. */
export const DEEP_BODY_MAX = 45;
