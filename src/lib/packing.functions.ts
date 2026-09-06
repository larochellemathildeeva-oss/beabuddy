import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { filePartsFromDataUrls } from "@/lib/ai-image";
import { SECTION_MAX_LEN } from "@/lib/packing-sections";

const ParsePackingInput = z
  .object({
    imageDataUrls: z
      .array(z.string().startsWith("data:image/").max(3_000_000))
      .max(4)
      .nullable(),
    text: z.string().max(20_000).nullable(),
  })
  .refine((v) => Boolean(v.imageDataUrls?.length || v.text?.trim()), {
    message: "Add a photo or upload a list.",
  });

const PackingItemSchema = z.object({
  label: z.string(),
  quantity: z.number().int().min(1).nullable(),
  section: z.string(),
});

const ParsedPackingSchema = z.object({
  name: z.string(),
  summary: z.string(),
  items: z.array(PackingItemSchema),
});

export type ParsedPackingList = z.infer<typeof ParsedPackingSchema>;
export type ParsedPackingItem = z.infer<typeof PackingItemSchema>;

const SECTION_HINTS = [
  "Clothes",
  "Electronics",
  "IDs",
  "Toiletries",
  "Documents",
  "Medication",
  "Beach",
  "Cold weather",
  "Work",
  "Other",
];

export const parsePackingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ParsePackingInput.parse(input))
  .handler(async ({ data }): Promise<ParsedPackingList> => {
    const { getGeminiModel } = await import("@/lib/ai.server");
    const model = getGeminiModel();
    const prompt = [
      "Read this packing list (photo and/or pasted or uploaded text) and extract every item.",
      "Group items into short section headings a traveller would scan while packing.",
      `Prefer headings such as: ${SECTION_HINTS.join(", ")}. You may invent a similarly short heading when none of those fit.`,
      `section: 1–${SECTION_MAX_LEN} characters. Never leave it empty — use Other if unsure.`,
      "label: the item itself, without the heading. quantity: an integer when the list states a count, otherwise null.",
      "Keep the source order as far as possible. Do not invent items that are not in the source.",
      "If the source already has headings, keep those names (shortened if needed).",
      "name: a short useful list title (e.g. Weekend bag). summary: one warm sentence.",
    ].join("\n");

    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: ParsedPackingSchema }),
        reasoning: "low",
        messages: [
          {
            role: "user",
            content: data.imageDataUrls?.length
              ? [
                  {
                    type: "text" as const,
                    text: data.text?.trim()
                      ? `${prompt}\n\nExtra notes:\n${data.text}`
                      : prompt,
                  },
                  ...filePartsFromDataUrls(data.imageDataUrls),
                ]
              : [
                  {
                    type: "text" as const,
                    text: `${prompt}\n\nList:\n${data.text}`,
                  },
                ],
          },
        ],
      });
      const out = result.output;
      return {
        name: out.name.trim() || "Packing list",
        summary: out.summary,
        items: out.items.slice(0, 80).map((item) => ({
          label: item.label.trim(),
          quantity: item.quantity && item.quantity > 1 ? item.quantity : null,
          section: item.section.trim().slice(0, SECTION_MAX_LEN) || "Other",
        })),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Could not read that list — try a clearer photo or a text file.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });
