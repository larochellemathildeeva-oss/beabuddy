import type { PinType } from "../data/atlas.ts";
import type { NewReco } from "../hooks/useRecommendations.ts";
import { foldAccents } from "./fuzzy.ts";
import type { ParsedPlace } from "./places.functions.ts";
import { localPlaceHits } from "./world-countries.ts";

/** Enough for a full world list, plus a few extras such as Taiwan. */
export const CITY_LIST_MAX = 220;

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
    .map((name) => {
      const draft: CityListDraft = {
        query: name,
        originalName: name,
        hits: [],
        chosen: null,
        skip: false,
        status: "pending",
      };
      const local = localPlaceHits(name);
      return local.length ? applyCityHits(draft, [...local]) : draft;
    });
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

/** Rename one list row and resolve it locally when the new name is a country. */
export function correctCityDraft(draft: CityListDraft, name: string): CityListDraft {
  const query = name.trim();
  const next: CityListDraft = {
    ...draft,
    query,
    originalName: query || draft.originalName,
    hits: [],
    chosen: null,
    skip: false,
    status: query.length < 2 ? "empty" : "pending",
  };
  if (query.length < 2) return next;
  const local = localPlaceHits(query);
  return local.length ? applyCityHits(next, [...local]) : next;
}

function isCountryHit(hit: ParsedPlace): boolean {
  return foldAccents(hit.category ?? "") === "country";
}

export function draftsToCities(drafts: CityListDraft[], pinType: PinType, source: string): NewReco[] {
  return drafts
    .filter((draft) => !draft.skip)
    .flatMap((draft) => {
      const hit = draft.chosen != null ? draft.hits[draft.chosen] : undefined;
      if (hit?.lat == null || hit.lon == null) return [];
      const country = isCountryHit(hit);
      const label = (country ? hit.country || hit.name : hit.city || hit.name || draft.originalName).trim();
      const reco: NewReco = {
        name: label,
        city: label,
        pin_type: pinType,
        category: country ? "Country" : "City",
        source,
        lat: hit.lat,
        lon: hit.lon,
      };
      if (hit.country?.trim()) reco.country = hit.country.trim();
      else if (country) reco.country = label;
      return [reco];
    });
}
