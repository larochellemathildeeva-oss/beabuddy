import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type PreferenceContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export type TravelPreferences = {
  tags: string[];
  travelStyle: string | null;
  budgetLevel: string | null;
  tripPace: string | null;
  preferredCountries: string[];
  dietaryNotes: string | null;
  avoidNotes: string | null;
  homeCurrency: string | null;
  homeCity: string | null;
};

const empty: TravelPreferences = {
  tags: [],
  travelStyle: null,
  budgetLevel: null,
  tripPace: null,
  preferredCountries: [],
  dietaryNotes: null,
  avoidNotes: null,
  homeCurrency: null,
  homeCity: null,
};

export async function getTravelPreferences(
  context: PreferenceContext,
): Promise<TravelPreferences> {
  const { data } = await context.supabase
    .from("profiles")
    .select(
      "preferences, travel_style, budget_level, trip_pace, preferred_countries, dietary_notes, avoid_notes, home_currency, home_city",
    )
    .eq("id", context.userId)
    .maybeSingle();

  if (!data) return empty;

  return {
    tags: (data.preferences ?? []).filter(Boolean).slice(0, 40),
    travelStyle: data.travel_style ?? null,
    budgetLevel: data.budget_level ?? null,
    tripPace: data.trip_pace ?? null,
    preferredCountries: (data.preferred_countries ?? []).filter(Boolean).slice(0, 30),
    dietaryNotes: data.dietary_notes ?? null,
    avoidNotes: data.avoid_notes ?? null,
    homeCurrency: data.home_currency ?? null,
    homeCity: data.home_city ?? null,
  };
}

export function preferencePrompt(prefs: TravelPreferences | string[]) {
  const p: TravelPreferences = Array.isArray(prefs) ? { ...empty, tags: prefs } : prefs;

  const lines = [
    p.travelStyle ? `Travel style: ${p.travelStyle}.` : "",
    p.budgetLevel ? `Budget level: ${p.budgetLevel} — keep every suggestion inside it.` : "",
    p.tripPace ? `Preferred daily pace: ${p.tripPace}.` : "",
    p.tags.length ? `Interests: ${p.tags.join(", ")}.` : "",
    p.preferredCountries.length
      ? `Countries and regions they love: ${p.preferredCountries.join(", ")}.`
      : "",
    p.dietaryNotes ? `Food rules that must be respected: ${p.dietaryNotes}.` : "",
    p.avoidNotes ? `Things to avoid entirely: ${p.avoidNotes}.` : "",
    p.homeCurrency ? `Show money in ${p.homeCurrency} unless asked otherwise.` : "",
    p.homeCity ? `They travel from ${p.homeCity}.` : "",
  ].filter(Boolean);

  if (!lines.length) return "No saved traveller preferences are available.";

  return [
    "Saved traveller profile — treat these as strong personalisation signals and honour the hard rules (food, budget, avoid list) unless the request below overrides them:",
    ...lines,
  ].join("\n");
}
