import { generateText } from "ai";
import { AI_CALL, searchTools, withModelFallback } from "@/lib/ai.server";
import {
  readSearchGrounding,
  webCheckNote,
  webCheckPrompt,
  type SearchGrounding,
} from "@/lib/search-grounding";

export type WebCheck = { note: string; grounding: SearchGrounding | null };

/**
 * A long planning prompt with search switched on rarely searches, so Béa asks
 * first, in a short call of its own, and hands the findings to the planner.
 * Kept for a few hours per place and dates: Alternatives and Rebuild on the
 * same trip reuse it instead of paying for the searches again.
 */
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; check: WebCheck }>();

/** What the web says about this place and these dates, or null. Never throws. */
export async function webCheck(
  place: string | null | undefined,
  startDate: string | null,
  endDate: string | null,
): Promise<WebCheck | null> {
  const where = place?.trim();
  const search = searchTools();
  if (!where || !("tools" in search)) return null;

  const key = `${where.toLowerCase()}|${startDate ?? ""}|${endDate ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.check;

  try {
    const result = await withModelFallback((model) =>
      generateText({
        model,
        ...AI_CALL,
        ...search,
        reasoning: "low",
        prompt: webCheckPrompt(where, startDate, endDate),
      }),
    );
    const findings = result.text.trim();
    if (!findings) return null;
    const check = {
      note: webCheckNote(findings),
      grounding: readSearchGrounding(result.providerMetadata),
    };
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), check });
    return check;
  } catch (error) {
    // The plan is still worth making without it.
    console.error("[ai] web check failed, planning without it:", error);
    return null;
  }
}
