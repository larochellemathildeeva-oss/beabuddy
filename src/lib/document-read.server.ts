import { NoObjectGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { filePartsFromDataUrls, pdfPartFromDataUrl } from "@/lib/ai-image";
import { AI_CALL, aiFailure, withModelFallback } from "@/lib/ai.server";
import { allowCall } from "@/lib/call-limit";
import {
  DOCUMENT_READS_PER_HOUR,
  cleanDocumentRead,
  documentReadPrompt,
  isEmptyRead,
  type DocumentRead,
} from "@/lib/document-read";

/**
 * Gemini reads one booking confirmation or ticket (see document-read.ts).
 * Only when the traveller asks, at most DOCUMENT_READS_PER_HOUR an hour each.
 * The file is sent, the fields come back; nothing is stored here.
 */
const ReadSchema = z.object({
  kind: z.string().nullable(),
  title: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  date: z.string().nullable(),
  time: z.string().nullable(),
  place: z.string().nullable(),
});

const reads = new Map<string, number[]>();

export async function readDocument(
  userId: string,
  file: { pdfDataUrl: string | null; imageDataUrl: string | null },
  today: string,
): Promise<DocumentRead> {
  if (!allowCall(reads, userId, Date.now(), DOCUMENT_READS_PER_HOUR, 60 * 60_000)) {
    throw new Error(
      "Béa has read a lot of files this hour. Fill this one in by hand, or try later.",
    );
  }
  const part = file.pdfDataUrl
    ? pdfPartFromDataUrl(file.pdfDataUrl)
    : filePartsFromDataUrls([file.imageDataUrl ?? ""])[0]!;
  try {
    const result = await withModelFallback((model) =>
      generateText({
        model,
        ...AI_CALL,
        output: Output.object({ schema: ReadSchema }),
        reasoning: "low",
        messages: [
          {
            role: "user",
            content: [{ type: "text" as const, text: documentReadPrompt(today) }, part],
          },
        ],
      }),
    );
    const read = cleanDocumentRead(result.output);
    if (isEmptyRead(read)) {
      throw new Error("Béa couldn't find booking details in that file. Fill it in by hand.");
    }
    return read;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("Béa couldn't read that file. Fill it in by hand, or try a clearer photo.");
    }
    if (error instanceof Error && error.message.startsWith("Béa couldn't")) throw error;
    throw aiFailure(error);
  }
}
