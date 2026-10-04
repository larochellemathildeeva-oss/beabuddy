/* eslint-disable react-hooks/exhaustive-deps */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "@/components/icons";
import { useUndo } from "@/hooks/useUndo";
import { addRecommendationOnce } from "@/hooks/useRecommendations";
import type { PlaceLike } from "@/lib/captured-place";
import { isAlreadyKept, keeperToReco } from "@/lib/trip-keepers";
import { supabase } from "@/integrations/supabase/client";
import { type OptimizePreset, type PlannerTab } from "@/components/ItineraryImport";
import type { EasePreset } from "@/lib/day-ease";
import { useOfflineDirections } from "@/hooks/useOfflineDirections";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { useTripBoard, type ItineraryRow } from "@/hooks/useTrips";
import { useTripStops } from "@/hooks/useTripStops";
import { destinationCities } from "@/lib/trip-cities";
import { useTripBudget } from "@/hooks/useTripBudget";
import { stopsForDirections, timelineStopsForDirections } from "@/lib/direction-stops";
import { formatTripLocation } from "@/lib/place-label";
import { useTripBarPosition } from "@/hooks/useTripBarPosition";
import { isNetworkFailure } from "@/lib/ai-errors";
import { changeSetForSchedulePatch } from "@/lib/itinerary-review";
import type { SchedulePatch } from "@/lib/itinerary-schedule-write";
import { rowsToPlace, stopLookupTitle, stopsToPlace, tripLookupArea } from "@/lib/stop-placing";
import { geocodePlanStops } from "@/lib/geocode-plan.functions";
import { labelAddress } from "@/lib/geocode-plan";
import { autoPinTrusted } from "@/lib/match-confidence";
import { legsToTimelineItems, splitDirectionRows } from "@/lib/timeline-directions";
import { type TravelChoice } from "@/lib/travel-mode";
import { readTravelChoice, writeTravelChoice } from "@/lib/travel-choice-store";
import { beaLine } from "@/lib/bea-voice";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { lookupCoords } from "@/lib/places.functions";
import { planTowns, tripPlaceFromTowns } from "@/lib/plan-cities";
import { useOfflineDayMaps } from "@/hooks/useOfflineDayMaps";
import { useOfflineMap } from "@/hooks/useOfflineMap";
import { routeCityOn } from "@/lib/import-stop";
import type { TripDetailCtx } from "./ctx";

