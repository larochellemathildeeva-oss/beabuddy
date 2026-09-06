export const FEEDBACK_CATEGORIES = [
  { id: "broke", label: "It broke and I laughed" },
  { id: "stat", label: "A number Béa forgot to count" },
  { id: "wish", label: "A wish, whispered into the void" },
  { id: "plan", label: "Béa planned something unhinged" },
  { id: "map", label: "The map has opinions" },
  { id: "nice", label: "I just wanted to say something nice" },
  { id: "other", label: "None of these, which is itself feedback" },
] as const;

export type FeedbackCategoryId = (typeof FEEDBACK_CATEGORIES)[number]["id"];

export function feedbackCategoryLabel(id: string): string | null {
  return FEEDBACK_CATEGORIES.find((c) => c.id === id)?.label ?? null;
}

export function formatFeedbackMessage(categoryId: string, message: string): string {
  const label = feedbackCategoryLabel(categoryId);
  const body = message.trim();
  if (!label) return body;
  return `${label}\n\n${body}`;
}
