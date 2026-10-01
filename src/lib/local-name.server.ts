import { generateText } from "ai";
import { AI_CALL, withModelFallback } from "@/lib/ai.server";
import { takeFromHour } from "@/lib/pexels";
import countryBoxes from "../../public/geo/admin1/index.json";
import { countryCode } from "@/lib/country-names";
import { countryAt, localNamePrompt, readLocalName } from "@/lib/local-name";

/**
 * Gemini, asked for a place's name in the local script (see local-name.ts).
 *
 * Only after an English search found nothing that is the place, so most
 * searches never ask. Answers are kept for the life of the process, a
 * traveller asks at most `PER_USER_HOURLY` an hour, and the whole app
 * `HOURLY_MAX`. A failure is null: the search keeps what it had.
 */
const PER_USER_HOURLY = 30;
const HOURLY_MAX = 600;
const CACHE_MAX = 2_000;

const cache = new Map<string, Promise<string | null>>();
const asked: number[] = [];
const byUser = new Map<string, number[]>();

function allowed(userId: string, now: number): boolean {
  let mine = byUser.get(userId);
  if (!mine) {
    if (byUser.size >= CACHE_MAX) byUser.delete(byUser.keys().next().value!);
    mine = [];
    byUser.set(userId, mine);
  }
  if (!takeFromHour(mine, now, PER_USER_HOURLY)) return false;
  if (takeFromHour(asked, now, HOURLY_MAX)) return true;
  mine.pop();
  return false;
}

/** The name in `language`, as a search, or null. Never throws. */
export function localName(
  userId: string,
  name: string,
  language: string,
  country: string,
): Promise<string | null> {
  if (!process.env["GOOGLE_GENERATIVE_AI_API_KEY"]) return Promise.resolve(null);
  const key = `${language}|${country.toLowerCase()}|${name.trim().toLowerCase()}`;
  const known = cache.get(key);
  if (known) return known;
  if (!allowed(userId, Date.now())) return Promise.resolve(null);
  // No AI units are reserved here: this runs in the background of a search,
  // and spending the day's allowance on it would refuse the traveller's next
  // trip build. It has its own cap (30 an hour, `allowed`) and a cache.
  const answer = withModelFallback((model) =>
    generateText({
      model,
      ...AI_CALL,
      reasoning: "low",
      prompt: localNamePrompt(name.trim(), language, country),
    }),
  )
    .then((result) => readLocalName(result.text, name))
    .catch((error: unknown) => {
      console.error("[places] local-script name failed:", error);
      cache.delete(key);
      return null;
    });
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, answer);
  return answer;
}

/** The country a point is in, as an ISO code, or null. */
export function countryAtPoint(lat: number, lon: number): string | null {
  return countryAt(lat, lon, countryBoxes, countryCode);
}
