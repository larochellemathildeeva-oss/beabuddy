import { generateText } from "ai";
import { AI_CALL, searchTools, withModelFallback } from "@/lib/ai.server";
import {
  articleCacheKey,
  articleCacheTtl,
  articleSearchPrompt,
  keepSourcedArticles,
  readArticles,
  type FoundArticle,
} from "@/lib/article-search";
import { readSearchGrounding, type SearchGrounding } from "@/lib/search-grounding";

export type ArticleSearch = { articles: FoundArticle[]; grounding: SearchGrounding | null };

// A week per place (an hour when nothing was found): the same place asked
// again by anyone costs nothing (articleCacheTtl).
const MAX_ENTRIES = 200;
const cache = new Map<string, { until: number; found: ArticleSearch }>();

/** Whether Béa can search the web at all (GEMINI_SEARCH_GROUNDING). */
export function articleSearchAvailable(): boolean {
  return "tools" in searchTools();
}

/** A cached answer for this place, or null. Asking the cache costs nothing. */
export function cachedArticles(city: string | null, country: string | null): ArticleSearch | null {
  const hit = cache.get(articleCacheKey(city, country));
  return hit && Date.now() < hit.until ? hit.found : null;
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
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(articleCacheKey(city, country), {
    until: Date.now() + articleCacheTtl(found.articles.length),
    found,
  });
  return found;
}
