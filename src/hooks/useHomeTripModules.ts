import { useMemo } from "react";
import { useCityPositions } from "@/hooks/useCityPositions";
import type { TripGlance } from "@/hooks/useTripGlances";
import { useTripStops } from "@/hooks/useTripStops";
import type { MemberRow, TripRow } from "@/hooks/useTrips";
import type { RecoRowDB } from "@/hooks/useRecommendations";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { tripCityStop, withCityPositions } from "@/lib/city-position";
import { todaysCompanion, untilLabel } from "@/lib/home-now";
import { savedForTrip, tripTowns, worthADetour } from "@/lib/home-modules";
import { routeStopOn } from "@/lib/import-stop";
import { tripNote } from "@/lib/module-notes";
import { isAreaPlace } from "@/lib/reco-place";
import { toLocalISODate } from "@/lib/trip-dates";

const DAY_MS = 86_400_000;
const dayGap = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/**
 * What Home's trip modules share: the town the trip is in today (or starts
 * in), with its position, and the trip's towns. One read of the stops for
 * all of them.
 */
export function useHomeTripModules({
  trip,
  glance,
  members,
  saved,
  underway,
}: {
  trip: TripRow | null;
  glance: TripGlance | undefined;
  members: MemberRow[];
  saved: RecoRowDB[];
  underway: boolean;
}) {
  const { stops, loading } = useTripStops(trip?.id ?? null, null);
  const cityStops = useMemo(
    () => (!trip ? [] : stops.length || loading ? stops : tripCityStop(trip)),
    [stops, loading, trip],
  );
  const positions = useCityPositions(cityStops);
  const placed = useMemo(() => withCityPositions(cityStops, positions), [cityStops, positions]);
  const today = toLocalISODate(new Date());
  const here = useMemo(() => {
    const dated = routeStopOn(placed, today);
    const first = placed.find((s) => s.city?.trim());
    const stop = (underway ? dated : null) ?? first ?? null;
    const city = stop?.city?.split(",")[0]?.trim() || trip?.city?.split(",")[0]?.trim() || "";
    return {
      city,
      country: stop?.country ?? trip?.country ?? null,
      lat: typeof stop?.lat === "number" ? stop.lat : null,
      lon: typeof stop?.lon === "number" ? stop.lon : null,
    };
  }, [placed, today, underway, trip]);
  const savedHere = useMemo(() => {
    if (!trip) return [];
    return savedForTrip(
      saved.filter((row) => !isAreaPlace(row)),
      tripTowns(trip, cityStops),
    );
  }, [saved, trip, cityStops]);
  const detour = useMemo(
    () =>
      worthADetour(
        savedHere,
        (glance?.items ?? []).map((i) => i.title),
      ),
    [savedHere, glance],
  );
  const people = useMemo(
    () => (trip ? members.filter((m) => m.trip_id === trip.id) : []),
    [members, trip],
  );
  const note = useMemo(() => {
    if (!trip) return "";
    const start = trip.start_date;
    const end = trip.end_date;
    const companion = todaysCompanion(glance?.items ?? [], today);
    const next = companion.next;
    const until = next ? untilLabel(next.time_label, new Date()) : "";
    return tripNote({
      daysUntil: start ? dayGap(today, start) : null,
      day: underway && start ? dayGap(start, today) + 1 : null,
      days: start && end ? dayGap(start, end) + 1 : null,
      todosOpen: glance?.todos.open ?? 0,
      packedPct: glance?.packing ? Math.round(glance.packing.ratio * 100) : null,
      next: next ? { title: next.title, when: until ? until.toLowerCase() : "later today" } : null,
    });
  }, [trip, glance, today, underway]);
  const art = here.city ? bannerArtUrl(bannerSceneFor([here.city, here.country], here.city)) : null;
  return { here, savedHere, detour, people, note, art };
}

export type HomeTripContext = ReturnType<typeof useHomeTripModules>;
