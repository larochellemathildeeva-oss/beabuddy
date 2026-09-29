/**
 * Preferences just for this trip, on top of the saved profile.
 *
 * The profile says how you usually travel: good food, a moderate pace,
 * museums. A trip is sometimes different — travelling with Dad, a week of
 * late mornings, no nightlife this time — and there was nowhere to say so
 * except retyping it into every request. These are said once, on the trip,
 * and every plan Béa drafts, reworks or rearranges for it reads them,
 * ahead of the profile where the two disagree.
 *
 * Pure, so the cleaning and the words sent are tested.
 */

/** The ready-made ones; anything else can be typed. */
export const TRIP_PREFERENCE_CHOICES = [
  "Late mornings",
  "Early starts",
  "Less walking",
  "Slow pace",
  "Packed days",
  "Travelling with kids",
  "Travelling with older parents",
  "Vegetarian",
  "No nightlife",
  "Splurge on food",
  "Tight budget",
  "Mostly indoors",
] as const;

export const TRIP_PREFERENCES_MAX = 12;
export const TRIP_PREFERENCE_LENGTH_MAX = 80;

/** Trimmed, deduplicated without regard to case, capped. */
export function cleanTripPreferences(list: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const text = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, TRIP_PREFERENCE_LENGTH_MAX);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= TRIP_PREFERENCES_MAX) break;
  }
  return out;
}

/** The words for the model, or "" when there are none. */
export function tripPreferencePrompt(list: readonly string[] | null | undefined): string {
  const clean = cleanTripPreferences(list ?? []);
  if (!clean.length) return "";
  return [
    "Just for this trip — these come before the saved profile wherever the two disagree:",
    ...clean.map((p) => `- ${p}`),
  ].join("\n");
}
