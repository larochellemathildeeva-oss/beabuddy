import type { PinType } from "../data/atlas.ts";
import type { NewReco } from "../hooks/useRecommendations.ts";
import type { ParsedPlace } from "./places.functions.ts";

export const CITY_LIST_MAX = 40;

export type CityListDraft = {
  query: string;
  originalName: string;
  hits: ParsedPlace[];
  chosen: number | null;
  skip: boolean;
  status: "pending" | "searching" | "ready" | "empty";
};

function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-*•·–—]|\d+[.)])\s+/, "").trim();
}

/**
 * Turns a notes dump into city search queries. One city per line stays a
 * single query (so "Paris, France" is not split). A single comma-separated
 * line of three or more names is treated as a list.
 */
export function parseCityListText(raw: string): string[] {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((line) => stripBullet(line).split(/\s*[;|]\s*/))
    .map((line) => line.trim())
    .filter(Boolean);

  const parts =
    lines.length === 1
      ? (() => {
          const csv = lines[0]!.split(/\s*,\s*/).map((bit) => bit.trim()).filter(Boolean);
          return csv.length >= 3 ? csv : lines;
        })()
      : lines;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (part.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push(part);
    if (out.length >= CITY_LIST_MAX) break;
  }
  return out;
}

export function startCityDrafts(names: string[]): CityListDraft[] {
  return names
    .map((name) => name.trim())
    .filter((name) => name.length >= 2)
    .slice(0, CITY_LIST_MAX)
    .map((name) => ({
      query: name,
      originalName: name,
      hits: [],
      chosen: null,
      skip: false,
      status: "pending" as const,
    }));
}

export function applyCityHits(draft: CityListDraft, hits: ParsedPlace[]): CityListDraft {
  const next = hits.slice(0, 5);
  return {
    ...draft,
    hits: next,
    chosen: next.length ? 0 : null,
    status: next.length ? "ready" : "empty",
  };
}

export function draftsToCities(drafts: CityListDraft[], pinType: PinType, source: string): NewReco[] {
  return drafts
    .filter((draft) => !draft.skip)
    .flatMap((draft) => {
      const hit = draft.chosen != null ? draft.hits[draft.chosen] : undefined;
      if (hit?.lat == null || hit.lon == null) return [];
      const city = (hit.city || hit.name || draft.originalName).trim();
      const reco: NewReco = {
        name: city,
        city,
        pin_type: pinType,
        category: "City",
        source,
        lat: hit.lat,
        lon: hit.lon,
      };
      if (hit.country?.trim()) reco.country = hit.country.trim();
      return [reco];
    });
}
