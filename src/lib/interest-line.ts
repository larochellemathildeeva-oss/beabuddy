/** The interests as one line: "Food, architecture and quieter streets." */
export function interestLine(tags: readonly string[]): string {
  const words = tags.slice(0, 4).map((t, i) => (i === 0 ? t : t.toLowerCase()));
  const line = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0];
  return line ? `${line}.` : "";
}
