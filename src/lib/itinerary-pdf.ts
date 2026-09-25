/**
 * Reading an itinerary from a PDF.
 *
 * Booking confirmations, tour-operator plans and exported itineraries mostly
 * arrive as PDFs, and the only way in used to be a screenshot of each page.
 * Gemini reads PDFs directly — text and scanned pages alike — so the file goes
 * to the same parse as a photo, with no extra parser in between.
 *
 * What is checked here is only what can be checked cheaply before anything is
 * sent: that it is a PDF, that it is small enough, and that it is not locked.
 */

/** The largest PDF accepted. Base64 makes it about a third bigger on the wire. */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** The same limit as a data URL, for the server's input check. */
export const MAX_PDF_DATA_URL_LENGTH = Math.ceil((MAX_PDF_BYTES * 4) / 3) + 64;

export const PDF_DATA_URL_PREFIX = "data:application/pdf;base64,";

/** "%PDF-", base64-encoded at the start of a file: the signature every PDF opens with. */
const PDF_SIGNATURE_BASE64 = "JVBERi0";

export type PdfProblem = "not-pdf" | "too-big" | "locked" | "empty";

/**
 * What is wrong with a picked file, or null when it can be read.
 *
 * `head` is the start of the file and `tail` the end, as bytes. A locked PDF
 * names its /Encrypt dictionary in the trailer, which sits at the end — but
 * a PDF saved for fast web view carries a trailer at the start too, so both
 * are searched.
 */
export function pdfProblem(file: {
  size: number;
  head: Uint8Array;
  tail: Uint8Array;
}): PdfProblem | null {
  if (file.size === 0) return "empty";
  if (!latin1(file.head.subarray(0, 5)).startsWith("%PDF-")) return "not-pdf";
  if (file.size > MAX_PDF_BYTES) return "too-big";
  if (latin1(file.head).includes("/Encrypt") || latin1(file.tail).includes("/Encrypt")) {
    return "locked";
  }
  return null;
}

/** What to tell the traveller, in Béa's voice: what happened, then what to try. */
export function pdfProblemMessage(problem: PdfProblem): string {
  switch (problem) {
    case "not-pdf":
      return "That file isn't a PDF Béa can open. Try a photo of the plan, or paste its text.";
    case "too-big":
      return `That PDF is over ${MAX_PDF_BYTES / 1024 / 1024} MB. Save just the itinerary pages as a new PDF, or take photos of them.`;
    case "locked":
      return "That PDF is password-protected, so Béa can't read it. Save an unlocked copy, or paste its text.";
    case "empty":
      return "That PDF is empty. Try saving it again from where it came from.";
  }
}

/** True when a data URL holds a PDF, by its declared type and its own first bytes. */
export function isPdfDataUrl(dataUrl: string): boolean {
  return (
    dataUrl.startsWith(PDF_DATA_URL_PREFIX) &&
    dataUrl.slice(PDF_DATA_URL_PREFIX.length).startsWith(PDF_SIGNATURE_BASE64)
  );
}

function latin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i] ?? 0);
  return out;
}
