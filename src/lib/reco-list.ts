import type { PinType } from "../data/atlas.ts";
import type { NewReco } from "../hooks/useRecommendations.ts";
import type { ParsedPlace } from "./places.functions.ts";
import { tagsForSave } from "./reco-tags.ts";

export const RECO_LIST_MAX = 25;

export type ParsedRecoName = {
  name: string;
  city?: string | undefined;
  notes?: string | undefined;
  category?: string | undefined;
};

export type RecoListDraft = {
  query: string;
  originalName: string;
  city?: string | undefined;
  notes?: string | undefined;
  category?: string | undefined;
  hits: ParsedPlace[];
  chosen: number | null;
  pin_type: PinType;
  skip: boolean;
  status: "pending" | "searching" | "ready" | "empty";
};

export const RECO_LIST_CATEGORIES = [
  "Restaurant",
  "Bar",
  "Hotel",
  "Cafe",
  "Shop",
  "Museum",
  "Park",
  "Place",
] as const;

export function searchQueryForReco(item: ParsedRecoName): string {
  const name = item.name.trim();
  const city = item.city?.trim();
  if (city && !name.toLowerCase().includes(city.toLowerCase())) {
    return `${name}, ${city}`;
  }
  return name;
}

export function startRecoDrafts(items: ParsedRecoName[]): RecoListDraft[] {
  return items
    .map((item) => {
      const name = item.name.trim();
      const draft: RecoListDraft = {
        query: searchQueryForReco(item),
        originalName: name,
        hits: [],
        chosen: null,
        pin_type: "reco",
        skip: false,
        status: "pending",
      };
      if (item.city?.trim()) draft.city = item.city.trim();
      if (item.notes?.trim()) draft.notes = item.notes.trim();
      if (item.category?.trim()) draft.category = item.category.trim();
      return draft;
    })
    .filter((draft) => draft.originalName.length > 0)
    .slice(0, RECO_LIST_MAX);
}

export function applySearchHits(draft: RecoListDraft, hits: ParsedPlace[]): RecoListDraft {
  const next = hits.slice(0, 5);
  return {
    ...draft,
    hits: next,
    chosen: next.length ? 0 : null,
    status: next.length ? "ready" : "empty",
  };
}

export function draftsToSave(
  drafts: RecoListDraft[],
  recommendedBy?: string,
  source = "Uploaded list",
): NewReco[] {
  const by = recommendedBy?.trim();
  return drafts
    .filter((draft) => !draft.skip)
    .map((draft) => {
      const hit = draft.chosen != null ? draft.hits[draft.chosen] : undefined;
      const reco: NewReco = {
        name: draft.originalName.trim() || hit?.name.trim() || "Saved place",
        pin_type: draft.pin_type,
        source,
      };
      const city = draft.city?.trim() || hit?.city || undefined;
      const country = hit?.country ?? undefined;
      const address = hit?.address ?? undefined;
      const category = draft.category || hit?.category;
      const notes = draft.notes;
      if (city) reco.city = city;
      if (country) reco.country = country;
      if (address) reco.address = address;
      if (category) reco.category = category;
      if (notes) reco.notes = notes;
      if (by) reco.recommended_by = by;
      if (hit?.url) reco.url = hit.url;
      if (hit?.lat != null) reco.lat = hit.lat;
      if (hit?.lon != null) reco.lon = hit.lon;
      const tags = tagsForSave(reco);
      if (tags.length) reco.travel_tags = tags;
      return reco;
    });
}
