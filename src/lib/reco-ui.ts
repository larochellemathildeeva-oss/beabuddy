/**
 * When the vault's own machinery is worth showing.
 *
 * The Recs screen led with a search box, a row of place filters and a row of
 * kind filters — about a screen and a half of controls — above a vault holding
 * one saved place. Filters that cannot narrow anything are not neutral: they
 * push the thing you came to look at below the fold.
 */

/** Below this, the list is short enough to read rather than search. */
const SEARCH_FROM = 6;
/** Below this, a filter row costs more space than it saves. */
const FILTER_FROM = 6;

export type VaultShape = {
  /** How many places are saved. */
  total: number;
  /** Distinct place filters available, excluding the "All" pill. */
  places: number;
  /** Distinct kinds available, excluding the "All" pill. */
  kinds: number;
};

/** A search box earns its place once the list stops fitting in your head. */
export function searchWorthShowing(shape: Pick<VaultShape, "total">): boolean {
  return shape.total >= SEARCH_FROM;
}

/**
 * Filters need two things: enough rows to be worth narrowing, and more than
 * one value to narrow to. One city and one category means every filter is
 * either "All" or the only answer.
 */
export function placeFilterWorthShowing(shape: VaultShape): boolean {
  return shape.total >= FILTER_FROM && shape.places > 1;
}

export function kindFilterWorthShowing(shape: VaultShape): boolean {
  return shape.total >= FILTER_FROM && shape.kinds > 1;
}

export function anyFilterWorthShowing(shape: VaultShape): boolean {
  return placeFilterWorthShowing(shape) || kindFilterWorthShowing(shape);
}

/**
 * What the one add field should say.
 *
 * It takes a name or a pasted link, so the placeholder has to teach both
 * without becoming a sentence.
 */
export function addPlaceholder(hasSaved: boolean): string {
  return hasSaved ? "Add a place — or paste a link" : "Name a place, or paste a link";
}

/**
 * Whether a filter selection has been left pointing at something that is no
 * longer offered — e.g. the last Saitama place was removed while "Saitama" was
 * selected, which otherwise shows an empty vault with no way back.
 */
export function filterIsStale(selected: string, available: string[], allLabel: string): boolean {
  if (selected === allLabel) return false;
  return !available.includes(selected);
}
