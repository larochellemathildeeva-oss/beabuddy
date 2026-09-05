import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlaceInput = z.object({
  name: z.string().min(1),
  city: z.string().nullable(),
  country: z.string().nullable(),
  category: z.string().nullable(),
  kind: z.string(),
  notes: z.string().nullable(),
});

const CompareInput = z.object({
  places: z.array(PlaceInput).min(2).max(5),
  priorities: z.string().max(400).nullable(),
  month: z.string().nullable(),
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

export type ComparisonResult = z.infer<typeof CompareSchema>;

export const comparePlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompareInput.parse(input))
  .handler(async ({ data, context }): Promise<ComparisonResult> => {
    const { getGeminiModel } = await import("@/lib/ai.server");
    const model = getGeminiModel();
    const { getTravelPreferences, preferencePrompt } = await import("@/lib/travel-preferences.server");
    const preferences = await getTravelPreferences(context);

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
      data.month ? `I would be going around: ${data.month}` : "",
      preferencePrompt(preferences),
      "",
      "Compare them honestly for a traveller. Cover atmosphere, cost, weather/season, how much time is needed, and how they differ from each other.",
      "Pick one as the best match and say plainly why. Keep every field short, warm and concrete — no marketing language, no bullet symbols.",
      "Include exactly one entry in `places` for each place listed above, in the same order, using the same names.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: CompareSchema }),
        reasoning: "low",
        prompt,
      });
      return result.output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("The comparison came back garbled. Try again.");
      }
      throw error;
    }
  });
