/**
 * Grounding with Google Search: Gemini may look things up on the web while it
 * builds a plan (current hours, closures, events). Google's terms ask that a
 * grounded answer is shown with the Search Suggestions it came with, exactly
 * as sent, and its sources. This reads both out of the provider metadata.
 */

export type SearchSource = { title: string; url: string };

export type SearchGrounding = {
  /** Google's own chip row, HTML and CSS, shown untouched in a sandboxed frame. */
  suggestionsHtml: string | null;
  sources: SearchSource[];
};

const MAX_SOURCES = 8;

/** Most searches the web check asks for — each one is billed. */
export const WEB_CHECK_MAX_SEARCHES = 3;

/**
 * The web check Béa runs before drafting a plan. Only the place and dates go
 * in: nothing the traveller wrote, so nothing personal becomes a search.
 */
export function webCheckPrompt(
  place: string,
  startDate: string | null,
  endDate: string | null,
): string {
  const when =
    startDate && endDate && startDate !== endDate
      ? `${startDate} to ${endDate}`
      : startDate || endDate || "the coming weeks";
  return [
    `Use at most ${WEB_CHECK_MAX_SEARCHES} Google searches.`,
    `Find what a visitor to ${place} needs to know for ${when}: events, festivals and concerts on those dates; major sights, museums or markets closed, under renovation or on reduced hours then; strikes or transport disruption.`,
    'Answer in at most 10 short bullet points, each with the date it applies to. Only facts you found; say "nothing notable" if there is nothing.',
  ].join("\n");
}

/** How the web check's findings are handed to the planner. */
export function webCheckNote(findings: string): string {
  return `Checked on the web today for this trip:\n${findings.trim()}\nUse these facts: never suggest a place that is closed then, and include a fitting event when it suits the traveller.`;
}

/** On unless GEMINI_SEARCH_GROUNDING says otherwise — an off switch for cost. */
export function searchGroundingOn(raw: string | null | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return !["off", "false", "0", "no"].includes(value);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** What the answer was grounded on, or null when Gemini did not search. */
export function readSearchGrounding(providerMetadata: unknown): SearchGrounding | null {
  const meta = record(record(record(providerMetadata)?.["google"])?.["groundingMetadata"]);
  if (!meta) return null;

  const rendered = record(meta["searchEntryPoint"])?.["renderedContent"];
  const suggestionsHtml = typeof rendered === "string" && rendered.trim() ? rendered : null;

  const sources: SearchSource[] = [];
  const seen = new Set<string>();
  const chunks = Array.isArray(meta["groundingChunks"]) ? meta["groundingChunks"] : [];
  for (const chunk of chunks) {
    const web = record(record(chunk)?.["web"]);
    const url = typeof web?.["uri"] === "string" ? web["uri"] : "";
    if (!url.startsWith("https://") || seen.has(url)) continue;
    seen.add(url);
    const title = typeof web?.["title"] === "string" && web["title"].trim() ? web["title"] : "";
    sources.push({ title: title || new URL(url).hostname, url });
    if (sources.length >= MAX_SOURCES) break;
  }

  if (!suggestionsHtml && sources.length === 0) return null;
  return { suggestionsHtml, sources };
}

/**
 * The page for the Search Suggestions frame: links open in a new tab, since
 * the frame itself is sandboxed and Google will not load inside it.
 */
export function suggestionsDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;background:transparent}</style></head><body>${html}</body></html>`;
}
