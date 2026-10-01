import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_IMAGE_DATA_URL_START } from "@/lib/ai-image";
import { AI_IMAGE_MAX_CHARS } from "@/lib/image";
import { MAX_PDF_DATA_URL_LENGTH } from "@/lib/itinerary-pdf";
import { PASTED_TEXT_MAX, type DocumentRead } from "@/lib/document-read";

const ReadInput = z
  .object({
    pdfDataUrl: z
      .string()
      .startsWith("data:application/pdf;base64,")
      .max(MAX_PDF_DATA_URL_LENGTH)
      .nullable(),
    imageDataUrl: z.string().regex(AI_IMAGE_DATA_URL_START).max(AI_IMAGE_MAX_CHARS).nullable(),
    /** Text pasted from a confirmation email or message, already cleaned in the browser. */
    text: z.string().trim().min(1).max(PASTED_TEXT_MAX).nullable().default(null),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((v) => [v.pdfDataUrl, v.imageDataUrl, v.text].filter(Boolean).length === 1, {
    message: "Send one PDF, one photo or some text.",
  });

/** "Fill in from this file" (or pasted text): the fields read off a confirmation or ticket. Saves nothing. */
export const readDocumentFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReadInput.parse(input))
  .handler(async ({ data, context }): Promise<DocumentRead> => {
    const { readDocument } = await import("@/lib/document-read.server");
    return readDocument(context.userId, data, data.today);
  });
