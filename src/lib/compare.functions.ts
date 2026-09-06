import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildCompareFacts,
  factsPrompt,
  type CompareFacts,
  type PlaceForCompare,
} from "@/lib/compare-facts";
import { AI_CALL } from "@/lib/ai-errors";
import { isLatLon, type LatLon } from "@/lib/geo";

const PlaceInput = z.object({
  name: z.string().min(1),
  city: z.string().nullable(),
  country: z.string().nullable(),
  category: z.string().nullable(),
  kind: z.string(),
  notes: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  recommendedBy: z.string().nullable(),
  dateAdded: z.string().nullable(),
  source: z.string().nullable(),
  alreadyBeen: z.boolean(),
});

const CompareInput = z.object({
  places: z.array(PlaceInput).min(2).max(5),
  priorities: z.string().max(400).nullable(),
  month: z.string().max(20).nullable(),
});

const CompareSchema = z.object({
  headline: z.string(),
  pick: z.string(),
  why: z.string(),
  places: z.array(
    z.object({
      name: z.string(),
      bestFor: z.string(),
      goodToKnow: z.string(),
      watchOut: z.string(),
    }),
  ),
  tip: z.string(),
});

export type ComparisonResult = z.infer<typeof CompareSchema> & {
  facts: CompareFacts;
  reasoningText: string | null;
};

const homeCache = new Map<string, LatLon | null>();

async function geocodeHome(city: string | null): Promise<LatLon | null> {
  const query = city?.trim();
  if (!query) return null;
  const key = query.toLowerCase();
  if (homeCache.has(key)) return homeCache.get(key) ?? null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1`,
      {
        headers: {
          "user-agent": "BeaTravelApp/1.0 (travel memory vault)",
          accept: "application/json",
        },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) {
      homeCache.set(key, null);
      return null;
    }
    const json = (await res.json()) as { lat: string; lon: string }[];
    const first = json[0];
    const coords = first ? { lat: Number(first.lat), lon: Number(first.lon) } : null;
    const ok = coords && isLatLon(coords) ? coords : null;
    homeCache.set(key, ok);
    return ok;
  } catch {
    homeCache.set(key, null);
    return null;
  }
}

export const comparePlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompareInput.parse(input))
  .handler(async ({ data, context }): Promise<ComparisonResult> => {
    const { withModelFallback, judgmentCall } = await import("@/lib/ai.server");
    const { getTravelPreferences, preferencePrompt } = await import("@/lib/travel-preferences.server");
    const preferences = await getTravelPreferences(context);
    const homeCoords = await geocodeHome(preferences.homeCity);
    const facts = buildCompareFacts(
      data.places as PlaceForCompare[],
      { city: preferences.homeCity, coords: homeCoords },
      data.month,
    );

    const list = data.places
      .map(
        (p, i) =>
          `${i + 1}. ${p.name} — ${[p.city, p.country].filter(Boolean).join(", ") || "location unknown"}` +
          `${p.category ? ` · ${p.category}` : ""} · saved as: ${p.kind}` +
          `${p.notes ? ` · my note: "${p.notes}"` : ""}`,
      )
      .join("\n");

    const prompt = [
      "I am comparing these saved travel places and want help choosing between them:",
      list,
      data.priorities ? `What matters most to me: ${data.priorities}` : "",
      preferencePrompt(preferences),
      "",
      factsPrompt(facts),
      "",
      "Compare them honestly for a traveller. Cover atmosphere, cost, how much time is needed, and how they differ from each other.",
      "Use the computed distances and dates when they help the choice. Do not invent walking times, transit times, or distances that are not in the facts.",
      "Pick one as the best match and say plainly why. Keep every field short, warm and concrete — no marketing language, no bullet symbols.",
      "Include exactly one entry in `places` for each place listed above, in the same order, using the same names.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const result = await withModelFallback((model) =>
        generateText({
          model,
          ...AI_CALL,
          output: Output.object({ schema: CompareSchema }),
          ...judgmentCall,
          prompt,
        }),
      );
      return {
        ...result.output,
        facts,
        reasoningText: result.reasoningText?.trim() || null,
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("The comparison came back garbled. Try again.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });
