import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { filePartsFromDataUrls } from "@/lib/ai-image";
import { AI_CALL } from "@/lib/ai-errors";
import { htmlToPlainText } from "@/lib/html-text";
import { fetchPublicHtml, isPublicHttpsUrl, UnsupportedPlaceUrlError } from "@/lib/place-url";
import { RECO_LIST_MAX } from "@/lib/reco-list";

const ParseRecoListInput = z
  .object({
    imageDataUrls: z
      .array(z.string().startsWith("data:image/").max(3_000_000))
      .max(4)
      .nullable(),
    text: z.string().max(20_000).nullable(),
    pageUrl: z.string().url().max(2_000).nullish(),
  })
  .refine((v) => Boolean(v.imageDataUrls?.length || v.text?.trim() || v.pageUrl?.trim()), {
    message: "Paste a list, a page link, or upload a file.",
  });

const RecoNameSchema = z.object({
  name: z.string(),
  city: z.string().nullable(),
  notes: z.string().nullable(),
  category: z.string().nullable(),
});

const ParsedRecoListSchema = z.object({
  summary: z.string(),
  items: z.array(RecoNameSchema),
});

export type ParsedRecoList = z.infer<typeof ParsedRecoListSchema>;

export const parseRecoList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ParseRecoListInput.parse(input))
  .handler(async ({ data }): Promise<ParsedRecoList> => {
    const { withModelFallback } = await import("@/lib/ai.server");
    let pageText: string | null = null;
    if (data.pageUrl?.trim()) {
      let parsed: URL;
      try {
        parsed = new URL(data.pageUrl);
      } catch {
        throw new Error("That doesn't look like a web link.");
      }
      if (!isPublicHttpsUrl(parsed)) {
        throw new Error("Use a normal https link — not a private or local address.");
      }
      try {
        const fetched = await fetchPublicHtml(data.pageUrl);
        pageText = htmlToPlainText(fetched.html);
      } catch (error) {
        if (error instanceof UnsupportedPlaceUrlError) {
          throw new Error("Use a normal https link — not a private or local address.");
        }
        throw new Error("Béa couldn't open that page. Paste the list of places instead.");
      }
      if (!pageText || pageText.length < 40) {
        throw new Error("That page didn't send readable text. Paste the list of places instead.");
      }
    }

    const fromPage = Boolean(pageText);
    const prompt = [
      fromPage
        ? "Read this web page about things to do and extract every suggested venue, restaurant, hotel, shop, activity or landmark."
        : "Read this list of places (photo and/or pasted or uploaded text) and extract every venue, restaurant, hotel, shop or landmark.",
      fromPage
        ? "Skip ads, navigation, related posts, author bios, newsletter sign-ups and comments. Keep the page's order."
        : "Skip packing items, times, prices and people. Keep the source order.",
      "name: the place itself. city: the city when the source states one, otherwise null.",
      "notes: a short extra (a dish, a neighbourhood, why they recommend it) or null.",
      "category: Restaurant, Bar, Hotel, Cafe, Shop, Museum, Park, or Place.",
      "Do not invent places that are not in the source. Do not look them up.",
      "summary: one warm sentence about the list.",
    ].join("\n");

    const extras = [
      pageText ? `Page:\n${pageText}` : "",
      data.text?.trim() ? `${fromPage ? "Extra notes" : "List"}:\n${data.text.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const result = await withModelFallback((model) =>
        generateText({
          model,
          ...AI_CALL,
          output: Output.object({ schema: ParsedRecoListSchema }),
          reasoning: "low",
          messages: [
            {
              role: "user",
              content: data.imageDataUrls?.length
                ? [
                    {
                      type: "text" as const,
                      text: extras ? `${prompt}\n\n${extras}` : prompt,
                    },
                    ...filePartsFromDataUrls(data.imageDataUrls),
                  ]
                : [
                    {
                      type: "text" as const,
                      text: extras ? `${prompt}\n\n${extras}` : prompt,
                    },
                  ],
            },
          ],
        }),
      );
      const out = result.output;
      return {
        summary: out.summary,
        items: out.items.slice(0, RECO_LIST_MAX).map((item) => ({
          name: item.name.trim(),
          city: item.city?.trim() || null,
          notes: item.notes?.trim() || null,
          category: item.category?.trim() || null,
        })),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error(
          fromPage
            ? "Could not read the places on that page — try pasting the list instead."
            : "Could not read that list — try a clearer photo or paste the text.",
        );
      }
      const { aiFailure } = await import("@/lib/ai.server");
      throw aiFailure(error);
    }
  });
