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

/** Longest style, budget or pace Béa will pass on to the planner. */
export const CHOICE_MAX = 40;

/**
 * A saved style, budget or pace, made safe to hand the planner: the columns
 * are free text, so anything not on the lists (an older option, or a value
 * written straight to the API) is kept to one short line, never a paragraph
 * smuggled into the planning prompt.
 */
export function safeChoice(value: string | null | undefined): string | null {
  if (!value) return null;
  const line = value.replace(/\s+/g, " ").trim();
  if (!line) return null;
  return line.length > CHOICE_MAX ? line.slice(0, CHOICE_MAX).trim() : line;
}
