import type { Pin } from "../data/atlas.ts";
import { foldAccents } from "./fuzzy.ts";
import { daysSince, haversine, isLatLon } from "./geo.ts";

export type ScorePrefs = {
  tags: string[];
  preferredCountries: string[];
  /** Free-text "what matters" — overrides default weights when present. */
  priorities?: string | null;
};

export type ScoreContext = {
  here?: { lat: number; lon: number } | null;
  now?: Date;
};

export type OpportunityScore = {
  score: number;
  reasons: string[];
};

const INDOOR = /\b(museum|gallery|indoor|rain|shop|mall|cafe|café)\b/i;
const FOOD = /\b(food|restaurant|eat|lunch|dinner|breakfast|market|cafe|café)\b/i;

function haystack(pin: Pin): string {
  return [pin.name, pin.city, pin.country, pin.category, pin.notes].filter(Boolean).join(" ").toLowerCase();
}

function priorityBoosts(priorities: string | null | undefined) {
  const text = priorities?.trim() ?? "";
  return {
    near: /\b(near|nearby|close|walk|walking)\b/i.test(text) ? 2 : 1,
    recent: /\b(new|recent|just saved|latest)\b/i.test(text) ? 2 : 1,
    who: /\b(friend|who told|recommended)\b/i.test(text) ? 2.5 : 1,
    indoor: INDOOR.test(text),
    food: FOOD.test(text),
  };
}

/** Higher is better. Pure function — safe to unit test. */
export function scoreOpportunity(pin: Pin, prefs: ScorePrefs, ctx: ScoreContext = {}): OpportunityScore {
  const now = ctx.now ?? new Date();
  const boosts = priorityBoosts(prefs.priorities);
  const text = haystack(pin);
  let score = 0;
  const reasons: string[] = [];

  // NOTE: nothing populates pin.priority today — there is no priority column on
  // `recommendations` and no writer in src/. These weights are inert against real
  // data and only fire in tests. Kept so the term is ready if the column lands;
  // do not tune the other weights against it until it does.
  if (pin.priority === "High") {
    score += 40;
    reasons.push("High priority");
  } else if (pin.priority === "Medium") {
    score += 15;
  }

  if (pin.type === "reco") score += 12;
  else if (pin.type === "nexttime") score += 10;
  else if (pin.type === "wishlist") score += 8;

  if (pin.type === "visited" || pin.visited) {
    score -= 20;
    reasons.push("Already been");
  }

  // Exact tags stored on the rec beat a name/category haystack match. Word-
  // boundary on the haystack: a raw substring made "art" hit Cartagena and
  // "bar" hit Barcelona. Multi-word tags still match as a phrase.
  const folded = foldAccents(text);
  const words = new Set(folded.split(" "));
  const stored = new Set((pin.travelTags ?? []).map((tag) => foldAccents(tag)));
  const tagHits = prefs.tags.filter((tag) => {
    const needle = foldAccents(tag ?? "");
    if (!needle) return false;
    if (stored.has(needle)) return true;
    return needle.includes(" ") ? folded.includes(needle) : words.has(needle);
  });
  if (tagHits.length) {
    score += Math.min(24, tagHits.length * 12);
    reasons.push(`Matches ${tagHits[0]}`);
  }

  if (pin.country && prefs.preferredCountries.some((c) => c.toLowerCase() === pin.country.toLowerCase())) {
    score += 10;
    reasons.push(`You love ${pin.country}`);
  }

  if (boosts.indoor && INDOOR.test(text)) score += 18;
  if (boosts.food && FOOD.test(text)) score += 18;

  if (pin.dateAdded) {
    const days = daysSince(pin.dateAdded, now);
    if (days != null) {
      // Two different things about age are interesting, and the old single
      // recency term only captured one. Just-saved is top of mind; long-dormant
      // is the reason the vault exists at all — "saved in 2026, surfaced years
      // later". Scoring only recency ranked the resurfacing case last.
      if (days <= 14) {
        score += 10 * boosts.recent;
        if (days <= 7) reasons.push("Saved this week");
      }
      if (!pin.visited && pin.type !== "visited") {
        const dormant = Math.min(18, (days / 365) * 12);
        score += dormant;
        const years = Math.floor(days / 365);
        if (years >= 1) {
          reasons.push(`Saved ${years} year${years > 1 ? "s" : ""} ago, never visited`);
        }
      }
    }
  }

  if (pin.recommendedBy) {
    score += 5 * boosts.who;
    reasons.push(`From ${pin.recommendedBy}`);
  }

  if (ctx.here && isLatLon(pin)) {
    const km = haversine(ctx.here, pin) / 1000;
    const proximity = Math.max(0, 45 - km) * boosts.near;
    score += proximity;
    if (km < 1) reasons.push("A short walk");
    else if (km < 8) reasons.push(`${km.toFixed(1)} km away`);
  }

  if (!reasons.length) reasons.push("On your list");
  return { score: Math.round(score * 10) / 10, reasons };
}

export function rankOpportunities<T extends Pin>(
  pins: T[],
  prefs: ScorePrefs,
  ctx: ScoreContext = {},
): Array<{ pin: T; score: OpportunityScore }> {
  return pins
    .map((pin) => ({ pin, score: scoreOpportunity(pin, prefs, ctx) }))
    .sort((a, b) => b.score.score - a.score.score);
}
