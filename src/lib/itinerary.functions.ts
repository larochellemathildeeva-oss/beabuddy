import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeItineraryMetrics, formatPlanForCompare } from "@/lib/itinerary-metrics";
import type { ComputedMetrics } from "@/lib/itinerary-metrics";

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
  source: z.enum(["vault", "new"]).nullish(),
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
    mode === "build"
      ? 'source: "vault" when the stop is one of the traveller\'s saved vault places listed below — keep that name. Otherwise "new".'
      : "source: null.",
    "summary: one warm sentence describing the plan overall.",
  ]
    .filter(Boolean)
    .join("\n");

async function runParse(
  model: Awaited<ReturnType<typeof gemini>>,
  data: z.infer<typeof ParseInput>,
  preferenceText: string,
): Promise<ParsedItinerary> {
  const text = instructions(
    data.tripCity,
    data.startDate,
    data.endDate,
    data.mode,
    data.pace,
    data.budgetLevel,
    data.currency,
    preferenceText,
  );

  const result = await generateText({
    model,
    output: Output.object({ schema: ParsedSchema }),
    reasoning: data.mode === "build" ? "medium" : "low",
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
          source: i.source === "vault" ? "vault" : data.mode === "build" ? "new" : null,
        })),
  };
}

export const parseItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ParseInput.parse(input))
  .handler(async ({ data, context }): Promise<ParsedItinerary> => {
    const model = await gemini();
    const { getTravelPreferences, preferencePrompt } = await import("@/lib/travel-preferences.server");
    const preferences = await getTravelPreferences(context);
    let extra = preferencePrompt(preferences);
    const { tagVaultItems, vaultPrompt } = await import("@/lib/vault-for-build");
    let recosForTag: import("@/lib/vault-for-build").VaultReco[] = [];
    if (data.mode === "build" && data.tripCity) {
      const city = data.tripCity;
      const [{ data: recos }, { data: notes }] = await Promise.all([
        context.supabase
          .from("recommendations")
          .select(
            "name, city, country, category, notes, recommended_by, lat, lon, pin_type, created_at",
          )
          .eq("user_id", context.userId)
          .ilike("city", `%${city}%`)
          .limit(40),
        context.supabase
          .from("future_notes")
          .select("city, note")
          .eq("user_id", context.userId)
          .ilike("city", `%${city}%`)
          .limit(20),
      ]);
      recosForTag = recos ?? [];
      const vault = vaultPrompt(city, recosForTag, notes ?? [], {
        tags: preferences.tags,
        preferredCountries: preferences.preferredCountries,
      });
      if (vault) extra = `${extra}\n\n${vault}`;
    }
    try {
      const parsed = await runParse(model, data, extra);
      if (data.mode === "build" && recosForTag.length) {
        return { ...parsed, items: tagVaultItems(parsed.items, recosForTag) };
      }
      return parsed;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Could not read that itinerary — try a clearer photo or paste the text.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });

const CompareInput = z.object({
  a: z.object({ label: z.string().max(60), text: z.string().min(10).max(20_000) }),
  b: z.object({ label: z.string().max(60), text: z.string().min(10).max(20_000) }),
  priorities: z.string().max(400).nullable(),
});

const ItemLabelSchema = z.object({
  title: z.string(),
  setting: z.enum(["indoor", "outdoor", "mixed"]),
  durationHours: z.number(),
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
  costLines: z.array(CostLineSchema),
  itemLabels: z.array(ItemLabelSchema),
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

export type ItineraryComparisonSide = Omit<z.infer<typeof SideSchema>, "itemLabels"> & {
  metrics: ComputedMetrics;
};
export type ItineraryComparison = Omit<z.infer<typeof CompareSchema>, "a" | "b"> & {
  a: ItineraryComparisonSide;
  b: ItineraryComparisonSide;
  reasoningText: string | null;
};
export type ItineraryComparisonDay = z.infer<typeof DayCompareSchema>;

export const compareItineraries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompareInput.parse(input))
  .handler(async ({ data, context }): Promise<ItineraryComparison> => {
    const model = await gemini();
    const { getTravelPreferences, preferencePrompt } = await import("@/lib/travel-preferences.server");
    const preferences = await getTravelPreferences(context);
    const homeCurrency = preferences.homeCurrency || "CAD";

    const parseSide = async (side: { label: string; text: string }) => {
      try {
        return await runParse(
          model,
          {
            imageDataUrls: null,
            text: side.text,
            tripCity: null,
            startDate: null,
            endDate: null,
            mode: "import",
            pace: null,
            budgetLevel: null,
            currency: homeCurrency,
          },
          preferencePrompt(preferences),
        );
      } catch (error) {
        if (NoObjectGeneratedError.isInstance(error)) {
          throw new Error(`Could not read ${side.label}. Try pasting a clearer plan.`);
        }
        const { aiFailure } = await import("@/lib/ai.server");
        throw aiFailure(error);
      }
    };

    const parsedA = await parseSide(data.a);
    const parsedB = await parseSide(data.b);
    const { judgmentCall } = await import("@/lib/ai.server");

    const prompt = [
      "Compare these two draft travel itineraries for the same traveller and help them choose.",
      "The app has already parsed both plans into stops. Judge from those lists. Do not invent extra stops.",
      formatPlanForCompare(data.a.label || "Plan A", parsedA.items),
      formatPlanForCompare(data.b.label || "Plan B", parsedB.items),
      data.priorities ? `What matters most to me: ${data.priorities}` : "",
      preferencePrompt(preferences),
      "",
      `Costs go in the traveller's home currency: ${homeCurrency}. Set currency to ${homeCurrency}.`,
      "itemLabels: one entry per parsed stop, in the same order, with the same title. setting is indoor, outdoor or mixed. durationHours is how long that stop takes.",
      "Do not output walking kilometres, transit minutes or longest-leg times — the app computes those only when it has coordinates.",
      "costLines: itemise each plan's estimated spend by category (Accommodation, Transport, Meals, Activities, Shopping, Other). Do not double-count and do not give a total — the app adds them up.",
      "days: one entry per day the plans cover. If the plans have different lengths, still emit one row per day and write \"nothing planned\" for the shorter plan — never pad it with invented activities.",
      "divergence is the most important field: say what actually differs that day and what the traveller trades for it. \"Both are food-focused\" is useless; \"A stays central while B loses 90 minutes crossing the bridge each way\" is the point.",
      "For each plan also fill: pace (how busy the days are), highlights (the standout moments), cost (what drives the spend), bestFor (the traveller it suits), watchOut (the real weakness).",
      "pick: the label of the plan you would choose. why: two plain sentences. Commit to an answer — a comparison with no recommendation is a table, not advice.",
      "mix: the single best thing to borrow from the plan you did not pick, and when to do it.",
      "Keep prose fields short and concrete. No bullet symbols, no marketing language. Never imply anything is booked or quoted.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: CompareSchema }),
        ...judgmentCall,
        prompt,
      });
      const finish = (
        side: z.infer<typeof SideSchema>,
        parsed: ParsedItinerary,
        label: string,
      ): ItineraryComparisonSide => {
        const costLines = side.costLines.length ? side.costLines : parsed.costs;
        const { itemLabels, ...prose } = side;
        return {
          ...prose,
          label,
          costLines,
          metrics: computeItineraryMetrics(parsed.items, costLines, itemLabels),
        };
      };
      return {
        ...result.output,
        currency: result.output.currency || homeCurrency,
        a: finish(result.output.a, parsedA, data.a.label || "Plan A"),
        b: finish(result.output.b, parsedB, data.b.label || "Plan B"),
        days: result.output.days.slice(0, 30),
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

export const OPTIMIZE_GOALS = [
  {
    id: "closest",
    label: "Closest together",
    hint: "Same-day clusters, less backtracking.",
  },
  {
    id: "rainy",
    label: "Rainy-day indoor",
    hint: "Museums, cafés and shops on one day.",
  },
  {
    id: "easy-morning",
    label: "Easy mornings",
    hint: "Later starts, lighter first half.",
  },
  {
    id: "rest",
    label: "Leave a rest day",
    hint: "One clearly quieter day.",
  },
  {
    id: "even",
    label: "Even pace",
    hint: "No day overloaded.",
  },
  {
    id: "food",
    label: "Meals first",
    hint: "Days arranged around sitting down to eat.",
  },
] as const;

export type OptimizeGoalId = (typeof OPTIMIZE_GOALS)[number]["id"];

const OptimizeGoals = z.array(
  z.enum(OPTIMIZE_GOALS.map((g) => g.id) as [OptimizeGoalId, ...OptimizeGoalId[]]),
);

const OptimizeItemIn = z.object({
  id: z.string().max(80),
  day_date: z.string().max(20).nullable(),
  time_label: z.string().max(40).nullable(),
  kind: z.string().max(40),
  title: z.string().max(200),
  detail: z.string().max(400).nullable(),
  address: z.string().max(240).nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
});

const OptimizeCityIn = z.object({
  city: z.string().max(120),
  country: z.string().max(80).nullable(),
  arrive_on: z.string().max(20).nullable(),
  depart_on: z.string().max(20).nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
});

const OptimizeInput = z.object({
  tripCity: z.string().max(120).nullable(),
  startDate: z.string().max(20).nullable(),
  endDate: z.string().max(20).nullable(),
  goals: OptimizeGoals.min(1).max(4),
  note: z.string().max(400).nullable(),
  items: z.array(OptimizeItemIn).min(2).max(60),
  cities: z.array(OptimizeCityIn).max(20),
});

const OptimizeItemOut = z.object({
  id: z.string(),
  day_date: z.string().nullable(),
  time_label: z.string().nullable(),
  position: z.number(),
  reason: z.string().nullable(),
});

const OptimizeSchema = z.object({
  summary: z.string(),
  changes: z.string(),
  items: z.array(OptimizeItemOut),
});

export type OptimizeItinerary = z.infer<typeof OptimizeSchema>;
export type OptimizeSourceItem = z.infer<typeof OptimizeItemIn>;
export type OptimizeSourceCity = z.infer<typeof OptimizeCityIn>;

const GOAL_PROMPT: Record<OptimizeGoalId, string> = {
  closest:
    "Cluster places that are near each other on the same day, in walking or short-transit order. Cut backtracking.",
  rainy:
    "Cluster indoor, museum, café and shopping activities so they can sit on a wet day. Put outdoor and walking things together on a fair-weather day. You do not have a weather forecast — do not invent rain or sunshine.",
  "easy-morning":
    "Start later. Put breakfast and nearby easy things first; heavier travel and big sights later.",
  rest: "Leave one day clearly lighter than the others — fewer moves, more breathing room.",
  even: "Spread activities so no day is overloaded and none is empty unless a rest day was also asked for.",
  food: "Anchor each day around meals. Don't stack two big restaurant stops with a long transfer between them.",
};

const FIXED_KINDS = new Set(["flight", "hotel", "reservation", "lodging"]);

export const optimizeItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OptimizeInput.parse(input))
  .handler(async ({ data, context }): Promise<OptimizeItinerary> => {
    const model = await gemini();
    const { getTravelPreferences, preferencePrompt } = await import(
      "@/lib/travel-preferences.server"
    );
    const preferences = await getTravelPreferences(context);
    const byId = new Map(data.items.map((item) => [item.id, item]));

    const prompt = [
      "Rearrange this existing trip timeline. Do not add new stops and do not drop any stop.",
      "Return every input id exactly once. Only change day_date, time_label and position.",
      "position is the order within the whole trip, starting at 0.",
      "Keep Flight, Hotel, Reservation and lodging items on their current date and time unless geography makes that impossible — then move them as little as possible and say so in reason.",
      data.tripCity ? `The trip is around ${data.tripCity}.` : "",
      data.startDate ? `Trip starts ${data.startDate}.` : "",
      data.endDate ? `Trip ends ${data.endDate}.` : "",
      "Optimise for:",
      ...data.goals.map((goal) => `- ${GOAL_PROMPT[goal]}`),
      data.note?.trim() ? `Traveller note: ${data.note.trim()}` : "",
      preferencePrompt(preferences),
      data.cities.length
        ? `Cities on this trip, in order:\n${data.cities
            .map(
              (city) =>
                `- ${city.city}${city.country ? `, ${city.country}` : ""}${
                  city.arrive_on || city.depart_on
                    ? ` (${[city.arrive_on, city.depart_on].filter(Boolean).join(" – ")})`
                    : ""
                }${city.lat != null && city.lon != null ? ` @ ${city.lat},${city.lon}` : ""}`,
            )
            .join("\n")}`
        : "",
      "Current timeline:",
      ...data.items.map(
        (item, index) =>
          `${index + 1}. id=${item.id} | ${item.day_date ?? "no date"} ${item.time_label ?? ""} | ${item.kind} | ${item.title}${
            item.address ? ` | ${item.address}` : ""
          }${item.lat != null && item.lon != null ? ` | ${item.lat},${item.lon}` : ""}${
            item.detail ? ` | ${item.detail}` : ""
          }`,
      ),
      "summary: one warm sentence on the new shape of the days.",
      "changes: two or three short sentences on what moved and why.",
      "reason: a few words per item, or null if it stayed put.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: OptimizeSchema }),
        reasoning: "medium",
        prompt,
      });
      const seen = new Set<string>();
      const rearranged = result.output.items
        .filter((item) => byId.has(item.id) && !seen.has(item.id) && seen.add(item.id))
        .map((item, index) => {
          const original = byId.get(item.id)!;
          const locked = FIXED_KINDS.has(original.kind.toLowerCase());
          return {
            id: item.id,
            day_date: locked ? original.day_date : item.day_date,
            time_label: locked ? original.time_label : item.time_label,
            position: index,
            reason: item.reason,
          };
        });
      for (const original of data.items) {
        if (seen.has(original.id)) continue;
        rearranged.push({
          id: original.id,
          day_date: original.day_date,
          time_label: original.time_label,
          position: rearranged.length,
          reason: null,
        });
      }
      return {
        summary: result.output.summary,
        changes: result.output.changes,
        items: rearranged,
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Béa couldn't rearrange that — try fewer goals, or try again.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });
