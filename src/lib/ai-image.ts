/** Turn a browser data URL into the file part Gemini expects. */
export function filePartFromDataUrl(dataUrl: string): {
  type: "file";
  mediaType: string;
  data: string;
} {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match?.[1] || !match[2]) {
    throw new Error("Could not read that picture.");
  }
  return { type: "file", mediaType: match[1], data: match[2] };
}

export function filePartsFromDataUrls(urls: string[]) {
  return urls.map(filePartFromDataUrl);
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
