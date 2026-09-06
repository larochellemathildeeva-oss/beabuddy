import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getGeminiModel() {
  const apiKey = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
  if (!apiKey) throw new Error("AI is not set up on this app yet.");
  return createGoogleGenerativeAI({ apiKey })("gemini-3.7-flash");
}

/** Judgment jobs: think more, and return a thought summary the UI can show. */
export const judgmentCall = {
  reasoning: "medium" as const,
  providerOptions: {
    google: {
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: "medium" as const,
      },
    },
  },
};
