import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KINDS = ["Flight", "Hotel", "Reservation", "Transport", "Plan"] as const;

const ParseInput = z
  .object({
    imageDataUrls: z
      .array(z.string().startsWith("data:image/").max(3_000_000))
      .max(6)
      .nullable(),
    text: z.string().max(20_000).nullable(),
    tripCity: z.string().max(120).nullable(),
    startDate: z.string().max(20).nullable(),
    endDate: z.string().max(20).nullable(),
    mode: z.enum(["import", "build"]),
    pace: z.enum(["relaxed", "balanced", "full"]).nullable(),
    budgetLevel: z.enum(["value", "comfortable", "premium"]).nullable(),
    currency: z.string().max(3).nullable(),
  })
  .refine(
    (v) => v.mode === "build" || Boolean(v.imageDataUrls?.length || (v.text && v.text.trim())),
    { message: "Add a photo or paste an itinerary." },
  );

const ItemSchema = z.object({
  day_date: z.string().nullable(), // YYYY-MM-DD
  time_label: z.string().nullable(), // 09:00
  kind: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  estimated_cost: z.number().nullable(),
  currency: z.string().nullable(),
});

const CostSchema = z.object({
  label: z.string(),
  category: z.string(),
  amount: z.number(),
  currency: z.string(),
});

const ParsedSchema = z.object({
  summary: z.string(),
  trip_title: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  estimated_total: z.number().nullable(),
  currency: z.string().nullable(),
  costs: z.array(CostSchema),
  items: z.array(ItemSchema),
});

export type ParsedItinerary = z.infer<typeof ParsedSchema>;
export type ParsedItineraryItem = z.infer<typeof ItemSchema>;

async function gemini() {
  const { getGeminiModel } = await import("@/lib/ai.server");
  return getGeminiModel();
}

const instructions = (
  tripCity: string | null,
  startDate: string | null,
  endDate: string | null,
  mode: "import" | "build",
  pace: string | null,
  budgetLevel: string | null,
  currency: string | null,
  preferences: string,
) =>
  [
    mode === "build"
      ? "Build a practical, bookable trip from the traveller's request. Create a day-by-day itinerary, not just a loose list."
      : "Extract this travel itinerary into a complete trip with dates, estimated costs and an ordered day-by-day timeline.",
    `kind must be exactly one of: ${KINDS.join(", ")}.`,
    "title: short name of what is happening (flight number, hotel name, restaurant, activity).",
    "detail: one short line with the useful extras (confirmation number, address, terminal, duration). Null if there is nothing.",
    "day_date: YYYY-MM-DD when a date is stated or can be worked out. time_label: 24h HH:MM when a time is stated. Otherwise null.",
    tripCity ? `The trip is around ${tripCity}.` : "",
    startDate ? `The trip starts on ${startDate}; use it to resolve wording like 'day 2'.` : "",
    endDate ? `The trip ends on ${endDate}.` : "",
    pace ? `Requested pace: ${pace}.` : "",
    budgetLevel ? `Requested budget style: ${budgetLevel}.` : "",
    currency ? `Use ${currency} for all estimates.` : "Use a sensible currency for the destination.",
    preferences,
    mode === "import"
      ? "Never invent confirmed bookings, confirmation numbers or times that are not in the source. You may estimate realistic costs and clearly treat them as estimates."
      : "Use realistic opening patterns and travel times, but never claim an activity is booked. Avoid impossible transfers and leave breathing room.",
    "trip_title: a short useful name. start_date and end_date: YYYY-MM-DD when known or inferable, otherwise null.",
    "For every timeline item include an estimated_cost and currency when meaningful. Use zero only for genuinely free activities; otherwise null if unknowable.",
    "costs: grouped planned expenses using categories Accommodation, Transport, Meals, Activities, Shopping, or Other. Do not double-count. estimated_total must equal the costs sum.",
    "Keep the original order of each day and include enough detail to follow the plan.",
    "summary: one warm sentence describing the plan overall.",
  ]
    .filter(Boolean)
    .join("\n");

export const parseItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ParseInput.parse(input))
  .handler(async ({ data, context }): Promise<ParsedItinerary> => {
    const model = await gemini();
    const { getTravelPreferences, preferencePrompt } = await import("@/lib/travel-preferences.server");
    const preferences = await getTravelPreferences(context);
    const text = instructions(
      data.tripCity,
      data.startDate,
      data.endDate,
      data.mode,
      data.pace,
      data.budgetLevel,
      data.currency,
      preferencePrompt(preferences),
    );

    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: ParsedSchema }),
        reasoning: "low",
        messages: [
          {
            role: "user",
            content: data.imageDataUrls?.length
              ? [
                  {
                    type: "text" as const,
                    text:
                      data.imageDataUrls.length > 1
                        ? `${text}\n\nThe traveller attached ${data.imageDataUrls.length} pictures of the same trip. Read them all and merge them into ONE itinerary in chronological order, removing duplicates.${data.text?.trim() ? `\n\nExtra notes:\n${data.text}` : ""}`
                        : `${text}${data.text?.trim() ? `\n\nExtra notes:\n${data.text}` : ""}`,
                  },
                  ...data.imageDataUrls.map((image) => ({ type: "image" as const, image })),
                ]
              : [
                  {
                    type: "text" as const,
                    text: data.text?.trim()
                      ? `${text}\n\nItinerary:\n${data.text}`
                      : `${text}\n\nThe traveller gave no extra notes. Build the trip from the destination, dates, pace, budget style and their saved preferences alone.`,
                  },
                ],
          },
        ],
      });
      const out = result.output;
      return {
        ...out,
        items: out.items.slice(0, 60).map((i) => ({
          ...i,
          kind: (KINDS as readonly string[]).includes(i.kind) ? i.kind : "Plan",
        })),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Could not read that itinerary — try a clearer photo or paste the text.");
      }
      throw error;
    }
  });

