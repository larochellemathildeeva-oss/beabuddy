/**
 * How stops and places are pictured — one setting for the whole app, never
 * mixed on a screen: Béa's illustrations (the default), or no pictures for a
 * more compact list. Real photos (Wikimedia Commons) come later, once each
 * stop keeps its photo; until then the choice is not offered.
 *
 * Kept on this device, like the theme. Applied as `data-pictures` on <html>;
 * `.place-art` images are hidden by CSS when it is "none".
 */
export const STOP_PICTURES = ["illustrations", "none"] as const;
export type StopPictures = (typeof STOP_PICTURES)[number];

export const STOP_PICTURES_KEY = "bea-stop-pictures";

export function asStopPictures(raw: unknown): StopPictures {
  return raw === "none" ? "none" : "illustrations";
}

export function applyStopPictures(value: StopPictures, root: { dataset: DOMStringMap }): void {
  if (value === "none") root.dataset["pictures"] = "none";
  else delete root.dataset["pictures"];
}
