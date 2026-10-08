import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cleanPlaceName, type FoundArticle } from "@/lib/article-search";
import type { SearchGrounding } from "@/lib/search-grounding";

// A place name only (article-search.ts `cleanPlaceName`): anything else is
// dropped, never searched; with neither name left there is nothing to search.
const placeName = z
  .string()
  .max(200)
  .nullable()
  .transform((v) => cleanPlaceName(v));
const FindArticlesInput = z.object({ city: placeName, country: placeName });

export type FindArticlesResult = {
  /** False when web search is switched off: the sheet keeps Paste a link only. */
  available: boolean;
  articles: FoundArticle[];
  grounding: SearchGrounding | null;
};

/**
 * "Find recs for …": up to three articles about a place. Only its city and
 * country are searched; a cached answer is free, a new one reserves
 * `articleSearch` from the traveller's day first.
 */
export const findArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FindArticlesInput.parse(input))
  .handler(async ({ data, context }): Promise<FindArticlesResult> => {
    const { articleSearchAvailable, cachedArticles, searchArticles } =
      await import("@/lib/article-search.server");
    if (!articleSearchAvailable()) return { available: false, articles: [], grounding: null };
    if (!data.city && !data.country) return { available: true, articles: [], grounding: null };
    const cached = cachedArticles(data.city, data.country);
    if (cached) return { available: true, ...cached };
    const { reserveAi } = await import("@/lib/ai-quota.server");
    await reserveAi(context.userId, "articleSearch");
    return { available: true, ...(await searchArticles(data.city, data.country)) };
  });
