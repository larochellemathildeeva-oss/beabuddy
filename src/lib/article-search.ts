/**
 * Find recs for a location: Béa searches the web for articles about a city
 * (or country) and the traveller picks one to read with the list reader.
 * Only the city and country are searched; the answer is cached per place.
 * Pure, so it is tested without a key (article-search.server.ts calls Gemini).
 */
import { countryKey } from "./country-names.ts";
import { foldAccents } from "./fuzzy.ts";
import { isPublicHttpsUrl } from "./place-url.ts";

export type FoundArticle = { title: string; url: string };

export const MAX_ARTICLES = 3;

/** One cache entry per place, whatever its spelling or language. */
export function articleCacheKey(city: string | null, country: string | null): string {
  const folded = foldAccents((city ?? "").split(",")[0] ?? "")
    .toLowerCase()
    .trim();
  return `${folded}|${countryKey(country)}`;
}

export function articleSearchPrompt(city: string | null, country: string | null): string {
  const place = [city, country].filter((part) => part?.trim()).join(", ");
  return [
    "Use at most 2 Google searches.",
    `Find up to ${MAX_ARTICLES} recent articles that list places to eat, see and do in ${place}: city guides, "best of" lists, things to do.`,
    "Answer with one article per line, exactly as: Title | https://link",
    "Only articles you found, no other text.",
  ].join("\n");
}

/** The articles in the answer: public https links only, at most three, no repeats. */
export function readArticles(text: string): FoundArticle[] {
  const out: FoundArticle[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*[-*\d.)\s]*(.+?)\s*\|\s*(https:\/\/\S+)\s*$/);
    if (!match) continue;
    let url: URL;
    try {
      url = new URL(match[2]!);
    } catch {
      continue;
    }
    if (!isPublicHttpsUrl(url)) continue;
    if (out.some((a) => a.url === url.href)) continue;
    out.push({ title: match[1]!.trim(), url: url.href });
    if (out.length === MAX_ARTICLES) break;
  }
  return out;
}