export function useTripDetailPart1(td: TripDetailCtx) {
  td.navigate = useNavigate();
  const _td1 = useTripBarPosition();
  td.barPosition = _td1[0];
  td.setBarPosition = _td1[1];
  const _td2 = useState(false);
  td.bookingsOpen = _td2[0];
  td.setBookingsOpen = _td2[1];
  td.bookingsRef = useRef<HTMLElement>(null);
  const _td3 = useState(false);
  td.plannerOpen = _td3[0];
  td.setPlannerOpen = _td3[1];
  const _td4 = useState<PlannerTab>("start");
  td.plannerTab = _td4[0];
  td.setPlannerTab = _td4[1];
  const _td5 = useState("");
  td.plannerAsk = _td5[0];
  td.setPlannerAsk = _td5[1];
  const _td6 = useState<OptimizePreset | null>(null);
  td.optimizePreset = _td6[0];
  td.setOptimizePreset = _td6[1];
  td.easeDay = (preset: EasePreset, day: string, dayLabel: string) => {
    td.setOptimizePreset((cur) => ({
      goals: preset.goals,
      note: preset.note,
      label: preset.label,
      day,
      dayLabel,
      n: (cur?.n ?? 0) + 1,
    }));
    td.setPlannerTab("optimize");
    td.setPlannerOpen(true);
  };
  td.activeId = td.trip.id;
  td.board = useTripBoard(td.activeId, td.me);
  const _td7 = useUndo();
  td.removeWithUndo = _td7.removeWithUndo;
  td.scheduleErrorText = (e: unknown) => {
    const code = (
      e as {
        code?: string;
      } | null
    )?.code;
    return code === "ITINERARY_VERSION_CONFLICT"
      ? "Someone else changed this stop just now. Béa kept their version."
      : code === "ITINERARY_PARTLY_SAVED"
        ? "Only part of that change saved. The stop shows what was kept."
        : code === "TIME_LOCK_UNAVAILABLE"
          ? "Fixed and Flexible aren't set up yet."
          : isNetworkFailure(e)
            ? "Couldn't save that change. Check your connection."
            : "Couldn't save that change. Try again in a moment.";
  };
  td.saveCard = (id: string, patch: Parameters<typeof td.board.updateItem>[1]) => {
    const fail = (e: unknown) => void toast.error(td.scheduleErrorText(e));
    const { day_date, time_label, planned_stay_minutes, time_locked, ...rest } = patch;
    const owns = (key: keyof SchedulePatch) => Object.prototype.hasOwnProperty.call(patch, key);
    const schedule: SchedulePatch = {
      ...(owns("day_date") ? { day_date: day_date ?? null } : {}),
      ...(owns("time_label") ? { time_label: time_label ?? null } : {}),
      ...(owns("planned_stay_minutes")
        ? { planned_stay_minutes: planned_stay_minutes ?? null }
        : {}),
      ...(owns("time_locked") ? { time_locked: time_locked ?? null } : {}),
    };
    const proposal =
      Object.keys(schedule).length > 0
        ? changeSetForSchedulePatch(td.board.items, id, schedule)
        : null;
    // Nothing whose consequences need checking ("9:00 AM" → "09:00" is
    // only a label): the ordinary save.
    if (!proposal) {
      void td.board.updateItem(id, patch).catch(fail);
      return;
    }
    const others = Object.keys(rest).length > 0 ? () => td.board.updateItem(id, rest) : undefined;
    const now = td.scheduleReview.review("all", proposal, others);
    if (!now) return;
    void (async () => {
      await td.board.applySchedule(now.updates);
      td.setLiveLegs(null);
      await others?.();
    })().catch(fail);
  };
  td.budget = useTripBudget(td.activeId);
  td.cities = useTripStops(td.activeId, td.me.id, td.trip);
  td.fullRoute = useMemo(() => {
    const home = td.cities.missingHome;
    return home
      ? [
          { id: "trip-home", kind: "destination", lat: null, lon: null, ...home },
          ...td.cities.stops,
        ]
      : td.cities.stops;
  }, [td.cities.stops, td.cities.missingHome]);
  td.routeCities = useMemo(() => destinationCities(td.fullRoute), [td.fullRoute]);
  const _td8 = useState("");
  td.cityChoice = _td8[0];
  td.setCityChoice = _td8[1];
  td.chosenCity =
    td.routeCities.length > 1 ? (td.routeCities.find((c) => c.id === td.cityChoice) ?? null) : null;
  td.dir = useOfflineDirections(td.activeId);
  const _td9 = useState<TravelChoice>("auto");
  td.travel = _td9[0];
  td.setTravel = _td9[1];
  useEffect(() => {
    td.setTravel(readTravelChoice(td.activeId));
  }, [td.activeId]);
  td.chooseTravel = (choice: TravelChoice) => {
    td.setTravel(choice);
    writeTravelChoice(td.activeId, choice);
    // Journeys just worked out were for the old choice: drop them rather
    // than show a drive the traveller now walks. A kept copy stays until
    // directions are asked again.
    if (choice !== td.travel) td.setLiveLegs(null);
  };
  td.dayMaps = useOfflineDayMaps(td.activeId);
  td.offlineMap = useOfflineMap(td.activeId);
  td.directionStops = timelineStopsForDirections(td.board.items);
  td.routeStops = stopsForDirections(td.cities.stops, td.board.items);
  const _td10 = useMemo(() => splitDirectionRows(td.board.items), [td.board.items]);
  td.stopItems = _td10.stops;
  td.savedTravel = _td10.travel;
  td.lookupTown = useServerFn(lookupCoords);
  const _td11 = useState(false);
  td.findingCities = _td11[0];
  td.setFindingCities = _td11[1];
  td.canFindCities =
    !td.cities.loading &&
    td.cities.stops.length === 0 &&
    td.stopItems.some((item) => item.day_date && item.lat != null && item.lon != null);
  td.findCities = async () => {
    td.setFindingCities(true);
    try {
      const found = await planTowns(
        td.stopItems.map((item) => ({
          day_date: item.day_date,
          kind: item.kind,
          lat: item.lat,
          lon: item.lon,
        })),
        td.cities.stops,
        (at) => td.lookupTown({ data: at }),
      );
      if (found.length === 0) {
        toast.error("Béa couldn't tell the cities from these stops. Add them with the pin button.");
        return;
      }
      await td.cities.addStops(found);
      // A trip imported before the plan set its starting city gets it here.
      const place = tripPlaceFromTowns(td.trip, found);
      if (place) await td.onUpdate(place);
      toast.success(`Added ${found.map((c) => c.city).join(", ")} to the trip's destinations`);
    } catch {
      toast.error("Couldn't add the cities. Check your connection and try again.");
    } finally {
      td.setFindingCities(false);
    }
  };
  td.lookupArea = tripLookupArea({
    city: td.trip.city,
    country: td.trip.country,
    stops: td.cities.stops,
  });
  td.directionArea = td.lookupArea || undefined;
  td.routeRun = useServerFn(buildRoutes);
  const _td12 = useState<string[] | null>(null);
  td.directionsFor = _td12[0];
  td.setDirectionsFor = _td12[1];
  useEffect(() => {
    const directionsFor = td.directionsFor;
    if (!directionsFor) return;
    const saved = td.board.items.filter((item) => directionsFor.includes(item.id));
    if (saved.length < directionsFor.length) return;
    td.setDirectionsFor(null);
    const days = new Set(saved.map((item) => item.day_date ?? ""));
    const stops = td.directionStops.filter((stop) => days.has(stop.day_date ?? ""));
    if (stops.length < 2) return;
    const pending = toast.loading("Adding directions between your stops…");
    void (async () => {
      try {
        const result = (await td.routeRun({
          data: {
            stops,
            ...(td.directionArea ? { area: td.directionArea } : {}),
            travel: td.travel,
          },
        })) as {
          legs: RouteLeg[];
        };
        const items = legsToTimelineItems(
          result.legs,
          stops,
          td.board.items.map((item) => item.title),
        );
        if (items.length > 0) await td.board.upsertItems(items);
        toast.success(
          items.length > 0
            ? `${items.length} ${items.length === 1 ? "journey" : "journeys"} added between your stops`
            : "Béa couldn't route between these stops yet — add addresses and try Directions",
          { id: pending },
        );
      } catch {
        toast.error("Couldn't add the directions — try Directions on the day", { id: pending });
      }
    })();
  }, [td.board.items, td.directionsFor]);
  td.nearOn = (day: string | null | undefined): string | undefined =>
    routeCityOn(td.cities.stops, day) || td.directionArea;
  td.triedPlacing = useRef<Set<string>>(new Set());
  useEffect(() => {
    const area = formatTripLocation(td.trip.city, td.trip.country);
    if (!area) return;
    const pending = stopsToPlace(td.cities.stops, td.triedPlacing.current);
    if (pending.length === 0) return;
    for (const stop of pending) td.triedPlacing.current.add(stop.id);
    let cancelled = false;
    void (async () => {
      try {
        const found = await geocodePlanStops({
          data: {
            stops: pending.map((stop) => ({
              title: stopLookupTitle(stop),
              detail: stop.address ?? null,
              address: stop.address ?? null,
            })),
            area,
          },
        });
        if (cancelled) return;
        for (const hit of found.placed) {
          const stop = pending[hit.index];
          if (stop) await td.cities.updateStop(stop.id, { lat: hit.lat, lon: hit.lon });
        }
        if (found.throttled) {
          // The provider pushed back rather than answering. These stops were
          // never really tried, so forget that they were: marking them keeps
          // real places blank for the rest of the session.
          const placedIds = new Set(found.placed.map((hit) => pending[hit.index]?.id));
          for (const stop of pending) {
            if (!placedIds.has(stop.id)) td.triedPlacing.current.delete(stop.id);
          }
        }
      } catch {
        // A stop without a point is the state this started in, not a failure
        // worth telling anyone about.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [td.cities.stops, td.trip.city, td.trip.country]);
  td.triedPlacingRows = useRef<Set<string>>(new Set());
  td.latestItems = useRef(td.board.items);
  td.latestItems.current = td.board.items;
  useEffect(() => {
    if (!td.lookupArea) return;
    const pending = rowsToPlace(td.board.items, td.triedPlacingRows.current);
    if (pending.length === 0) return;
    for (const row of pending) td.triedPlacingRows.current.add(row.id);
    let cancelled = false;
    void (async () => {
      try {
        const found = await geocodePlanStops({
          data: {
            stops: pending.map((row) => {
              const area = routeCityOn(td.cities.stops, row.day_date);
              return {
                title: row.title,
                detail: row.address ?? null,
                address: row.address ?? null,
                ...(area ? { area } : {}),
              };
            }),
            area: td.lookupArea,
            venues: true,
          },
        });
        if (cancelled) return;
        for (const hit of found.placed) {
          const row = pending[hit.index];
          // Saved only if it plausibly is this stop; a namesake stays
          // unplaced for the person to set, rather than pinned wrongly.
          if (!row || !autoPinTrusted({ title: row.title, address: row.address }, hit)) continue;
          // Read now, not from the lookup's snapshot: an address typed
          // while it ran is the person's, and is never replaced.
          const current = td.latestItems.current.find((item) => item.id === row.id);
          const where = (current ?? row).address?.trim() ? null : labelAddress(hit.label);
          await td.board.updateItem(row.id, {
            lat: hit.lat,
            lon: hit.lon,
            ...(where ? { address: where } : {}),
          });
        }
        if (found.throttled) {
          const placedIds = new Set(found.placed.map((hit) => pending[hit.index]?.id));
          for (const row of pending) {
            if (!placedIds.has(row.id)) td.triedPlacingRows.current.delete(row.id);
          }
        }
      } catch {
        // An unplaced row is where this started. It is not worth a toast.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [td.board.items, td.lookupArea]);
  const _td13 = useState<PlaceLike[] | null>(null);
  td.vaultPlaces = _td13[0];
  td.setVaultPlaces = _td13[1];
  td.loadVaultPlaces = async (): Promise<PlaceLike[]> => {
    const { data, error } = await supabase.from("recommendations").select("name, city, lat, lon");
    if (error) throw new Error("Couldn't check your saved places. Try again in a moment.");
    return data ?? [];
  };
  useEffect(() => {
    let cancelled = false;
    td.loadVaultPlaces().then(
      (places) => {
        if (!cancelled) td.setVaultPlaces(places);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);
  td.isKept = (item: ItineraryRow) =>
    td.vaultPlaces ? isAlreadyKept(item, td.trip, td.vaultPlaces) : false;
  td.keeping = useRef<Set<string>>(new Set());
  td.keepItemAsReco = async (item: ItineraryRow) => {
    if (td.keeping.current.has(item.id)) return;
    td.keeping.current.add(item.id);
    try {
      const vault = td.vaultPlaces ?? (await td.loadVaultPlaces());
      // Already there, perhaps from another trip or the Recs tab: say so
      // rather than filing a second copy.
      if (isAlreadyKept(item, td.trip, vault)) {
        td.setVaultPlaces(vault);
      } else {
        const reco = keeperToReco(item, td.trip);
        await addRecommendationOnce(reco);
        td.setVaultPlaces((prev) => [...(prev ?? vault), reco]);
      }
    } finally {
      td.keeping.current.delete(item.id);
    }
    const line = beaLine("recs.saved");
    toast.success(line.title, { description: line.body });
  };
}
