import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { filePartFromDataUrl } from "@/lib/ai-image";

const ReceiptInput = z.object({
  // Downscaled image as a data URL (image/jpeg …), kept small by the client.
  imageDataUrl: z.string().startsWith("data:image/").max(3_000_000),
});

const ReceiptSchema = z.object({
  merchant: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  spentOn: z.string().nullable(), // YYYY-MM-DD
  category: z.string().nullable(),
  summary: z.string().nullable(),
});

export type ReceiptExtraction = z.infer<typeof ReceiptSchema>;

const CATEGORIES = ["Meals", "Transport", "Flights", "Lodging", "Client", "Supplies", "Other"];

export const extractReceiptFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReceiptInput.parse(input))
  .handler(async ({ data }): Promise<ReceiptExtraction> => {
    const { getGeminiModel } = await import("@/lib/ai.server");
    const model = getGeminiModel();

    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: ReceiptSchema }),
        reasoning: "low",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "Read this receipt photo and extract the expense details.",
                  `merchant: the shop or restaurant name. amount: the FINAL total paid as a number (after tax, including tip if shown). currency: ISO code like CAD, USD, EUR. spentOn: the date on the receipt as YYYY-MM-DD.`,
                  `category: exactly one of ${CATEGORIES.join(", ")}.`,
                  "summary: five words or fewer describing what it was for (e.g. 'team lunch near office').",
                  "If a field is not readable, return null for it. Never guess an amount.",
                ].join("\n"),
              },
              filePartFromDataUrl(data.imageDataUrl),
            ],
          },
        ],
      });
      return result.output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("Could not read that receipt — fill it in by hand.");
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });
