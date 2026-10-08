import { generateText } from "ai";
import { AI_CALL, searchTools, withModelFallback } from "@/lib/ai.server";
import {
  articleCacheKey,
  articleSearchPrompt,
  keepSourcedArticles,
  readArticles,
  type FoundArticle,
} from "@/lib/article-search";
import { readSearchGrounding, type SearchGrounding } from "@/lib/search-grounding";

export type ArticleSearch = { articles: FoundArticle[]; grounding: SearchGrounding | null };

// A week per place: the same city asked again by anyone costs nothing.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; found: ArticleSearch }>();

/** Whether Béa can search the web at all (GEMINI_SEARCH_GROUNDING). */
export function articleSearchAvailable(): boolean {
  return "tools" in searchTools();
}

/** A cached answer for this place, or null. Asking the cache costs nothing. */
export function cachedArticles(city: string | null, country: string | null): ArticleSearch | null {
  const hit = cache.get(articleCacheKey(city, country));
  return hit && Date.now() - hit.at < TTL_MS ? hit.found : null;
}

/** Searches the web for articles about the place. Throws when the search fails. */
export async function searchArticles(
  city: string | null,
  country: string | null,
): Promise<ArticleSearch> {
  const search = searchTools();
  if (!("tools" in search)) return { articles: [], grounding: null };
  const result = await withModelFallback((model) =>
    generateText({
      model,
      ...AI_CALL,
      ...search,
      reasoning: "low",
      prompt: articleSearchPrompt(city, country),
    }),
  );
  const grounding = readSearchGrounding(result.providerMetadata);
  const found = {
    // Only sites the search really returned: a written link can be made up.
    articles: keepSourcedArticles(readArticles(result.text), grounding?.sources ?? []),
    grounding,
  };
  if (found.articles.length > 0) {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(articleCacheKey(city, country), { at: Date.now(), found });
  }
  return found;
}
