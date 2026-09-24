// The real module, with the lookups answered by hand: one confident match,
// one confident match in another town, one doubtful one, one not found.
export * from "../../../src/lib/geocode-plan.functions";

export const geocodePlanStops = async (args: { data: { stops: unknown[]; area?: string | null } }) => {
  const w = window as unknown as { __geoCalls?: unknown[] };
  (w.__geoCalls ??= []).push(args.data);
  // The trip page's background lookup for the sample's one unplaced stop:
  // answered with a namesake park, which must not be saved onto it.
  const first = args.data.stops[0] as { title?: string } | undefined;
  if (first?.title === "Sunset ferry back to Hiroshima") {
    return {
      area: args.data.area ?? "",
      lookedUp: 1,
      throttled: false,
      placed: [{ index: 0, lat: 34.3, lon: 132.33, label: "Momijidani Park, Miyajima", category: "leisure", kind: "park" }],
    };
  }
  return {
    area: args.data.area ?? "",
    lookedUp: 5,
    throttled: false,
    placed: [
      { index: 0, lat: 34.3977, lon: 132.4753, label: "Hiroshima Station, Matsubaracho, Hiroshima", category: "railway", kind: "station" },
      { index: 1, lat: 34.2959, lon: 132.3198, label: "Itsukushima Shrine, Miyajima, Hatsukaichi", category: "amenity", kind: "place_of_worship" },
      { index: 2, lat: 34.3, lon: 132.33, label: "Momijidani Park, Miyajima, Hatsukaichi", category: "leisure", kind: "park" },
    ],
  };
};
