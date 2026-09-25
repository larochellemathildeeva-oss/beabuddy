import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { filePartsFromDataUrls, pdfPartFromDataUrl } from "@/lib/ai-image";
import { MAX_PDF_DATA_URL_LENGTH, PDF_DATA_URL_PREFIX } from "@/lib/itinerary-pdf";
import { IcsReadError, icsToParsedItinerary } from "@/lib/itinerary-ics";
import { readFetchedLink } from "@/lib/itinerary-link";
import { AI_CALL } from "@/lib/ai-errors";
import { computeItineraryMetrics, formatPlanForCompare } from "@/lib/itinerary-metrics";
import type { ComputedMetrics } from "@/lib/itinerary-metrics";
import { applyCostPolicy, mergeAlternativeItems } from "@/lib/itinerary-plan";
import { stripEmbeddedMapsUrl } from "@/lib/timeline-directions";
import { TIMELINE_KINDS, normaliseKind } from "@/lib/timeline-kind";
import type { DayOutcome } from "@/lib/route-optimize";
import { foldTravelLegs, normalizeClock } from "@/lib/import-stop";
import { readPlainPlan } from "@/lib/plan-lines";

/**
 * One vocabulary, shared with the rest of the app.
 *
 * This list used to be five capitalised words of its own invention, and every
 * imported row that was not a flight or a hotel became "Plan" — a kind nothing
 * downstream recognised. TIMELINE_KINDS is what the glyphs, the vault
 * categories and the prep checks already read.
 */
const KINDS = TIMELINE_KINDS;

const ParseInput = z
  .object({
    imageDataUrls: z.array(z.string().startsWith("data:image/").max(3_000_000)).max(6).nullable(),
    /** One PDF of the plan: a booking confirmation, a tour document, an export. */
    pdfDataUrl: z.string().startsWith(PDF_DATA_URL_PREFIX).max(MAX_PDF_DATA_URL_LENGTH).nullish(),
    text: z.string().max(20_000).nullable(),
    /** A link to the plan: a tour page, a blog itinerary, a calendar feed. */
    pageUrl: z.string().url().max(2_000).nullish(),
    tripCity: z.string().max(120).nullable(),
    startDate: z.string().max(20).nullable(),
    endDate: z.string().max(20).nullable(),
    mode: z.enum(["import", "build"]),
    pace: z.enum(["relaxed", "balanced", "full"]).nullable(),
    budgetLevel: z.enum(["value", "comfortable", "premium"]).nullable(),
    currency: z.string().max(3).nullable(),
    includeCosts: z.boolean().optional().default(false),
  })
  .refine(
    (v) =>
      v.mode === "build" ||
      Boolean(v.imageDataUrls?.length || v.pdfDataUrl || v.pageUrl || (v.text && v.text.trim())),
    { message: "Add a photo or a PDF, or paste an itinerary." },
  );

