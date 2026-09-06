import type { Pin } from "../data/atlas.ts";
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

const INDOOR = /\b(museum|gallery|indoor|rain|shop|market|cafe|café)\b/i;
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

  const tagHits = prefs.tags.filter((tag) => tag && text.includes(tag.toLowerCase()));
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
      const recency = Math.max(0, 16 - days / 30);
      score += recency * boosts.recent;
      if (days <= 7) reasons.push("Saved this week");
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
