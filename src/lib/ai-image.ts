import { isPdfDataUrl, PDF_DATA_URL_PREFIX } from "./itinerary-pdf.ts";

/**
 * The pictures Béa sends to Gemini. The browser shrinks every one to a JPEG
 * (`downscaleImage` in image.ts); PNG and WebP are allowed for anything that
 * already is one. Nothing else: not SVG (markup, not a photo), not GIF, HEIC
 * or TIFF, whatever the label says.
 */
export const AI_IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AiImageMediaType = (typeof AI_IMAGE_MEDIA_TYPES)[number];

/**
 * Decoded bytes a single picture may carry: what the 3,000,000-character
 * request limit on every AI input already allows, counted after decoding.
 */
export const AI_IMAGE_MAX_BYTES = 2_250_000;

/** What an AI request's picture must start with, for the request validators. */
export const AI_IMAGE_DATA_URL_START = /^data:image\/(?:jpeg|png|webp);base64,/i;

const IMAGE_DATA_URL = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** The first bytes of the picture, enough to recognise its format. */
function headBytes(base64: string, count: number): Uint8Array {
  const chunk = base64.slice(0, Math.ceil(count / 3) * 4);
  const raw = atob(chunk);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Whether the bytes are what the label claims: JPEG, PNG or WebP by signature. */
export function imageSignatureMatches(mediaType: AiImageMediaType, bytes: Uint8Array): boolean {
  const at = (i: number) => bytes[i];
  switch (mediaType) {
    case "image/jpeg":
      return bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff;
    case "image/png":
      return (
        bytes.length >= 8 &&
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)
      );
    case "image/webp":
      return (
        bytes.length >= 12 &&
        [0x52, 0x49, 0x46, 0x46].every((b, i) => at(i) === b) &&
        [0x57, 0x45, 0x42, 0x50].every((b, i) => at(8 + i) === b)
      );
  }
}

/**
 * Turn a browser data URL into the file part Gemini expects, or refuse it.
 *
 * The label must be one of `AI_IMAGE_MEDIA_TYPES`, the body valid base64 no
 * larger than `AI_IMAGE_MAX_BYTES` once decoded, and its first bytes the
 * signature of the format it claims: a PNG labelled JPEG, or text labelled
 * as any picture, is refused rather than handed to the model.
 */
export function filePartFromDataUrl(dataUrl: string): {
  type: "file";
  mediaType: AiImageMediaType;
  data: string;
} {
  const match = IMAGE_DATA_URL.exec(dataUrl.trim());
  if (!match?.[1] || !match[2]) throw new Error("Could not read that picture.");
  const mediaType = match[1].toLowerCase() as AiImageMediaType;
  if (!AI_IMAGE_MEDIA_TYPES.includes(mediaType)) {
    throw new Error("Use a JPEG, PNG or WebP picture.");
  }
  const data = match[2].replace(/\s+/g, "");
  if (data.length % 4 !== 0 || !BASE64.test(data)) {
    throw new Error("Could not read that picture.");
  }
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  if ((data.length / 4) * 3 - padding > AI_IMAGE_MAX_BYTES) {
    throw new Error("That picture is too large.");
  }
  if (!imageSignatureMatches(mediaType, headBytes(data, 12))) {
    throw new Error("That picture isn't the kind of file its name says.");
  }
  return { type: "file", mediaType, data };
}

export function filePartsFromDataUrls(urls: string[]) {
  return urls.map(filePartFromDataUrl);
}

/** The same, for a PDF — checked by its own first bytes, not only its label. */
export function pdfPartFromDataUrl(dataUrl: string): {
  type: "file";
  mediaType: "application/pdf";
  data: string;
} {
  const trimmed = dataUrl.trim();
  if (!isPdfDataUrl(trimmed)) throw new Error("Could not read that PDF.");
  return {
    type: "file",
    mediaType: "application/pdf",
    data: trimmed.slice(PDF_DATA_URL_PREFIX.length),
  };
}

/**
 * The AI SDK tags inline bytes as `{ type: "data", data }`. @ai-sdk/google still
 * sends that object to Gemini's scalar `inline_data.data` field. Unwrap it.
 */
export function unwrapGeminiFileData(data: unknown): unknown {
  if (typeof data === "string" || data instanceof Uint8Array || data instanceof URL) {
    return data;
  }
  if (data && typeof data === "object" && "type" in data && "data" in data) {
    const tagged = data as { type: string; data: unknown };
    if (tagged.type === "data") return unwrapGeminiFileData(tagged.data);
  }
  return data;
}

export function flattenGeminiPromptFiles<T>(prompt: T): T {
  if (!Array.isArray(prompt)) return prompt;
  return prompt.map((message: unknown) => {
    if (!message || typeof message !== "object" || !("content" in message)) return message;
    const content = (message as { content: unknown }).content;
    if (!Array.isArray(content)) return message;
    return {
      ...message,
      content: content.map((part: unknown) => {
        if (!part || typeof part !== "object") return part;
        const file = part as { type?: string; data?: unknown; image?: unknown };
        if (file.type === "file") return { ...file, data: unwrapGeminiFileData(file.data) };
        if (file.type === "image") return { ...file, image: unwrapGeminiFileData(file.image) };
        return part;
      }),
    };
  }) as T;
}