const ItemSchema = z.object({
  day_date: z.string().nullable(), // YYYY-MM-DD
  /**
   * Which numbered day this belongs to, when the source counts days instead
   * of naming dates — which is nearly every pasted itinerary. Resolved into a
   * real day_date once the trip's start date is known.
   */
  day_number: z.number().nullable(),
  time_label: z.string().nullable(), // 09:00
  /** When it ends, if the source says. With time_label, the planned stay. */
  end_time: z.string().nullish(),
  /** How long it lasts, if the source says ("2h", "45 min"). */
  duration_minutes: z.number().nullish(),
  kind: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  /**
   * Where it is, pulled out of the prose so it can be looked up. These used
   * to live inside `detail`, and a pattern match had to find them again —
   * which is how a stop's address got lost and a namesake got pinned.
   */
  place: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  estimated_cost: z.number().nullable(),
  currency: z.string().nullable(),
  source: z.enum(["vault", "new"]).nullish(),
  /**
   * The source says this is already booked ("BOOKED", "✅", a confirmation
   * number). Saved as the stop's Booked mark, not guessed.
   */
  booked: z.boolean().nullish(),
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

/** Prefer withGemini so a rate-limit can fall through to GEMINI_FALLBACK_MODEL. */
async function withGemini<T>(
  run: (model: ReturnType<(typeof import("@/lib/ai.server"))["getGeminiModel"]>) => Promise<T>,
): Promise<T> {
  const { withModelFallback } = await import("@/lib/ai.server");
  return withModelFallback(run);
}

const instructions = (
  tripCity: string | null,
  startDate: string | null,
  endDate: string | null,
  mode: "import" | "build",
  pace: string | null,
  budgetLevel: string | null,
  currency: string | null,
  includeCosts: boolean,
  preferences: string,
) =>
  [
    mode === "build"
      ? "Build a practical, bookable trip from the traveller's request. Create a day-by-day itinerary, not just a loose list."
      : includeCosts
        ? "Extract this travel itinerary into a complete trip with dates, estimated costs and an ordered day-by-day timeline."
        : "Extract this travel itinerary into a complete trip with dates and an ordered day-by-day timeline.",
    `kind must be exactly one of: ${KINDS.join(", ")}.`,
    "Pick the kind by what the entry is: meal for anything eaten or drunk, sight for a museum, landmark, market or viewpoint, walk for a stroll or hike, transport for getting between places, lodging for where you sleep, note for a reminder, activity for anything else. Use flight, hotel or reservation only for something actually booked.",
    "title: short name of what is happening (flight number, hotel name, restaurant, activity).",
    "detail: one short line with the useful extras (confirmation number, address, terminal, duration). Null if there is nothing.",
    "day_date: YYYY-MM-DD when a date is stated or can be worked out. time_label: 24h HH:MM when a time is stated. Otherwise null.",
    'end_time: 24h HH:MM when the source gives when it ends ("10:00–12:00"). duration_minutes: when it gives a length ("2h", "45 min"). Otherwise null — never guess either.',
    'place: the venue or landmark as it would be found on a map, in the source\'s wording, including a local-language name if the source gives one ("Itsukushima Shrine (厳島神社)"). One place only: when an entry names several ("Peace Park / Atomic Bomb Dome / Cenotaph", "Shrine + Great Torii"), the first or main one. For a train, ferry, bus or flight, where it leaves from — the station, pier or airport ("Motoyasubashi Pier", "Hiroshima Station"); for an arrival, where you arrive. For a reminder about a place ("Be at the ferry area"), that place. Null only for a note with no place at all.',
    "address: the street address only when the source gives one, exactly as written. Never invent or complete an address.",
    mode === "import"
      ? 'booked: true when the source marks the entry as booked, reserved, confirmed or ticketed ("BOOKED", "🎟️ booked", "✅", a confirmation number). false otherwise, including when it says no booking is needed.'
      : "booked: false.",
    "city: the town or city the stop is in, when the source says or the context makes it plain (a day trip to Miyajima, a night in Kyoto). Null when unsure.",
    'day_number: which day of the trip this is, counting from 1, whenever the source groups things into days — "Day 1", "Day 2", "first morning", a second day\'s heading. Set it even when no calendar date is given; that is the normal case and it is how the days survive. Null only when the entry belongs to no particular day.',
    tripCity ? `The trip is around ${tripCity}.` : "",
    startDate
      ? `The trip starts on ${startDate}; use it to resolve wording like 'day 2', and for the year of a date the source gives without one. When the source names its own dates, keep them even if they disagree with the trip's — the traveller is asked which is right.`
      : "",
    endDate ? `The trip ends on ${endDate}.` : "",
    pace ? `Requested pace: ${pace}.` : "",
    budgetLevel ? `Requested budget style: ${budgetLevel}.` : "",
    includeCosts && currency
      ? `Use ${currency} for all estimates.`
      : includeCosts
        ? "Use a sensible currency for the destination."
        : "",
    preferences,
    mode === "import"
      ? includeCosts
        ? "Never invent confirmed bookings, confirmation numbers or times that are not in the source. You may estimate realistic costs and clearly treat them as estimates."
        : "Never invent confirmed bookings, confirmation numbers or times that are not in the source."
      : "Use realistic opening patterns and travel times, but never claim an activity is booked. Avoid impossible transfers and leave breathing room.",
    "Béa cannot check availability or make a reservation. Phrase hotels, restaurants and tickets as suggestions the traveller must book and confirm themselves. Never say a table, room or ticket is held or available.",
    "trip_title: a short useful name. start_date and end_date: YYYY-MM-DD when known or inferable, otherwise null.",
    includeCosts
      ? "For every timeline item include an estimated_cost and currency when meaningful. Use zero only for genuinely free activities; otherwise null if unknowable."
      : "Do not estimate prices. Set every estimated_cost to null, costs to an empty list, and estimated_total to null.",
    includeCosts
      ? "costs: grouped planned expenses using categories Accommodation, Transport, Meals, Activities, Shopping, or Other. Do not double-count. estimated_total must equal the costs sum."
      : "",
    "Keep the original order of each day and include enough detail to follow the plan.",
    'Do not make an entry for getting from one stop to the next ("Travel to X", "Walk to Y", "Take the tram to Z"). Put it in the next entry\'s detail as "Getting there: …", keeping any departure time. A booked flight, train or ferry is still its own entry, with or without a confirmation number.',
    mode === "build"
      ? 'source: "vault" when the stop is one of the traveller\'s saved vault places listed below — keep that name. Otherwise "new".'
      : "source: null.",
    "summary: one warm sentence describing the plan overall.",
  ]
    .filter(Boolean)
    .join("\n");

/** What to say about the attached files, so they are read as one plan. */
function attachedNote(pictures: number, hasPdf: boolean): string {
  const pdfNote =
    "The traveller attached a PDF of their plan — a booking confirmation, a tour document or an exported itinerary. Read every page. Ignore terms and conditions, adverts and fare rules; keep what happens when and where, and any confirmation numbers.";
  if (hasPdf && pictures > 0) {
    return `${pdfNote} They also attached ${pictures === 1 ? "a picture" : `${pictures} pictures`} of the same trip. Merge everything into ONE itinerary in chronological order, removing duplicates.`;
  }
  if (hasPdf) return pdfNote;
  if (pictures > 1) {
    return `The traveller attached ${pictures} pictures of the same trip. Read them all and merge them into ONE itinerary in chronological order, removing duplicates.`;
  }
  return "";
}

/** Exported for scripts/itinerary-audit, which runs the real prompt on fixtures. */
export async function runParse(
  model: ReturnType<(typeof import("@/lib/ai.server"))["getGeminiModel"]>,
  data: z.infer<typeof ParseInput>,
  preferenceText: string,
  /** For the audit: the model's rows before any clean-up. */
  onRaw?: (items: readonly ParsedItineraryItem[]) => void,
): Promise<ParsedItinerary> {
  const text = instructions(
    data.tripCity,
    data.startDate,
    data.endDate,
    data.mode,
    data.pace,
    data.budgetLevel,
    data.currency,
    Boolean(data.includeCosts),
    preferenceText,
  );

  // Files are only read for a plan the traveller already has.
  const images = data.mode === "import" ? (data.imageDataUrls ?? []) : [];
  const pdf = data.mode === "import" && data.pdfDataUrl ? data.pdfDataUrl : null;
  const importFiles = [...(pdf ? [pdfPartFromDataUrl(pdf)] : []), ...filePartsFromDataUrls(images)];

  const result = await generateText({
    model,
    ...AI_CALL,
    output: Output.object({ schema: ParsedSchema }),
    reasoning: data.mode === "build" ? "medium" : "low",
    messages: [
      {
        role: "user",
        content: importFiles.length
          ? [
              {
                type: "text" as const,
                text: `${text}\n\n${attachedNote(images.length, Boolean(pdf))}${data.text?.trim() ? `\n\nExtra notes:\n${data.text}` : ""}`,
              },
              ...importFiles,
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
  onRaw?.(out.items);
  const parsed: ParsedItinerary = {
    ...out,
    // Travel legs the model made anyway become notes on the stop they lead to.
    // Kinds normalised first, so the fold sees "transport" however it was
    // spelt; the times too, so a folded note carries a readable time.
    items: foldTravelLegs(
      out.items.slice(0, 60).map((i) => ({
        ...i,
        // A time the timeline cannot sort is worse than none.
        time_label: normalizeClock(i.time_label),
        end_time: normalizeClock(i.end_time),
        kind: normaliseKind(i.kind),
        // Only a plan the traveller already has can hold a booking; a plan
        // Béa drafts never does, whatever the model said.
        booked: data.mode === "import" && i.booked === true,
        source:
          i.source === "vault"
            ? ("vault" as const)
            : data.mode === "build"
              ? ("new" as const)
              : null,
      })),
    ),
  };
  return applyCostPolicy(parsed, Boolean(data.includeCosts));
}

type PlanContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

async function loadBuildExtra(
  context: PlanContext,
  tripCity: string | null,
  mode: "import" | "build",
) {
  const { getTravelPreferences, preferencePrompt } =
    await import("@/lib/travel-preferences.server");
  const preferences = await getTravelPreferences(context);
  let extra = preferencePrompt(preferences);
  const { tagVaultItems, vaultPrompt } = await import("@/lib/vault-for-build");
  let recosForTag: import("@/lib/vault-for-build").VaultReco[] = [];
  if (mode === "build" && tripCity) {
    const city = tripCity;
    const recoCols =
      "name, city, country, category, notes, recommended_by, lat, lon, pin_type, created_at";
    const [{ data: recos, error: recoError }, { data: notes }] = await Promise.all([
      context.supabase
        .from("recommendations")
        .select(`${recoCols}, travel_tags`)
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
    const { isMissingTravelTagsColumn } = await import("@/lib/reco-tags");
    if (recoError && isMissingTravelTagsColumn(recoError)) {
      const retry = await context.supabase
        .from("recommendations")
        .select(recoCols)
        .eq("user_id", context.userId)
        .ilike("city", `%${city}%`)
        .limit(40);
      recosForTag = (retry.data ?? []) as import("@/lib/vault-for-build").VaultReco[];
    } else {
      recosForTag = (recos ?? []) as import("@/lib/vault-for-build").VaultReco[];
    }
    const vault = vaultPrompt(city, recosForTag, notes ?? [], {
      tags: preferences.tags,
      preferredCountries: preferences.preferredCountries,
    });
    if (vault) extra = `${extra}\n\n${vault}`;
  }
  return { extra, recosForTag, tagVaultItems };
}

function finishBuild(
  parsed: ParsedItinerary,
  mode: "import" | "build",
  recosForTag: import("@/lib/vault-for-build").VaultReco[],
  tagVaultItems: (typeof import("@/lib/vault-for-build"))["tagVaultItems"],
): ParsedItinerary {
  if (mode === "build" && recosForTag.length) {
    return { ...parsed, items: tagVaultItems(parsed.items, recosForTag) };
  }
  return parsed;
}

/**
 * Open a pasted link and say what it holds. The fetch is the guarded one
 * place links use: https only, public addresses only, re-checked each hop.
 */
async function readItineraryLink(
  href: string,
): Promise<
  { kind: "calendar"; plan: ParsedItinerary } | { kind: "page"; text: string; url: string }
> {
  const { fetchPublicHtml, UnsupportedPlaceUrlError } = await import("@/lib/place-url");
  const url = new URL(href);
  let fetched: Awaited<ReturnType<typeof fetchPublicHtml>>;
  try {
    fetched = await fetchPublicHtml(href);
  } catch (error) {
    if (error instanceof UnsupportedPlaceUrlError) {
      throw new Error("Use a normal https link — not a private or local address.");
    }
    throw new Error(
      "Béa couldn't open that page. Copy the plan from it and paste it here instead.",
    );
  }
  const content = readFetchedLink(fetched, url.hostname);
  if (content.kind === "failed") throw new Error(content.message);
  if (content.kind === "calendar") {
    try {
      return { kind: "calendar", plan: icsToParsedItinerary(content.text) };
    } catch (error) {
      if (error instanceof IcsReadError) throw new Error(error.message);
      throw error;
    }
  }
  return { kind: "page", text: content.text, url: fetched.finalUrl };
}

/** The pasted text read without a model, when it is plainly a list. */
export function readPlainAsList(data: z.infer<typeof ParseInput>): ParsedItinerary | null {
  if (data.mode !== "import" || data.includeCosts) return null;
  if (data.pageUrl || data.pdfDataUrl || data.imageDataUrls?.length || !data.text) return null;
  return readPlainPlan(data.text, { startDate: data.startDate, tripCity: data.tripCity });
}

export const parseItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ParseInput.parse(input))
  .handler(async ({ data: input, context }): Promise<ParsedItinerary> => {
    let data = input;
    // A pasted plan that is already a tidy list is read as a list: exactly,
    // and without AI. Anything less plain still goes to the model.
    const plain = readPlainAsList(input);
    if (plain) return plain;
    if (data.mode === "import" && data.pageUrl) {
      const page = await readItineraryLink(data.pageUrl);
      // A calendar feed is read as a calendar: exactly, and without AI.
      if (page.kind === "calendar") return page.plan;
      data = {
        ...data,
        text: `The itinerary below is the text of the web page ${page.url}. Skip navigation, adverts, comments, author bios and related posts.\n\n${page.text}${data.text?.trim() ? `\n\nThe traveller's notes:\n${data.text}` : ""}`,
      };
    }
    const { extra, recosForTag, tagVaultItems } = await loadBuildExtra(
      context,
      data.tripCity,
      data.mode,
    );
    try {
      return await withGemini(async (model) => {
        const parsed = await runParse(model, data, extra);
        return finishBuild(parsed, data.mode, recosForTag, tagVaultItems);
      });
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Could not read that itinerary — try a clearer photo or paste the text.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });

const ReviseItemIn = ItemSchema.extend({
  title: z.string().max(200),
  detail: z.string().max(400).nullable(),
});

const ReviseInput = z
  .object({
    tripCity: z.string().max(120).nullable(),
    startDate: z.string().max(20).nullable(),
    endDate: z.string().max(20).nullable(),
    pace: z.enum(["relaxed", "balanced", "full"]).nullable(),
    budgetLevel: z.enum(["value", "comfortable", "premium"]).nullable(),
    currency: z.string().max(3).nullable(),
    includeCosts: z.boolean(),
    originalRequest: z.string().max(20_000).nullable(),
    items: z.array(ReviseItemIn).min(1).max(60),
    selectedIndexes: z.array(z.number().int().min(0).max(59)).max(40),
    reason: z.string().trim().min(3).max(800),
    mode: z.enum(["alternatives", "rebuild"]),
  })
  .refine((v) => v.mode === "rebuild" || v.selectedIndexes.length > 0, {
    message: "Tick the stops you want alternatives for.",
  })
  .refine((v) => v.selectedIndexes.every((i) => i < v.items.length), {
    message: "One of those stops is no longer on the draft.",
  });

const AlternativesSchema = z.object({
  summary: z.string(),
  items: z.array(ItemSchema),
  estimated_total: z.number().nullable(),
  currency: z.string().nullable(),
  costs: z.array(CostSchema),
});

function formatDraftItems(items: z.infer<typeof ReviseItemIn>[]) {
  return items
    .map((item, index) => {
      const when = [item.day_date, item.time_label].filter(Boolean).join(" ");
      return `${index + 1}. [${item.kind}] ${item.title}${when ? ` (${when})` : ""}${
        item.detail ? ` — ${item.detail}` : ""
      }`;
    })
    .join("\n");
}

export const reviseItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReviseInput.parse(input))
  .handler(async ({ data, context }): Promise<ParsedItinerary> => {
    const { extra, recosForTag, tagVaultItems } = await loadBuildExtra(
      context,
      data.tripCity,
      "build",
    );

    if (data.mode === "rebuild") {
      const rebuildText = [
        data.originalRequest?.trim() ? `Original request:\n${data.originalRequest.trim()}` : "",
        "Previous draft:",
        formatDraftItems(data.items),
        `Rebuild the whole trip. The traveller wants this change: ${data.reason}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      try {
        return await withGemini(async (model) => {
          const parsed = await runParse(
            model,
            {
              imageDataUrls: null,
              text: rebuildText,
              tripCity: data.tripCity,
              startDate: data.startDate,
              endDate: data.endDate,
              mode: "build",
              pace: data.pace,
              budgetLevel: data.budgetLevel,
              currency: data.currency,
              includeCosts: data.includeCosts,
            },
            extra,
          );
          return finishBuild(parsed, "build", recosForTag, tagVaultItems);
        });
      } catch (error) {
        if (NoObjectGeneratedError.isInstance(error)) {
          throw new Error("Béa couldn't rebuild that — try a shorter note, or try again.");
        }
        const { aiFailure } = await import("@/lib/ai.server");
        throw aiFailure(error);
      }
    }

    const chosen = data.selectedIndexes.map((index) => ({
      index,
      item: data.items[index]!,
    }));
    const keepLines = data.items
      .map((item, index) => ({ item, index }))
      .filter(({ index }) => !data.selectedIndexes.includes(index))
      .map(({ item, index }) => `${index + 1}. ${item.title} — keep this stop as it is.`);
    const prompt = [
      "The traveller likes most of this draft. Replace only the ticked stops with alternatives.",
      data.tripCity ? `The trip is around ${data.tripCity}.` : "",
      data.startDate ? `Trip starts ${data.startDate}.` : "",
      data.endDate ? `Trip ends ${data.endDate}.` : "",
      extra,
      `Why they want a change: ${data.reason}`,
      keepLines.length ? `Do not change these:\n${keepLines.join("\n")}` : "",
      `Return exactly ${chosen.length} replacement stop${chosen.length === 1 ? "" : "s"}, in this same order:`,
      ...chosen.map(
        ({ item, index }, i) =>
          `${i + 1}. Replace #${index + 1} "${item.title}"${
            item.day_date ? ` on ${item.day_date}` : ""
          }${item.time_label ? ` at ${item.time_label}` : ""}. Keep the same day when you can.`,
      ),
      `kind must be exactly one of: ${KINDS.join(", ")}.`,
      "Each replacement must be a real alternative — not the same place rephrased.",
      "Béa cannot check availability or make a reservation. Never say a table, room or ticket is held.",
      data.includeCosts
        ? "Include estimated_cost and currency when meaningful. costs: grouped planned expenses for the replacements only."
        : "Do not estimate prices. Set every estimated_cost to null, costs to an empty list, and estimated_total to null.",
      "summary: one warm sentence on what changed.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      return await withGemini(async (model) => {
        const result = await generateText({
          model,
          ...AI_CALL,
          output: Output.object({ schema: AlternativesSchema }),
          reasoning: "medium",
          prompt,
        });
        const replacements = result.output.items.slice(0, chosen.length).map((item) => ({
          ...item,
          time_label: normalizeClock(item.time_label),
          end_time: normalizeClock(item.end_time),
          kind: normaliseKind(item.kind),
          source: item.source === "vault" ? ("vault" as const) : ("new" as const),
        }));
        const merged = mergeAlternativeItems(data.items, replacements, data.selectedIndexes);
        const parsed = applyCostPolicy(
          {
            summary: result.output.summary,
            trip_title: "",
            start_date: data.startDate,
            end_date: data.endDate,
            estimated_total: result.output.estimated_total,
            currency: result.output.currency ?? data.currency,
            costs: data.includeCosts ? result.output.costs : [],
            items: merged,
          },
          data.includeCosts,
        );
        return finishBuild(parsed, "build", recosForTag, tagVaultItems);
      });
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Béa couldn't find alternatives — try a shorter note, or try again.");
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
    const { getTravelPreferences, preferencePrompt } =
      await import("@/lib/travel-preferences.server");
    const preferences = await getTravelPreferences(context);
    const homeCurrency = preferences.homeCurrency || "CAD";

    const parseSide = async (side: { label: string; text: string }) => {
      try {
        return await withGemini((model) =>
          runParse(
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
              includeCosts: true,
            },
            preferencePrompt(preferences),
          ),
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
      'days: one entry per day the plans cover. If the plans have different lengths, still emit one row per day and write "nothing planned" for the shorter plan — never pad it with invented activities.',
      'divergence is the most important field: say what actually differs that day and what the traveller trades for it. "Both are food-focused" is useless; "A stays central while B loses 90 minutes crossing the bridge each way" is the point.',
      "For each plan also fill: pace (how busy the days are), highlights (the standout moments), cost (what drives the spend), bestFor (the traveller it suits), watchOut (the real weakness).",
      "pick: the label of the plan you would choose. why: two plain sentences. Commit to an answer — a comparison with no recommendation is a table, not advice.",
      "mix: the single best thing to borrow from the plan you did not pick, and when to do it.",
      "Keep prose fields short and concrete. No bullet symbols, no marketing language. Never imply anything is booked or quoted.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { judgmentCall } = await import("@/lib/ai.server");
      const result = await withGemini((model) =>
        generateText({
          model,
          ...AI_CALL,
          output: Output.object({ schema: CompareSchema }),
          ...judgmentCall,
          prompt,
        }),
      );
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
    id: "hours",
    label: "Open when you get there",
    hint: "Each day ordered around opening hours and the distances between stops.",
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

export const OPTIMIZE_MAX_ITEMS = 150;

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
  planned_stay_minutes: z.number().int().min(1).max(44_640).nullish(),
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
  items: z.array(OptimizeItemIn).min(2).max(OPTIMIZE_MAX_ITEMS),
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

/** Time between stops within each day, before and after, estimated from the pins. */
export type OptimizeTravel = {
  beforeSec: number;
  afterSec: number;
  mode: "walk" | "drive" | "mixed";
  /** The new arrangement's journeys on real routes, when every one was checked. */
  checkedSec?: number;
};

export type OptimizeItinerary = z.infer<typeof OptimizeSchema> & {
  /** Present when there were pinned stops to time; the rearrangement is judged on them. */
  travel?: OptimizeTravel | null;
  /** How many days were put in order around opening hours. */
  plannedDays?: number;
  /** Days put in order again because a real route was much longer than the map suggested. */
  recheckedDays?: number;
  /** Today's share of place and route lookups was spent, so some checks were skipped. */
  limited?: boolean;
};
export type OptimizeSourceItem = z.infer<typeof OptimizeItemIn>;
export type OptimizeSourceCity = z.infer<typeof OptimizeCityIn>;

const GOAL_PROMPT: Record<OptimizeGoalId, string> = {
  closest:
    "Cluster places that are near each other on the same day, in walking or short-transit order. Cut backtracking.",
  hours:
    "Put each stop on a day it is likely open — where hours are listed, use them. The order and times within each day are then fitted to opening hours and the distances between stops, so do not agonise over exact times.",
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
    const { getTravelPreferences, preferencePrompt } =
      await import("@/lib/travel-preferences.server");
    const preferences = await getTravelPreferences(context);
    // Normalize at the server boundary — do not trust the client strip alone.
    const items = data.items.map((item) => ({
      ...item,
      detail: stripEmbeddedMapsUrl(item.detail) || null,
    }));
    const byId = new Map(items.map((item) => [item.id, item]));

    // Travel times estimated from the pins, for nothing. Opening hours are the
    // one lookup, and only for the goal that uses them; any failure there
    // leaves Optimize as it was, without hours.
    const planHours = data.goals.includes("hours");
    const {
      checkedTotal,
      estimatedTables,
      isSurprise,
      legKey,
      legsOf,
      minutesLabel,
      neighbourLines,
      planDays,
      travelTimeFrom,
      travelTotal,
      withChecked,
    } = await import("@/lib/route-optimize");
    const tables = estimatedTables(items);
    const listed = planHours
      ? await import("@/lib/geo-provider.server")
          .then(async (m) => {
            const routes = await import("@/lib/route-optimize.server");
            return routes.hoursFor(m.geoProvider(), items, Date.now() + 15_000);
          })
          .catch(() => null)
      : null;
    const hours = listed?.hours ?? new Map<string, string>();
    // Today's share of Geoapify credits ran out before the hours were looked up.
    const hoursLimited = Boolean(listed?.limited);
    const nearest = neighbourLines(tables);

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
      ...items.map(
        (item, index) =>
          `${index + 1}. id=${item.id} | ${item.day_date ?? "no date"} ${item.time_label ?? ""} | ${item.kind} | ${item.title}${
            item.address ? ` | ${item.address}` : ""
          }${item.lat != null && item.lon != null ? ` | ${item.lat},${item.lon}` : ""}${
            hours.has(item.id) ? ` | hours: ${hours.get(item.id)}` : ""
          }${item.detail ? ` | ${item.detail}` : ""}`,
      ),
      nearest.length
        ? `Estimated travel times between pinned stops, from their map positions — each stop's nearest few. Use these to judge what is close, over guesses from names:\n${nearest.join("\n")}`
        : "",
      "summary: one warm sentence on the new shape of the days.",
      "changes: two or three short sentences on what moved and why.",
      "reason: a few words per item, or null if it stayed put.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const result = await withGemini((model) =>
        generateText({
          model,
          ...AI_CALL,
          output: Output.object({ schema: OptimizeSchema }),
          reasoning: "medium",
          prompt,
        }),
      );
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

      // The model chose the days; each one is then put in its best order
      // around opening hours, on the estimated travel times. Days with fewer
      // than two stops keep the model's order.
      const asStops = () => rearranged.map((row) => ({ ...byId.get(row.id)!, ...row }));
      const applyDays = (outcomes: Map<string, DayOutcome>): number => {
        let applied = 0;
        for (const [date, outcome] of outcomes) {
          const slots = rearranged.flatMap((row, i) => (row.day_date === date ? [i] : []));
          const rows = new Map(slots.map((i) => [rearranged[i]!.id, rearranged[i]!]));
          if (outcome.order.length !== slots.length) continue;
          outcome.order.forEach((next, k) => {
            const row = rows.get(next.id);
            if (!row) return;
            const note = outcome.notes.get(next.id);
            const retimed = next.time_label !== row.time_label;
            rearranged[slots[k]!] = {
              ...row,
              time_label: next.time_label,
              reason:
                note ??
                (retimed
                  ? hours.has(next.id)
                    ? "Timed to its opening hours."
                    : "Reordered to cut travel between stops."
                  : row.reason),
            };
          });
          applied += 1;
        }
        rearranged.forEach((row, i) => (row.position = i));
        return applied;
      };
      const estimate = travelTimeFrom(tables);
      let plannedDays = 0;
      if (planHours) {
        const stops = asStops();
        plannedDays = applyDays(planDays(stops, stops, hours, estimate));
      }

      // Check the journeys the plan actually makes on real routes — one
      // credit each, not a matrix of every pair. Where the map misled badly
      // (a river, a motorway, a hill), the day is put in order again on the
      // real times, and only its new journeys are checked.
      let checked = new Map<string, number>();
      let recheckedDays = 0;
      let checkLimited = false;
      const geo = await import("@/lib/geo-provider.server")
        .then((m) => m.geoProvider())
        .catch(() => null);
      if (geo) {
        const routes = await import("@/lib/route-optimize.server");
        const checkBy = Date.now() + 15_000;
        const first = await routes
          .checkLegs(geo, legsOf(tables, asStops()), checkBy)
          .catch(() => null);
        checked = first?.times ?? checked;
        checkLimited = Boolean(first?.limited);
        const surprised = legsOf(tables, asStops()).filter((leg) => {
          const real = checked.get(legKey(leg.from.id, leg.to.id));
          return real != null && isSurprise(leg.estimate, real);
        });
        if (surprised.length) {
          const days = new Set(surprised.map((leg) => leg.day));
          if (planHours) {
            const stops = asStops();
            const again = planDays(
              stops.filter((s) => s.day_date != null && days.has(s.day_date)),
              stops,
              hours,
              withChecked(estimate, checked),
            );
            recheckedDays = applyDays(again);
            const second = await routes
              .checkLegs(geo, legsOf(tables, asStops()), checkBy)
              .catch(() => null);
            for (const [k, v] of second?.times ?? []) checked.set(k, v);
          }
          // Whatever is still much longer than it looks is said on the stop.
          for (const leg of legsOf(tables, asStops())) {
            const real = checked.get(legKey(leg.from.id, leg.to.id));
            if (real == null || !isSurprise(leg.estimate, real)) continue;
            const i = rearranged.findIndex((row) => row.id === leg.to.id);
            if (i < 0) continue;
            rearranged[i] = {
              ...rearranged[i]!,
              reason: `Getting here takes about ${minutesLabel(real)} — longer than it looks on the map.`,
            };
          }
        }
      }

      // Compared only like for like: a stop left alone on its day is one
      // journey fewer, and would make the total look better than the plan is.
      const before = travelTotal(tables, items);
      const after = travelTotal(tables, rearranged);
      const modes = new Set(tables.map((t) => t.mode));
      const checkedSec = checkedTotal(legsOf(tables, asStops()), checked);
      const travel =
        before.pairs > 0 && after.pairs === before.pairs
          ? {
              beforeSec: before.seconds,
              afterSec: after.seconds,
              mode: modes.size === 1 ? [...modes][0]! : ("mixed" as const),
              ...(checkedSec != null ? { checkedSec } : {}),
            }
          : null;

      return {
        summary: result.output.summary,
        changes: result.output.changes,
        items: rearranged,
        travel,
        plannedDays,
        recheckedDays,
        limited: hoursLimited || checkLimited,
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Béa couldn't rearrange that — try fewer goals, or try again.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });

const DayTripPlaceIn = z.object({
  name: z.string().trim().min(1).max(200),
  city: z.string().max(120).nullable(),
  country: z.string().max(80).nullable(),
  category: z.string().max(80).nullable(),
  notes: z.string().max(400).nullable(),
  tags: z.array(z.string().max(40)).max(12),
  lat: z.number(),
  lon: z.number(),
});

const DayTripInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  here: z.object({ lat: z.number(), lon: z.number() }).nullable(),
  pace: z.enum(["relaxed", "balanced", "full"]),
  emphasize: z.array(z.string().max(40)).max(16),
  note: z.string().max(400).nullable(),
  places: z.array(DayTripPlaceIn).min(2).max(12),
});

function formatDayTripPlaces(places: z.infer<typeof DayTripPlaceIn>[]) {
  return places
    .map((place, index) => {
      const where = [place.city, place.country].filter(Boolean).join(", ");
      const extras = [
        place.category,
        place.tags.length ? `tags: ${place.tags.join(", ")}` : "",
        place.notes,
        `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`,
      ]
        .filter(Boolean)
        .join(" · ");
      return `${index + 1}. ${place.name}${where ? ` (${where})` : ""} — ${extras}`;
    })
    .join("\n");
}

export const planDayTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DayTripInput.parse(input))
  .handler(async ({ data, context }): Promise<ParsedItinerary> => {
    const { getTravelPreferences, preferencePrompt } =
      await import("@/lib/travel-preferences.server");
    const preferences = await getTravelPreferences(context);
    const city =
      data.places.map((place) => place.city?.trim()).find(Boolean) ?? data.places[0]?.name ?? "";

    const prompt = [
      "Arrange these saved places into ONE practical day trip. Do not add hotels, flights or new attractions.",
      "Use ONLY the listed places as stops. You may add Transport between them if a move needs saying.",
      "Keep each saved name exactly. kind must be Plan, Reservation or Transport.",
      `The day is ${data.date}. Put every stop on that date.`,
      `Requested pace: ${data.pace}.`,
      data.here
        ? `The traveller starts near ${data.here.lat.toFixed(4)}, ${data.here.lon.toFixed(4)}. Order stops to cut backtracking from there.`
        : "Order stops to cut backtracking.",
      data.emphasize.length ? `Lean into these today: ${data.emphasize.join(", ")}.` : "",
      preferencePrompt(preferences),
      "Béa cannot book or check availability. Phrase meals as suggestions. Never say a table is held.",
      "time_label: 24h HH:MM for each stop, spaced like a real day.",
      "trip_title: a short name starting with Day trip.",
      "Do not estimate prices. Set every estimated_cost to null, costs to an empty list, and estimated_total to null.",
      "source: vault for the saved places, new only for Transport.",
      "summary: one warm sentence about the day.",
      data.note?.trim() ? `Traveller note: ${data.note.trim()}` : "",
      `Saved places:\n${formatDayTripPlaces(data.places)}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const result = await withGemini((model) =>
        generateText({
          model,
          ...AI_CALL,
          output: Output.object({ schema: ParsedSchema }),
          reasoning: "low",
          messages: [{ role: "user", content: prompt }],
        }),
      );
      // A day built around vault places is either one of those places or the
      // travel between them; anything else the model names is still a real
      // thing to do, so it keeps its own kind rather than being flattened.
      const movement = new Set(["transport", "flight", "walk"]);
      const parsed: ParsedItinerary = {
        ...result.output,
        start_date: data.date,
        end_date: data.date,
        trip_title: result.output.trip_title.trim() || `Day trip — ${city}`,
        items: result.output.items.slice(0, 20).map((item) => ({
          ...item,
          day_date: data.date,
          time_label: normalizeClock(item.time_label),
          end_time: normalizeClock(item.end_time),
          kind: normaliseKind(item.kind),
          source: movement.has(normaliseKind(item.kind)) ? "new" : "vault",
        })),
      };
      return applyCostPolicy(parsed, false);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Béa couldn't arrange that day — try fewer places, or try again.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });
