/**
 * The travel styles, budgets and paces a traveller picks from — on Travel
 * preferences and in the welcome flow, so both offer the same words and save
 * the same values to `profiles`.
 */
export type StyleOption = { value: string; hint: string };

export const TRAVEL_STYLES: StyleOption[] = [
  { value: "Comfort seeker", hint: "Nice bed, easy days, no roughing it." },
  { value: "Explorer", hint: "Out early, wander far, see everything." },
  { value: "Culture first", hint: "Museums, history, architecture, local life." },
  { value: "Food led", hint: "The trip is planned around meals." },
  { value: "Outdoors", hint: "Trails, water, mountains, fresh air." },
  { value: "Family friendly", hint: "Kid-proof pacing and places." },
  { value: "Romantic", hint: "Quiet corners and long dinners." },
  { value: "Work & wander", hint: "Wifi, cafés, a few good breaks." },
];

export const TRAVEL_BUDGETS: StyleOption[] = [
  { value: "Shoestring", hint: "Hostels, street food, buses." },
  { value: "Value", hint: "Simple hotels, good cheap eats." },
  { value: "Comfortable", hint: "Solid 3–4 star, a few treats." },
  { value: "Premium", hint: "Lovely hotels, tasting menus." },
  { value: "No limit", hint: "Pick the best, always." },
];

export const TRIP_PACES: StyleOption[] = [
  { value: "Slow", hint: "One or two things a day." },
  { value: "Balanced", hint: "A highlight plus room to breathe." },
  { value: "Full", hint: "Pack the day, rest at home." },
];

/**
 * A saved style, budget or pace, as the planner may see it: only the listed
 * options it holds, in their own words. Travel preferences stores several
 * styles as one "A, B, C" value, so each part is checked on its own. Anything
 * else (an older option, or text written straight to the API) is dropped:
 * the app cannot show it, and free text must never steer the planner.
 */
export function listedChoices(
  value: string | null | undefined,
  options: StyleOption[],
): string | null {
  if (!value) return null;
  const allowed = new Set(options.map((option) => option.value));
  const kept = [
    ...new Set(
      value
        .split(",")
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter((part) => allowed.has(part)),
    ),
  ];
  return kept.length > 0 ? kept.join(", ") : null;
}
