export const TRIPS_VIEWS = ["upcoming", "past", "following", "all"] as const;
export type TripsView = (typeof TRIPS_VIEWS)[number];
export function tripsView(value: unknown): TripsView | undefined {
  return typeof value === "string" && TRIPS_VIEWS.includes(value as TripsView)
    ? (value as TripsView)
    : undefined;
}
