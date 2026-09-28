/**
 * How stops and places are pictured — one setting for the whole app, never
 * mixed on a screen by choice: Béa's illustrations (the default), real photos
 * from Wikimedia Commons, or no pictures for a more compact list.
 *
 * Real photos come from the place's own OpenStreetMap tags, through Place
 * Details (one Geoapify lookup per new place, shared with the hours on the
 * stop card). A place with no photo, or one not yet on the map, keeps its
 * illustration, so a list is never left with holes.
 *
 * Kept on this device, like the theme. Applied as `data-pictures` on <html>;
 * `.place-art` images are hidden by CSS when it is "none".
 */
export const STOP_PICTURES = ["illustrations", "photos", "none"] as const;
export type StopPictures = (typeof STOP_PICTURES)[number];

export const STOP_PICTURES_KEY = "bea-stop-pictures";

export function asStopPictures(raw: unknown): StopPictures {
  return raw === "none" || raw === "photos" ? raw : "illustrations";
}

export function applyStopPictures(value: StopPictures, root: { dataset: DOMStringMap }): void {
  if (value === "illustrations") delete root.dataset["pictures"];
  else root.dataset["pictures"] = value;
}