const CompareInput = z.object({
  a: z.object({ label: z.string().max(60), text: z.string().min(10).max(20_000) }),
  b: z.object({ label: z.string().max(60), text: z.string().min(10).max(20_000) }),
  priorities: z.string().max(400).nullable(),
});

const MetricsSchema = z.object({
  estimatedCost: z.number(), // total, in the traveller's home currency (recomputed in code)
  activeHoursPerDay: z.number(),
  transitMinutesPerDay: z.number(),
  stopCount: z.number(),
  walkingKmPerDay: z.number(),
  indoorShare: z.number(), // 0-1
  longestTravelLegMinutes: z.number(),
});

const CostLineSchema = z.object({
  label: z.string(),
  category: z.string(),
  amount: z.number(),
});

const SideSchema = z.object({
  label: z.string(),
  pace: z.string(),
  highlights: z.string(),
  cost: z.string(),
  bestFor: z.string(),
  watchOut: z.string(),
  metrics: MetricsSchema,
  costLines: z.array(CostLineSchema),
});

const DayCompareSchema = z.object({
  dayNumber: z.number(),
  date: z.string().nullable(),
  aMorning: z.string(),
  aAfternoon: z.string(),
  aEvening: z.string(),
  bMorning: z.string(),
  bAfternoon: z.string(),
  bEvening: z.string(),
  divergence: z.string(),
});

const CompareSchema = z.object({
  headline: z.string(),
  pick: z.string(),
  why: z.string(),
  currency: z.string(),
  a: SideSchema,
  b: SideSchema,
  days: z.array(DayCompareSchema),
  mix: z.string(),
});

export type ItineraryComparison = z.infer<typeof CompareSchema>;
export type ItineraryComparisonSide = z.infer<typeof SideSchema>;
export type ItineraryComparisonDay = z.infer<typeof DayCompareSchema>;

export const compareItineraries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompareInput.parse(input))
  .handler(async ({ data, context }): Promise<ItineraryComparison> => {
    const model = await gemini();
    const { getTravelPreferences, preferencePrompt } = await import("@/lib/travel-preferences.server");
    const preferences = await getTravelPreferences(context);
    const homeCurrency = preferences.homeCurrency || "CAD";

    const prompt = [
      "Compare these two draft travel itineraries for the same traveller and help them choose.",
      `--- Plan A (${data.a.label}) ---`,
      data.a.text,
      `--- Plan B (${data.b.label}) ---`,
      data.b.text,
      data.priorities ? `What matters most to me: ${data.priorities}` : "",
      preferencePrompt(preferences),
      "",
      "Measure both plans on exactly the same axes with the same units. Never describe one plan in a dimension you did not measure for the other.",
      `Use numbers, not adjectives, wherever a number is possible. Never write "moderate", "high" or "reasonable" about cost or time without a figure beside it. Costs go in the traveller's home currency: ${homeCurrency}. Set currency to ${homeCurrency}.`,
      "Every number is an estimate — never imply anything is booked or quoted.",
      "metrics: fill every field for both plans. indoorShare is a fraction between 0 and 1.",
      "costLines: itemise each plan's estimated spend by category (Accommodation, Transport, Meals, Activities, Shopping, Other). Do not double-count and do not give a total — the app adds them up.",
      "days: one entry per day the plans cover. If the plans have different lengths, still emit one row per day and write \"nothing planned\" for the shorter plan — never pad it with invented activities.",
      "divergence is the most important field: say what actually differs that day and what the traveller trades for it. \"Both are food-focused\" is useless; \"A stays central while B loses 90 minutes crossing the bridge each way\" is the point.",
      "For each plan also fill: pace (how busy the days are), highlights (the standout moments), cost (what drives the spend), bestFor (the traveller it suits), watchOut (the real weakness).",
      "pick: the label of the plan you would choose. why: two plain sentences. Commit to an answer — a comparison with no recommendation is a table, not advice.",
      "mix: the single best thing to borrow from the plan you did not pick, and when to do it.",
      "Keep prose fields short and concrete. No bullet symbols, no marketing language.",
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
      // Sum the cost lines in code — language models get arithmetic wrong and these
      // figures flow into the traveller's budget.
      const withTotal = (side: ItineraryComparisonSide, label: string) => ({
        ...side,
        label,
        metrics: {
          ...side.metrics,
          estimatedCost: Math.round(side.costLines.reduce((sum, line) => sum + line.amount, 0)),
        },
      });
      return {
        ...result.output,
        currency: result.output.currency || homeCurrency,
        a: withTotal(result.output.a, data.a.label || "Plan A"),
        b: withTotal(result.output.b, data.b.label || "Plan B"),
        days: result.output.days.slice(0, 30),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("The comparison came back garbled. Try again.");
      }
      throw error;
    }
  });
