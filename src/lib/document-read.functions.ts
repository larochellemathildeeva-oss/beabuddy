import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_IMAGE_MAX_CHARS } from "@/lib/image";
import { MAX_PDF_DATA_URL_LENGTH } from "@/lib/itinerary-pdf";
import type { DocumentRead } from "@/lib/document-read";

const ReadInput = z
  .object({
    pdfDataUrl: z
      .string()
      .startsWith("data:application/pdf;base64,")
      .max(MAX_PDF_DATA_URL_LENGTH)
      .nullable(),
    imageDataUrl: z.string().startsWith("data:image/").max(AI_IMAGE_MAX_CHARS).nullable(),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((v) => Boolean(v.pdfDataUrl) !== Boolean(v.imageDataUrl), {
    message: "Send one PDF or one photo.",
  });

/** "Fill in from this file": the fields read off a confirmation or ticket. Saves nothing. */
export const readDocumentFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReadInput.parse(input))
  .handler(async ({ data, context }): Promise<DocumentRead> => {
    const { readDocument } = await import("@/lib/document-read.server");
    return readDocument(context.userId, data, data.today);
  });
