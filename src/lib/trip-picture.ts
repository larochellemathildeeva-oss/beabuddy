/**
 * What the trip page's banner shows (owner decision for the UI revamp): the
 * trip's route over real terrain with its cities named ("stops"), or a photo
 * of the place ("photo"). A device preference, like the views bar position.
 */
export const TRIP_PICTURES = ["stops", "photo"] as const;
export type TripPicture = (typeof TRIP_PICTURES)[number];

export const TRIP_PICTURE_KEY = "bea-trip-picture";

/** Stops by default, as in the mockup; anything unknown reads as Stops. */
export function asTripPicture(raw: unknown): TripPicture {
  return raw === "photo" ? "photo" : "stops";
}
