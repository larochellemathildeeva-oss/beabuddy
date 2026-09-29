import { useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bookmark,
  Check,
  Coins,
  LocateFixed,
  Download,
  MapPin,
  ChevronDown,
  ChevronRight,
  Route,
  Signpost,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
} from "@/components/icons";
import { TripBudget } from "@/components/TripBudget";
import { CurrencySheet } from "@/components/CurrencySheet";
import { TripStops } from "@/components/TripStops";
import { TripPeople } from "@/components/TripPeople";
import { TripBudgetSwitch, TripDeleteButton, TripDetailsForm } from "@/components/TripSettings";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import { tripDateLine } from "@/lib/trip-card";
import { TripOverview } from "@/components/TripOverview";
import { timelineGlyph } from "@/lib/timeline-kind";
import { TimelineEntryForm } from "@/components/TimelineEntryForm";
import { Sheet } from "@/components/Sheet";
import { TripMap } from "@/components/TripMap";
import { TripPrep, type PrepTab } from "@/components/TripPrep";
import { savedAgoLabel, savedIsStale, savedMatchesStops } from "@/lib/offline-directions";
import { useUndo } from "@/hooks/useUndo";
import { addRecommendationOnce } from "@/hooks/useRecommendations";
import type { PlaceLike } from "@/lib/captured-place";
import { isAlreadyKept, keeperToReco } from "@/lib/trip-keepers";
import { supabase } from "@/integrations/supabase/client";
import { ItineraryImport, type PlannerTab } from "@/components/ItineraryImport";
import { ItineraryDirections } from "@/components/ItineraryDirections";
import { TimeChangeBox } from "@/components/day/TimeChangeBox";
import { itineraryPrintHtml } from "@/lib/itinerary-print";
import { printHtml } from "@/lib/print-page";
import { prettyDistance, prettyDuration, useOfflineDirections } from "@/hooks/useOfflineDirections";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { useTripBoard, type ItineraryRow, type MemberRow, type TripRow } from "@/hooks/useTrips";
import { useTripStops } from "@/hooks/useTripStops";
import { destinationCities, groupsInCity } from "@/lib/trip-cities";
import { useTripBudget } from "@/hooks/useTripBudget";
import { usePacking } from "@/hooks/usePacking";
import {
  isSavedDirectionItem,
  stopsForDirections,
  timelineStopsForDirections,
} from "@/lib/direction-stops";
import { formatTripLocation } from "@/lib/place-label";
import { formatTimelineDayLabel, groupTimelineByDay } from "@/lib/timeline-groups";
import { DayCards } from "@/components/day/DayCards";
import { StickyDayBar } from "@/components/day/StickyDayBar";
import { nowTarget } from "@/lib/now-jump";
import { SortableDay, SortableStop, type SortableBind } from "@/components/day/SortableStops";
import { CompanionBanner } from "@/components/day/CompanionBanner";
import {
  TripMenuSheet,
  type BookingTile,
  type TripMenuSection,
} from "@/components/day/TripMenuSheet";
import { dayLengthLabel, dayTitle } from "@/components/day/stop-words";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { countBookings, tripBookings } from "@/lib/trip-overview";
import { TripBookings, type BookingFilter } from "@/components/day/TripBookings";
import { useTripBookingDocuments } from "@/hooks/useTripDocuments";
import {
  ALL_DAYS,
  dayChips,
  defaultDayChoice,
  shouldOfferDays,
  visibleGroups,
  type DayChoice,
} from "@/lib/trip-days";
import { dropMove, rearrange, stepMove, timeFit, tripDays, type StopMove } from "@/lib/stop-move";
import { MoveStopSheet } from "@/components/day/MoveStopSheet";
import { toLocalISODate } from "@/lib/trip-dates";
import { beaTripNote } from "@/lib/trip-note";
import { dayTightnessNote, minutesUntilLabel, nextUp, nowDivider } from "@/lib/day-shape";
import { runLabelsByIndex, walkableRuns } from "@/lib/stop-grouping";
import { rowsToPlace, stopLookupTitle, stopsToPlace, tripLookupArea } from "@/lib/stop-placing";
import { geocodePlanStops } from "@/lib/geocode-plan.functions";
import { labelAddress, strayStopIds } from "@/lib/geocode-plan";
import { groupByArea } from "@/lib/neighbourhood";
import { autoPinTrusted } from "@/lib/match-confidence";
import {
  directionKey,
  legsToTimelineItems,
  splitDirectionRows,
  unroutedLegCopy,
} from "@/lib/timeline-directions";
import { modeWord, type TravelChoice } from "@/lib/travel-mode";
import { readTravelChoice, writeTravelChoice } from "@/lib/travel-choice-store";
import { tripStillEditableNote } from "@/lib/trip-copy";
import { beaLine } from "@/lib/bea-voice";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { lookupCoords } from "@/lib/places.functions";
import { planTowns, tripPlaceFromTowns } from "@/lib/plan-cities";
import logo from "@/assets/bea-logo.png";
import { DayMapView } from "@/components/day/DayMapView";
import { DayRibbon } from "@/components/day/DayRibbon";
import { JourneyTracker } from "@/components/day/JourneyTracker";
import { StopPeek } from "@/components/day/StopPeek";
import { NowPanel } from "@/components/day/NowPanel";
import {
  clockMinutes,
  companionState,
  companionStops,
  isDone,
  midpointTime,
  toggleDoneWrite,
} from "@/lib/companion";
import { CustomizeOptions } from "@/components/day/CustomizeTrip";
import { SavedPlacesSheet } from "@/components/day/SavedPlacesSheet";
import { useOfflineDayMaps } from "@/hooks/useOfflineDayMaps";
import { useOfflineMap } from "@/hooks/useOfflineMap";
import { prettyMegabytes } from "@/lib/vector-tiles";
import { daysForMaps } from "@/lib/day-maps";
import { GEOAPIFY_ATTRIBUTION, OSM_ATTRIBUTION, OVERTURE_ATTRIBUTION } from "@/lib/geo-endpoints";
import { TravelConnector, TimelineEntry } from "@/components/day/TimelineCard";
import { isTravelLeg, legTarget, routeCityOn, routeStopOn, withLegNote } from "@/lib/import-stop";
import { useTripViewPrefs } from "@/hooks/useTripViewPrefs";
import type { InsideEntry } from "@/lib/inside-list";
import {
  asPerspective,
  defaultPerspective,
  TRIP_PERSPECTIVES,
  tripIsUnderway,
  type TripPerspective,
} from "@/lib/trip-perspective";

/**
 * A trip, as a page.
 *
 * This was the expanded half of a card in a list. Being a route rather than an
 * accordion is what lets the browser carry the trip's photograph across from
 * the card you tapped, and it also deleted the sessionStorage workaround that
 * existed only to stop the accordion collapsing when you changed tab — a
 * workaround is usually the shape of the model being wrong, and it was.
 */
export function TripDetail({
  trip,
  members,
  companionsLine,
  me,
  onInvite,
  onRevokeInvite,
  onUpdate,
  onDelete,
  onLeave,
  onRemoveMember,
  openPrep,
  openView,
  openPlan,
}: {
  trip: TripRow;
  /** Kept for callers; the trip page no longer shows a banner photo. */
  photos?: TripPhotoRow[];
  members: MemberRow[];
  companionsLine: string;
  me: { id: string | null; name: string };
  onInvite: () => Promise<string>;
  onRevokeInvite: (code: string) => Promise<void>;
  onUpdate: (patch: Partial<TripRow>) => Promise<void>;
  onDelete: () => Promise<void>;
  onLeave: () => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  /** Open the to-do or packing sheet on arrival (Home's shortcuts). */
  openPrep?: PrepTab | undefined;
  /** A tab asked for in the link. */
  openView?: "bookings" | undefined;
  /** Open Plan with Béa on arrival, on this panel, with any words already typed. */
  openPlan?: { tab: PlannerTab; ask?: string | undefined } | undefined;
}) {
  const navigate = useNavigate();
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerTab, setPlannerTab] = useState<PlannerTab>("start");
  /** Words carried into Build from the Plan with Béa page. */
  const [plannerAsk, setPlannerAsk] = useState("");
  // Everything on this page is about this trip, so the hooks are simply live.
  // As a card this had to be conditional, which is what made the planner button
  // fail with "Open a trip first" when pressed on a collapsed card.
  const activeId = trip.id;
  const board = useTripBoard(activeId, me);
  const { removeWithUndo } = useUndo();
  const budget = useTripBudget(activeId);
  const cities = useTripStops(activeId, me.id, trip);
  /**
   * The cities you can move between. A trip whose second city was added
   * before its first was kept still lists its first, from the trip itself.
   */
  const fullRoute = useMemo(() => {
    const home = cities.missingHome;
    return home
      ? [{ id: "trip-home", kind: "destination", lat: null, lon: null, ...home }, ...cities.stops]
      : cities.stops;
  }, [cities.stops, cities.missingHome]);
  const routeCities = useMemo(() => destinationCities(fullRoute), [fullRoute]);
  /** The city picked in the switcher, by stop id; "" for every city. */
  const [cityChoice, setCityChoice] = useState("");
  const chosenCity =
    routeCities.length > 1 ? (routeCities.find((c) => c.id === cityChoice) ?? null) : null;
  const dir = useOfflineDirections(activeId);
  // How this traveller gets around on this trip, asked in the directions
  // sheet and used by every journey Béa routes for it.
  const [travel, setTravel] = useState<TravelChoice>("auto");
  useEffect(() => {
    setTravel(readTravelChoice(activeId));
  }, [activeId]);
  const chooseTravel = (choice: TravelChoice) => {
    setTravel(choice);
    writeTravelChoice(activeId, choice);
  };
  const dayMaps = useOfflineDayMaps(activeId);
  const offlineMap = useOfflineMap(activeId);
  const directionStops = timelineStopsForDirections(board.items);
  const routeStops = stopsForDirections(cities.stops, board.items);
  /**
   * The stops, and the walks and drives saved between them. Those are the
   * travel between two stops, drawn in the connector with their steps
   * folded away — never a stop of their own on the list, the map or a count.
   */
  const { stops: stopItems, travel: savedTravel } = useMemo(
    () => splitDirectionRows(board.items),
    [board.items],
  );
  /**
   * A trip with a timeline but no destinations — a plan saved before Béa
   * added its towns — finds them from its pins, one lookup a day.
   */
  const lookupTown = useServerFn(lookupCoords);
  const [findingCities, setFindingCities] = useState(false);
  const canFindCities =
    !cities.loading &&
    cities.stops.length === 0 &&
    stopItems.some((item) => item.day_date && item.lat != null && item.lon != null);
  const findCities = async () => {
    setFindingCities(true);
    try {
      const found = await planTowns(
        stopItems.map((item) => ({
          day_date: item.day_date,
          kind: item.kind,
          lat: item.lat,
          lon: item.lon,
        })),
        cities.stops,
        (at) => lookupTown({ data: at }),
      );
      if (found.length === 0) {
        toast.error("Béa couldn't tell the cities from these stops. Add them with the pin button.");
        return;
      }
      await cities.addStops(found);
      toast.success(`Added ${found.map((c) => c.city).join(", ")} to the trip's destinations`);
    } catch {
      toast.error("Couldn't add the cities. Check your connection and try again.");
    } finally {
      setFindingCities(false);
    }
  };
  /**
   * One area, used by everything that looks a place up.
   *
   * Falls back to the trip's own stops when the city field is empty, because a
   * trip called "Hiroshima day trip" with a stop in Hiroshima knows perfectly
   * well where it is. What it never falls back to is the trip's title.
   */
  const lookupArea = tripLookupArea({
    city: trip.city,
    country: trip.country,
    stops: cities.stops,
  });
  const directionArea = lookupArea || undefined;
  const routeRun = useServerFn(buildRoutes);
  /**
   * Stops an import saved with "Add directions between stops" ticked. They
   * are routed once they are on the board, for their own days only, and the
   * journeys are added as the directions sheet adds them.
   */
  const [directionsFor, setDirectionsFor] = useState<string[] | null>(null);
  useEffect(() => {
    if (!directionsFor) return;
    const saved = board.items.filter((item) => directionsFor.includes(item.id));
    if (saved.length < directionsFor.length) return;
    setDirectionsFor(null);
    const days = new Set(saved.map((item) => item.day_date ?? ""));
    const stops = directionStops.filter((stop) => days.has(stop.day_date ?? ""));
    if (stops.length < 2) return;
    const pending = toast.loading("Adding directions between your stops…");
    void (async () => {
      try {
        const result = (await routeRun({
          data: { stops, ...(directionArea ? { area: directionArea } : {}), travel },
        })) as { legs: RouteLeg[] };
        const items = legsToTimelineItems(
          result.legs,
          stops,
          board.items.map((item) => item.title),
        );
        if (items.length > 0) await board.upsertItems(items);
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
    // Runs when the board catches up with the saved stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.items, directionsFor]);
  /**
   * Where to look a stop up: the city the route has you in that day, then
   * the trip's area. A multi-city trip used to search every stop around its
   * first city, so a Miyajima stop on Oct 7 was looked for near Tokyo.
   */
  const nearOn = (day: string | null | undefined): string | undefined =>
    routeCityOn(cities.stops, day) || directionArea;

  /**
   * Put the trip's stops on the map, once, in the background.
   *
   * A stop picked from search arrives with a point; one typed by hand or built
   * by the planner does not — so the map had nothing to draw and the trip card
   * fell back to a large letter. Filling the gap in the data rather than in the
   * view means every surface improves at once: the map, the card, Near, and
   * anything that measures a distance.
   *
   * Area-anchored, never a bare name. Capped per visit, and each stop is tried
   * at most once here, because the list reloads after every placement and an
   * unfindable stop would otherwise be asked for on every reload.
   */
  const triedPlacing = useRef<Set<string>>(new Set());
  useEffect(() => {
    const area = formatTripLocation(trip.city, trip.country);
    if (!area) return;
    const pending = stopsToPlace(cities.stops, triedPlacing.current);
    if (pending.length === 0) return;
    for (const stop of pending) triedPlacing.current.add(stop.id);

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
          if (stop) await cities.updateStop(stop.id, { lat: hit.lat, lon: hit.lon });
        }
        if (found.throttled) {
          // The provider pushed back rather than answering. These stops were
          // never really tried, so forget that they were: marking them keeps
          // real places blank for the rest of the session.
          const placedIds = new Set(found.placed.map((hit) => pending[hit.index]?.id));
          for (const stop of pending) {
            if (!placedIds.has(stop.id)) triedPlacing.current.delete(stop.id);
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
    // cities.stops is the trigger; updateStop is stable enough and including
    // it would re-run this on every reload it causes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities.stops, trip.city, trip.country]);

  /**
   * Put the trip's timeline on the map, once, in the background.
   *
   * The effect above places the trip's cities. That was never the thing being
   * asked for: what belongs on a map is the museum, the restaurant and the
   * ferry — the rows of the day — and nothing ever went back for those. An
   * entry only got a point if it happened to be picked from search, so a whole
   * imported day landed blank and stayed blank, and the only repair was adding
   * every place by hand.
   *
   * Same rules as the stops: area-anchored, capped per visit, each row tried
   * once. The address is written too when the lookup returns one, so the row
   * can say where it is and not only sit on a map.
   */
  const triedPlacingRows = useRef<Set<string>>(new Set());
  /** The rows as they are now, not as they were when a lookup began. */
  const latestItems = useRef(board.items);
  latestItems.current = board.items;
  useEffect(() => {
    if (!lookupArea) return;
    const pending = rowsToPlace(board.items, triedPlacingRows.current);
    if (pending.length === 0) return;
    for (const row of pending) triedPlacingRows.current.add(row.id);

    let cancelled = false;
    void (async () => {
      try {
        const found = await geocodePlanStops({
          data: {
            stops: pending.map((row) => {
              const area = routeCityOn(cities.stops, row.day_date);
              return {
                title: row.title,
                detail: row.address ?? null,
                address: row.address ?? null,
                ...(area ? { area } : {}),
              };
            }),
            area: lookupArea,
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
          const current = latestItems.current.find((item) => item.id === row.id);
          const where = (current ?? row).address?.trim() ? null : labelAddress(hit.label);
          await board.updateItem(row.id, {
            lat: hit.lat,
            lon: hit.lon,
            ...(where ? { address: where } : {}),
          });
        }
        if (found.throttled) {
          const placedIds = new Set(found.placed.map((hit) => pending[hit.index]?.id));
          for (const row of pending) {
            if (!placedIds.has(row.id)) triedPlacingRows.current.delete(row.id);
          }
        }
      } catch {
        // An unplaced row is where this started. It is not worth a toast.
      }
    })();
    return () => {
      cancelled = true;
    };
    // board.items is the trigger; updateItem reloads it, so including it here
    // would place the same rows for ever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.items, lookupArea]);
  // Saved directions are only the right legs for these rows when they were
  // built from this exact stop list. They used to be indexed in blindly, so a
  // city-to-city download showed up underneath timeline entries.
  /**
   * What is already in the vault, for the Save on each card. Null until it
   * has loaded: an unknown vault is not an empty one, so a save made before
   * then (or after the read failed) checks for itself.
   */
  const [vaultPlaces, setVaultPlaces] = useState<PlaceLike[] | null>(null);
  const loadVaultPlaces = async (): Promise<PlaceLike[]> => {
    const { data, error } = await supabase.from("recommendations").select("name, city, lat, lon");
    if (error) throw new Error("Couldn't check your saved places. Try again in a moment.");
    return data ?? [];
  };
  useEffect(() => {
    let cancelled = false;
    loadVaultPlaces().then(
      (places) => {
        if (!cancelled) setVaultPlaces(places);
      },
      () => {
        /* stays unknown; a save reads it again */
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const isKept = (item: ItineraryRow) =>
    vaultPlaces ? isAlreadyKept(item, trip, vaultPlaces) : false;
  // A second tap while the first save is still in flight must not file a copy.
  const keeping = useRef<Set<string>>(new Set());
  /**
   * Keep a timeline stop in the vault. A place worth going to on this trip is
   * a place worth remembering after it — that is the whole premise, and the
   * timeline had no way to get anything back out.
   */
  const keepItemAsReco = async (item: ItineraryRow) => {
    if (keeping.current.has(item.id)) return;
    keeping.current.add(item.id);
    try {
      const vault = vaultPlaces ?? (await loadVaultPlaces());
      // Already there, perhaps from another trip or the Recs tab: say so
      // rather than filing a second copy.
      if (isAlreadyKept(item, trip, vault)) {
        setVaultPlaces(vault);
      } else {
        const reco = keeperToReco(item, trip);
        await addRecommendationOnce(reco);
        setVaultPlaces((prev) => [...(prev ?? vault), reco]);
      }
    } finally {
      keeping.current.delete(item.id);
    }
    const line = beaLine("recs.saved");
    toast.success(line.title, { description: line.body });
  };

  /** Remove a timeline row, offering to put it back for a few seconds. */
  const removeTimelineItem = (item: ItineraryRow) =>
    removeWithUndo({
      label: item.title,
      remove: () => board.removeItem(item.id),
      // Comes back at the end of its day rather than its old position.
      restore: async () => {
        await board.addItem({
          kind: item.kind,
          title: item.title,
          ...(item.day_date ? { day_date: item.day_date } : {}),
          ...(item.time_label ? { time_label: item.time_label } : {}),
          ...(item.detail ? { detail: item.detail } : {}),
          ...(item.address ? { address: item.address } : {}),
          ...(item.lat != null ? { lat: item.lat } : {}),
          ...(item.lon != null ? { lon: item.lon } : {}),
        });
      },
    });

  // A journey saved as a stop, from a plan imported before journeys were
  // folded on import: offer to make it a note on the stop it leads to.
  const foldProps = (item: ItineraryRow) => {
    if (!isTravelLeg(item)) return {};
    const i = board.items.indexOf(item);
    const target = legTarget(board.items, i);
    const into = target ? board.items[target.index] : undefined;
    if (!target || !into) return {};
    return {
      foldInto: into.title,
      onFold: () => {
        void board.updateItem(into.id, { detail: withLegNote(into.detail, item, target.after) });
        void removeTimelineItem(item);
      },
    };
  };

  const savedFitsTimeline = savedMatchesStops(dir.saved?.signature, directionStops);
  /**
   * Legs just worked out, before anyone has chosen to keep them.
   *
   * The timeline used to show directions only once they had been saved to the
   * phone, so pressing Refresh appeared to do nothing until you also pressed
   * Keep. Fresh legs win over saved ones because they describe the stops as
   * they are right now.
   */
  const [liveLegs, setLiveLegs] = useState<RouteLeg[] | null>(null);
  // Where the trip is, as a point: the median of its placed stops, so one
  // stop in another city does not drag it. Chain and category searches
  // ("coffee", "subway") look around here while you plan from home.
  const tripCenter = useMemo(() => {
    const placed = board.items.filter(
      (item): item is ItineraryRow & { lat: number; lon: number } =>
        item.lat != null && item.lon != null,
    );
    if (!placed.length) return null;
    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)]!;
    };
    return { lat: median(placed.map((p) => p.lat)), lon: median(placed.map((p) => p.lon)) };
  }, [board.items]);
  // The same, one day at a time: a trip with no route still knows a
  // Hiroshima day is in Hiroshima once a stop or two of it is pinned.
  const dayCenters = useMemo(() => {
    const byDay = new Map<string, { lat: number[]; lon: number[] }>();
    for (const item of board.items) {
      if (!item.day_date || item.lat == null || item.lon == null) continue;
      const day = byDay.get(item.day_date) ?? { lat: [], lon: [] };
      day.lat.push(item.lat);
      day.lon.push(item.lon);
      byDay.set(item.day_date, day);
    }
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1]!;
    return new Map(
      [...byDay].map(([day, { lat, lon }]) => [day, { lat: median(lat), lon: median(lon) }]),
    );
  }, [board.items]);
  /**
   * The middle of that day's city when the route has it pinned; with no
   * route, the middle of that day's pinned stops; else the trip's.
   */
  const centerOn = (day: string | null | undefined) => {
    const here = routeStopOn(cities.stops, day);
    if (here) return here.lat != null && here.lon != null ? { lat: here.lat, lon: here.lon } : null;
    return (day ? dayCenters.get(day) : undefined) ?? tripCenter;
  };
  /**
   * What a card needs to show nesting: the stop it is inside (same day only,
   * so the indent sits under its parent), how many stops are inside it, and
   * saving the list of what is inside it.
   */
  const itemsById = useMemo(() => new Map(board.items.map((i) => [i.id, i])), [board.items]);
  const nestedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of board.items) {
      if (i.parent_id && itemsById.has(i.parent_id)) {
        counts.set(i.parent_id, (counts.get(i.parent_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [board.items, itemsById]);
  const nestProps = (item: ItineraryRow) => {
    const onInside = (next: InsideEntry[]) => void board.updateItem(item.id, { inside: next });
    // Flat, by choice: every stop on its own line, what is inside as a note.
    if (!view.prefs.nesting) return { flat: true, onInside };
    const parent = item.parent_id ? itemsById.get(item.parent_id) : undefined;
    return {
      ...(parent && parent.day_date === item.day_date ? { parentTitle: parent.title } : {}),
      nestedStops: nestedCounts.get(item.id) ?? 0,
      onInside,
    };
  };
  /** The search anchors for a stop on that day, as props. */
  const withNear = (day: string | null | undefined) => {
    const near = nearOn(day);
    const center = centerOn(day);
    return { ...(near ? { near } : {}), ...(center ? { center } : {}) };
  };
  // Pins far from the rest of the trip, saved before lookups were bounded to
  // the trip's area: flagged on their cards so they get checked.
  const strayIds = useMemo(() => strayStopIds(stopItems), [stopItems]);
  // Legs are worked out over `directionStops` (the timeline without its
  // Walk / Drive rows), so a leg is found by the stop's place in that list —
  // not in board.items, where every such row shifted every leg after it.
  const directionIndexById = new Map(
    directionStops.map((stop, i) => [stop.id ?? `#${i}`, i] as const),
  );
  const legFor = (fromId: string, toId: string) => {
    const index = directionIndexById.get(fromId);
    if (index == null || directionStops[index + 1]?.id !== toId) return undefined;
    return liveLegs?.[index] ?? (savedFitsTimeline ? dir.saved?.legs[index] : undefined);
  };
  /** The measured leg into `to`: worked out now, kept on the phone, or saved on the timeline. */
  /**
   * `strict` leaves out rows saved before they kept the stop they leave from:
   * after a reorder such a row may describe another journey, and Companion
   * times "Leave by" from it, so it works that journey out itself instead.
   */
  const travelInto = (from: ItineraryRow, to: ItineraryRow, strict = false) =>
    legFor(from.id, to.id) ??
    savedTravel.get(directionKey(to.day_date, to.title, from.title)) ??
    savedTravel.get(directionKey(from.day_date, to.title, from.title)) ??
    (strict
      ? undefined
      : (savedTravel.get(directionKey(to.day_date, to.title)) ??
        savedTravel.get(directionKey(from.day_date, to.title))));
  const templates = usePacking(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetSection, setSheetSection] = useState<TripMenuSection | null>(null);
  const [packTemplateId, setPackTemplateId] = useState("");
  const [packMsg, setPackMsg] = useState("");
  const [prepSignal, setPrepSignal] = useState(0);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  /** Open the to-do or packing sheet on a given tab (arrival link, Overview). */
  const [prepAsk, setPrepAsk] = useState<{ tab: PrepTab; n: number } | null>(() =>
    openPrep ? { tab: openPrep, n: 1 } : null,
  );
  /** The member about to lose access, or null. Named, so the sheet can say who. */
  const [addingTimeline, setAddingTimeline] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [timelineByDay, setTimelineByDay] = useState(true);
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  /**
   * One switch for the whole itinerary, not a link on every row.
   *
   * Each entry used to carry its own "Day & order" toggle, which put three
   * underlined links under every line of the trip — the list read as a page of
   * controls with the plan somewhere behind it. The controls are the same; they
   * now all appear at once, from one pencil in the section header.
   */
  const [editingTimeline, setEditingTimeline] = useState(false);
  /** The signpost on every day's header opens the directions sheet. */
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [directionsBusy, setDirectionsBusy] = useState(false);
  const directionsButton =
    directionStops.length >= 2 && !editingTimeline
      ? { onDirections: () => setDirectionsOpen(true), directionsBusy }
      : {};
  const savedDirectionRows = useMemo(() => board.items.filter(isSavedDirectionItem), [board.items]);
  /** Every saved walk and drive off the timeline at once, with an undo. */
  const removeDirectionRows = async () => {
    const rows = savedDirectionRows;
    if (rows.length === 0) return;
    await board.removeItems(rows.map((row) => row.id));
    setLiveLegs(null);
    toast.success(`Removed ${rows.length} ${rows.length === 1 ? "journey" : "journeys"}`, {
      action: {
        label: "Undo",
        onClick: () =>
          void board.upsertItems(
            rows.map((row) => ({
              kind: row.kind,
              title: row.title,
              ...(row.day_date ? { day_date: row.day_date } : {}),
              ...(row.time_label ? { time_label: row.time_label } : {}),
              ...(row.detail ? { detail: row.detail } : {}),
              ...(row.address ? { address: row.address } : {}),
              ...(row.lat != null ? { lat: row.lat } : {}),
              ...(row.lon != null ? { lon: row.lon } : {}),
            })),
          ),
      },
    });
  };
  /** The Timeline's ⋯ sheet: which stops, which order, edit and optimise. */
  const [timelineMenuOpen, setTimelineMenuOpen] = useState(false);
  /**
   * The clock, for the line that says where you are in today.
   *
   * Ticks every minute rather than every render: a plan you are standing in
   * the middle of is a different document from one you are reading at home,
   * and the only thing that turns one into the other is the time.
   */
  const [minutesNow, setMinutesNow] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      setMinutesNow(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(tick);
  }, []);
  const todayKey = toLocalISODate(new Date());
  /** Day the add form should land on, set by the per-day "Add here" buttons. */
  const [addDay, setAddDay] = useState("");
  /** Which kind the Bookings tab shows. */
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const bookingDocs = useTripBookingDocuments(trip.id);
  const others = board.present.filter((p) => p.userId !== me.id);
  const allDayGroups = groupTimelineByDay(stopItems);
  // With a city picked, the days, the map and Now all follow that city.
  const timelineGroups = chosenCity
    ? groupsInCity(allDayGroups, routeCities, chosenCity)
    : allDayGroups;
  /** Every day of the trip, for moving stops between them — empty days too. */
  const moveDays = tripDays(trip.start_date, trip.end_date, stopItems);
  /** The stop "Move to…" is open on. */
  const [movingId, setMovingId] = useState<string | null>(null);
  const movingStop = movingId ? (stopItems.find((item) => item.id === movingId) ?? null) : null;

  /**
   * Save moves (Up/Down, "Move to…", or Béa's), then say what happened with
   * Undo. A single stop whose time no longer fits where it landed gets the
   * offer of one that does. A plain step inside a day stays quiet.
   */
  const moveStops = async (moves: StopMove[], summary?: string) => {
    const updates = rearrange(stopItems, moves);
    if (updates.length === 0) return;
    const previous = updates.flatMap((u) => {
      const row = board.items.find((item) => item.id === u.id);
      return row
        ? [
            {
              id: row.id,
              day_date: row.day_date,
              time_label: row.time_label,
              position: row.position,
            },
          ]
        : [];
    });
    const single = moves.length === 1 ? moves[0]! : null;
    const fit = single ? timeFit(stopItems, single, clockMinutes) : null;
    const stop = single ? stopItems.find((item) => item.id === single.id) : undefined;
    const crossedDay = single && stop && (stop.day_date ?? "") !== (single.day_date ?? "");
    const undo = () =>
      void board.applySchedule(previous).then(
        () => toast.success("Back where it was"),
        () => toast.error("Couldn't undo that. Check your connection."),
      );
    try {
      await board.applySchedule(updates);
    } catch (e) {
      // Rows are written one by one, so some may have saved before the
      // failure. The list has reloaded to show them; offer to put it back.
      setLiveLegs(null);
      toast.error("Couldn't save all of that move.", {
        description: "Check your connection. Some stops may already have moved.",
        duration: 10000,
        action: { label: "Put back", onClick: undo },
      });
      throw e;
    }
    // Journeys worked out just now were for the old neighbours.
    setLiveLegs(null);
    if (fit && single) {
      const landed = updates.find((u) => u.id === single.id);
      toast(`${stop?.title ?? "That stop"}'s ${fit.time} is now out of order`, {
        description: fit.suggestion
          ? `${fit.suggestion} would fit between its neighbours.`
          : "Clear its time, or set one by hand.",
        duration: 10000,
        action: {
          label: fit.suggestion ? `Set ${fit.suggestion}` : "Clear time",
          onClick: () =>
            landed &&
            void board
              .applySchedule([{ ...landed, time_label: fit.suggestion }])
              .catch(() => toast.error("Couldn't change the time. Check your connection.")),
        },
        cancel: { label: "Undo", onClick: undo },
      });
      return;
    }
    if (!summary && !crossedDay) return;
    toast(
      summary ||
        `${stop?.title ?? "Stop"} moved to ${
          single?.day_date ? formatTimelineDayLabel(single.day_date) : "No date"
        }`,
      {
        ...(summary
          ? {
              description: `${updates.length} ${updates.length === 1 ? "change" : "changes"} saved.`,
            }
          : {}),
        duration: 8000,
        action: { label: "Undo", onClick: undo },
      },
    );
  };
  const moveProps = (item: ItineraryRow) => {
    const up = stepMove(stopItems, item.id, -1, moveDays);
    const down = stepMove(stopItems, item.id, 1, moveDays);
    return {
      onMove: (direction: -1 | 1) => {
        const move = direction < 0 ? up : down;
        if (move)
          // moveStops says what went wrong itself.
          void moveStops([move]).catch(() => undefined);
      },
      canMoveUp: up !== null,
      canMoveDown: down !== null,
      onMoveTo: () => setMovingId(item.id),
    };
  };
  /**
   * The day on screen. Null until the traveller picks one, so the default
   * keeps tracking the data while it loads — the first render has no items,
   * and "today" only becomes answerable once they arrive. Once a choice is
   * made it sticks, and stops being recomputed underneath them.
   */
  const [dayChoice, setDayChoice] = useState<DayChoice | null>(null);
  const chosenDay = dayChoice ?? defaultDayChoice(timelineGroups, todayKey);
  const shownGroups = visibleGroups(timelineGroups, chosenDay);
  /** Where "Now" goes on a trip day: the stop you're at, or the next one. */
  const todayGroup = timelineGroups.find((group) => group.key === todayKey);
  const nowStop = todayGroup ? nowTarget(todayGroup.items, minutesNow) : null;
  const jumpToNow = () => {
    if (!nowStop) return;
    if (timelineByDay && chosenDay !== ALL_DAYS && chosenDay !== todayKey) setDayChoice(todayKey);
    setCollapsedDays((prev) => ({ ...prev, [todayKey]: false }));
    // After the day has rendered: two frames, one for the state, one for layout.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .getElementById(`stop-${nowStop.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      ),
    );
  };
  /** The day cards, for the sticky day bar to know when they scroll away. */
  const dayCardsRef = useRef<HTMLDivElement>(null);
  const offerDays = shouldOfferDays(timelineGroups);

  /**
   * Which way you are looking at the trip: Now, Map, Day or Trip.
   *
   * On the trip, Now opens first; before and after it, the day list does.
   * Every function the page had is still here, sorted under a tab.
   */
  const [perspective, setPerspective] = useState<TripPerspective>(() =>
    defaultPerspective(tripIsUnderway(trip, todayKey)),
  );
  const activePerspective = TRIP_PERSPECTIVES.find((p) => p.id === perspective)!;

  // The last tab and day for this trip, kept on this device so a refresh or
  // a return visit opens where you left off. Read after mount, so the server
  // render and the first client render agree.
  const viewKey = `bea-trip-page-${trip.id}`;
  /** Timeline shows only the stops not yet visited. Undo on the toast brings one back. */
  const [hideDone, setHideDone] = useState(false);
  /** Timeline Editor grouped by area (Neighbourhood) rather than by time. */
  const [byArea, setByArea] = useState(false);
  /** One line a stop, tap to open: for reading a long day at a glance. */
  const [compactCards, setCompactCards] = useState(false);
  /** The day a stop is being dragged in, if any. */
  const [draggingDay, setDraggingDay] = useState<string | null>(null);
  const doneCount = stopItems.filter(isDone).length;
  // Nothing hidden while editing: edit mode is for the whole list.
  const hidingDone = hideDone && !editingTimeline;
  const restored = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(viewKey) ?? "null") as {
        perspective?: unknown;
        day?: unknown;
        hideDone?: unknown;
        byArea?: unknown;
        compact?: unknown;
      } | null;
      const p = asPerspective(saved?.perspective);
      if (p) setPerspective(p);
      if (typeof saved?.day === "string") setDayChoice(saved.day);
      if (saved?.hideDone === true) setHideDone(true);
      if (saved?.byArea === true) setByArea(true);
      if (saved?.compact === true) setCompactCards(true);
    } catch {
      /* storage unavailable: start from the defaults */
    }
    restored.current = true;
  }, [viewKey]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      window.localStorage.setItem(
        viewKey,
        JSON.stringify({ perspective, day: dayChoice, hideDone, byArea, compact: compactCards }),
      );
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  }, [viewKey, perspective, dayChoice, hideDone, byArea, compactCards]);
  const view = useTripViewPrefs();

  /** Trip documents linked to each stop, for the document mark on its card. */
  const docsByStop = new Map<string, string[]>();
  for (const doc of bookingDocs.docs) {
    if (!doc.itinerary_item_id) continue;
    docsByStop.set(doc.itinerary_item_id, [
      ...(docsByStop.get(doc.itinerary_item_id) ?? []),
      doc.id,
    ]);
  }
  const docProps = (item: ItineraryRow) => {
    const ids = docsByStop.get(item.id);
    if (!ids?.length) return {};
    return {
      linkedDocuments: ids.length,
      // One opens straight onto its detail; several open the library on
      // this stop's documents.
      onOpenDocuments: () =>
        void navigate({
          to: "/profile/documents",
          search: ids.length === 1 ? { doc: ids[0]! } : { event: item.id },
        }),
    };
  };

  /** The Bookings tab, on one kind — for the Overview's tiles and the trip menu. */
  const openBookings = (kind: BookingFilter) => {
    setBookingFilter(kind);
    setPerspective("bookings");
  };

  // Arriving with a request in the link (Plan with Béa, a booking link):
  // after the saved tab is restored, so the request wins over it.
  useEffect(() => {
    if (openView === "bookings") setPerspective("bookings");
    if (openPlan) {
      setPlannerTab(openPlan.tab);
      setPlannerAsk(openPlan.ask ?? "");
      setPlannerOpen(true);
    }
    // Once per arrival; the link is not a setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * "+ Add stop between": where the next added stop goes. The form stays
   * open after a save, so each further stop lands after the one before it
   * rather than all of them after the first anchor.
   */
  const [savedOpen, setSavedOpen] = useState(false);
  /** "Add stop" chooser: a stop, a saved place, or another city. */
  const [addOpen, setAddOpen] = useState(false);
  /** Bumped by "Another city or location" to open the add-city form. */
  const [citySignal, setCitySignal] = useState(0);
  // Where "Add" from Saved places lands: the day in view, if it is one day.
  const addToDay = chosenDay !== ALL_DAYS && chosenDay !== "" ? chosenDay : null;
  const addToDayLabel = addToDay
    ? (timelineGroups.find((group) => group.key === addToDay)?.label ?? null)
    : null;

  /** A stop tapped on Companion's ribbon or tracker, to look at without moving Now. */
  const [peekId, setPeekId] = useState<string | null>(null);

  /** "Locate on map" from a Timeline card: the stop the Map tab opens on. */
  const [mapFocus, setMapFocus] = useState<string | null>(null);
  const locate = (item: ItineraryRow) => {
    if (item.day_date) setDayChoice(item.day_date);
    setMapFocus(item.id);
    setPerspective("map");
  };

  const [addBetween, setAddBetween] = useState<{ afterId: string; time: string } | null>(null);
  const insertAnchor = useRef<string | null>(null);

  /** Done and not done from the Day tab, with an undo that restores exactly. */
  const toggleDone = (item: ItineraryRow) => {
    const write = toggleDoneWrite(item, new Date());
    const wasDone = isDone(item);
    void board.setProgress([{ id: write.id, patch: write.patch }]).then(
      () =>
        toast(
          wasDone
            ? `${item.title}: not done`
            : hideDone
              ? `${item.title}: done, and off the Not visited list`
              : `${item.title}: done`,
          {
            action: {
              label: "Undo",
              onClick: () => void board.setProgress([{ id: write.id, patch: write.undo }]),
            },
          },
        ),
      (e: unknown) => toast.error(e instanceof Error ? e.message : "That didn't save."),
    );
  };
  // Now follows one day: the one picked, or today when every day is showing.
  const companionDay =
    chosenDay === ALL_DAYS
      ? (timelineGroups.find((group) => group.key !== "" && group.key === todayKey) ??
        // A one-day trip has no day strip to pick from, so there is only
        // one day to follow. Without this it asked for a choice it hid.
        (timelineGroups.length === 1 ? timelineGroups[0]! : null))
      : (shownGroups[0] ?? null);
  const nowStops = companionDay ? companionStops(companionDay.items) : [];
  // Only a stop on the day being followed; another day's pick closes itself.
  const peekStop = nowStops.find((stop) => stop.id === peekId) ?? null;
  // Each journey between the trip's stops, in Companion's own order: worked
  // out now, kept on the phone, or saved on the itinerary. Companion used to
  // read only the first two, so legs added to the timeline never reached it.
  const tripStopsForNow = companionStops(board.items);
  const nowLegs = tripStopsForNow
    .slice(0, -1)
    .map((stop, i) => travelInto(stop, tripStopsForNow[i + 1]!, true));
  const tripWide = {
    international: cities.countries.length > 1 || Boolean(trip.country),
    // Asked by glyph, not by raw kind. A flight stores as "flight" and a
    // hotel as "hotel", so comparing strings here is how both of these
    // quietly answered no for every imported trip.
    hasLodging: board.items.some((item) => timelineGlyph(item) === "lodging"),
    hasFlights: board.items.some((item) => timelineGlyph(item) === "transport"),
  };
  // Whose money the currency sheet offers: the trip's country, then its cities'.
  const tripCountries = [trip.country, ...cities.countries];

  // Numbered over the whole trip: Rio's first day is still Day 4.
  const cityDayKeys = new Set(timelineGroups.map((group) => group.key));
  const chips = chosenCity
    ? dayChips(allDayGroups, todayKey).filter((chip) => cityDayKeys.has(chip.key))
    : dayChips(allDayGroups, todayKey);
  const ordinalFor = (key: string) => chips.find((chip) => chip.key === key)?.ordinal ?? "";
  const datedDayCount = chips.filter((chip) => chip.key).length;
  const companionOrdinal = companionDay ? ordinalFor(companionDay.key) : "";
  const companionPlace =
    (companionDay?.key ? routeCityOn(cities.stops, companionDay.key) : "")?.split(",")[0]?.trim() ||
    trip.city?.split(",")[0]?.trim() ||
    trip.title;
  const companionDateLine = companionDay?.key
    ? new Date(`${companionDay.key}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";
  const cityNames = cities.stops.map((stop) => stop.city);
  const tripArt = bannerArtUrl(
    bannerSceneFor(
      [trip.title, ...cityNames, trip.city, trip.country],
      trip.title || trip.city || "",
    ),
  );
  const companionArt = bannerArtUrl(
    bannerSceneFor(
      [companionPlace, trip.title, ...cityNames, trip.city, trip.country],
      companionPlace || trip.title || "",
    ),
  );
  /** Booked stops by kind, for the trip menu's Flights, Hotels, Transport and Activities. */
  const bookingCounts: Record<BookingTile, number> = countBookings(
    tripBookings(stopItems, bookingDocs.docs),
  );
  /** "+ Add a stop between" on a connector: the form opens at the time between them. */
  const openAddBetween = (item: ItineraryRow, next: ItineraryRow) => {
    insertAnchor.current = null;
    setAddBetween({ afterId: item.id, time: midpointTime(item.time_label, next.time_label) });
    setAddDay(item.day_date ?? "");
    setAddingTimeline(true);
  };

  const tripNote = beaTripNote(
    {
      startDate: trip.start_date,
      endDate: trip.end_date,
      stopCount: cities.stops.length,
      plannedCount: stopItems.length,
    },
    toLocalISODate(new Date()),
  );

  return (
    // Edge to edge on a phone, a card from tablet width up. `overflow-clip`,
    // not hidden: hidden makes this the scroll box and the pinned banner would
    // never stick.
    <article className="overflow-clip sm:mx-4 sm:mt-3 sm:rounded-3xl sm:border sm:border-border sm:bg-card">
      {/* The master's trip header: the name large, where and when under it,
          and the trip menu. The same view-transition name as the card that
          opened it, so the move reads as one object. */}
      <header
        className="flex items-start justify-between gap-3 px-4 pt-3"
        style={{ viewTransitionName: `trip-photo-${trip.id}` }}
      >
        <div className="min-w-0">
          <h1 className="break-words font-display text-[40px] leading-[1.02]">{trip.title}</h1>
          <p className="mt-1 text-[14.5px] text-muted-foreground">
            {[
              formatTripLocation(trip.city?.split(",")[0], trip.country),
              tripDateLine(trip.start_date, trip.end_date),
              trip.dates_status === "tentative" ? "tentative" : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {companionsLine ? (
            <p className="text-[13px] text-muted-foreground">{companionsLine}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setSettingsOpen(true);
            setSheetSection(null);
          }}
          title="Trip menu"
          aria-label="Trip menu"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card shadow-xs"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      </header>
      {/* Béa's line scrolls away with the page; only the bar above stays. */}
      {tripNote ? (
        <p className="px-3 pt-2.5 text-[13px] text-muted-foreground">{tripNote}</p>
      ) : null}
      {/* The prototype's labelled action pills, on one line: the row scrolls
          sideways rather than wrapping on a narrow phone. */}
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
        <button
          data-guide="bea-plan"
          title="Let Béa plan this trip"
          onClick={() => {
            setPlannerTab("start");
            setPlannerOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-primary/30 bg-primary/10 py-1 pl-1 pr-2.5 text-xs font-semibold text-primary shadow-2xs transition-all active:scale-95"
        >
          <img src={logo} alt="" className="size-5 object-contain" />
          Plan with Béa
        </button>
        <button
          data-guide="trip-prep"
          title="To-dos and packing for this trip"
          onClick={() => setPrepSignal((n) => n + 1)}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs transition-all active:scale-95"
        >
          <ListChecks className="size-3.5 text-primary" aria-hidden />
          To do
        </button>
        <button
          title="Convert prices into your money"
          onClick={() => setCurrencyOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs transition-all active:scale-95"
        >
          <Coins className="size-3.5 text-primary" aria-hidden />
          Currency
        </button>
        <button
          data-guide="add-stop"
          title="Add a stop, a saved place or a city"
          onClick={() => setAddOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-2xs transition-all active:scale-95"
        >
          <Plus className="size-3.5" aria-hidden />
          Add stop
        </button>
        <span className="ml-auto hidden shrink-0 pl-1 text-[11px] text-muted-foreground sm:inline">
          {[
            stopItems.length ? `${stopItems.length} entries` : "",
            cities.stops.length ? `${cities.stops.length} stops` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <div className="section-stagger border-t border-border px-3 pb-4 pt-3">
        <div
          hidden={others.length === 0}
          className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5"
        >
          <div className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-nexttime" />
            <p className="text-[11.5px] text-muted-foreground">
              {others.length === 0
                ? "You're the only one here right now"
                : others.some((o) => o.editing)
                  ? `${others.find((o) => o.editing)?.name} is editing ${others.find((o) => o.editing)?.editing}`
                  : `${others.map((o) => o.name).join(", ")} ${others.length === 1 ? "is" : "are"} here`}
            </p>
          </div>
          <div className="flex -space-x-1.5">
            {others.slice(0, 3).map((o) => (
              <span
                key={o.userId}
                title={o.name}
                className="grid size-6 place-items-center rounded-full border border-card bg-primary text-[11.5px] font-semibold text-primary-foreground"
              >
                {o.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* The master's segmented control, holding Béa's four views, with
            the chosen one filled in the theme accent. */}
        <nav
          role="tablist"
          aria-label="How to look at this trip"
          className="mb-3 flex items-center gap-1 rounded-full bg-elevated p-1"
        >
          {TRIP_PERSPECTIVES.map((p) => {
            const on = p.id === perspective;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={p.label}
                onClick={() => setPerspective(p.id)}
                className={`min-h-10 flex-1 whitespace-nowrap rounded-full px-2 text-center text-[14px] transition-colors sm:text-[15px] ${
                  on
                    ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {/* The master's short label on a phone. */}
                {"shortLabel" in p ? (
                  <>
                    <span className="hidden sm:inline">{p.label}</span>
                    <span className="sm:hidden">{p.shortLabel}</span>
                  </>
                ) : (
                  p.label
                )}
              </button>
            );
          })}
        </nav>

        {/* Several cities: pick one and the days, the map and Now all follow
            it, instead of scrolling past one city to reach the next. */}
        {stopItems.length > 0 &&
          routeCities.length > 1 &&
          (perspective === "companion" ||
            perspective === "map" ||
            (perspective === "timeline" && timelineByDay)) && (
            <div className="mb-3">
              <div
                role="tablist"
                aria-label="Which city to show"
                className="no-scrollbar -mx-1 flex w-full gap-1.5 overflow-x-auto px-1 py-0.5"
              >
                {[
                  { id: "", city: "All cities", arrive_on: null, depart_on: null },
                  ...routeCities,
                ].map((c) => {
                  const on = (chosenCity?.id ?? "") === c.id;
                  const dates = [c.arrive_on, c.depart_on !== c.arrive_on ? c.depart_on : null]
                    .filter((d): d is string => Boolean(d))
                    .map((d) =>
                      new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      }),
                    )
                    .join(" – ");
                  return (
                    <button
                      key={c.id || "all"}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => {
                        setCityChoice(c.id ?? "");
                        // The city's days, not a day from the city before.
                        setDayChoice(ALL_DAYS);
                      }}
                      className={`inline-flex shrink-0 flex-col items-start rounded-xl border px-3 py-1.5 text-left transition-all ${
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-elevated text-foreground"
                      }`}
                    >
                      <span className="whitespace-nowrap text-[13px] font-semibold">{c.city}</span>
                      {dates && (
                        <span
                          className={`whitespace-nowrap text-[11px] ${on ? "opacity-80" : "text-muted-foreground"}`}
                        >
                          {dates}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {chosenCity && timelineGroups.length === 0 && (
                <p className="mt-1.5 px-1 text-[12.5px] text-muted-foreground">
                  Nothing planned in {chosenCity.city} yet
                  {chosenCity.arrive_on ? "" : " — give it dates under Cities on this trip"}.
                </p>
              )}
            </div>
          )}

        {/* One day row for Companion, Map and the Timeline by day: arrows
            either side of the day cards, the chosen day filled. */}
        {stopItems.length > 0 &&
          offerDays &&
          (perspective === "companion" ||
            perspective === "map" ||
            (perspective === "timeline" && timelineByDay)) && (
            <div ref={dayCardsRef} className="mb-3">
              <DayCards chips={chips} value={chosenDay} onChange={setDayChoice} />
            </div>
          )}
        {activePerspective.hint && perspective !== "companion" ? (
          <p className="mb-3 px-0.5 text-[12px] text-muted-foreground">{activePerspective.hint}</p>
        ) : null}

        {perspective === "overview" && (
          <TripOverview
            tripId={trip.id}
            items={stopItems}
            cities={cities.stops.map((stop) => ({ city: stop.city, country: stop.country }))}
            country={trip.country}
            groups={allDayGroups}
            {...(canFindCities ? { onFindCities: findCities, findingCities } : {})}
            bookingDocs={bookingDocs.docs}
            onOpenBookings={openBookings}
            onOpenTimeline={(dayKey) => {
              if (dayKey !== undefined) setDayChoice(dayKey);
              setPerspective("timeline");
            }}
            onOpenMap={(dayKey) => {
              if (dayKey) setDayChoice(dayKey);
              setPerspective("map");
            }}
            onPrep={(tab) => setPrepAsk((cur) => ({ tab, n: (cur?.n ?? 0) + 1 }))}
          />
        )}

        {perspective === "bookings" && (
          <TripBookings
            filter={bookingFilter}
            onFilter={setBookingFilter}
            stops={stopItems}
            docs={bookingDocs.docs}
            onSaveBooking={(id, patch) => board.updateItem(id, patch)}
          />
        )}

        {perspective === "companion" && (
          <div className="space-y-3">
            {nowStops.length > 0 && companionDay ? (
              <>
                <CompanionBanner
                  art={companionArt}
                  kicker={companionOrdinal ? `${companionOrdinal} of ${datedDayCount}` : ""}
                  place={companionPlace}
                  dateLine={companionDateLine}
                  reached={companionState(nowStops).reached}
                  total={nowStops.length}
                />
                {view.prefs.ribbon && (
                  <DayRibbon
                    stops={nowStops}
                    dayLabel={companionOrdinal || undefined}
                    selectedId={peekStop?.id ?? null}
                    onSelect={setPeekId}
                  />
                )}
                {peekStop && (
                  <StopPeek
                    stop={peekStop}
                    number={nowStops.indexOf(peekStop) + 1}
                    onClose={() => setPeekId(null)}
                    onEdit={() => {
                      setPeekId(null);
                      setPerspective("timeline");
                    }}
                  />
                )}
                <NowPanel
                  key={companionDay.key}
                  dayStops={nowStops}
                  tripStops={tripStopsForNow}
                  legs={nowLegs}
                  {...(directionArea ? { area: directionArea } : {})}
                  travel={travel}
                  onProgress={board.setProgress}
                  onLook={(id) => {
                    setPeekId(id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  progress={
                    view.prefs.journey ? (
                      <JourneyTracker
                        stops={nowStops}
                        selectedId={peekStop?.id ?? null}
                        onSelect={setPeekId}
                      />
                    ) : null
                  }
                />
              </>
            ) : (
              <div className="plain-card space-y-2 p-4">
                <img
                  src="/bea/bea-think-static.png"
                  alt=""
                  className="size-16 rounded-full border border-border object-cover"
                />
                <p className="font-display text-[24px] leading-tight">
                  {stopItems.length === 0 ? "Nothing on this trip yet." : "Pick a day to follow."}
                </p>
                <p className="text-[14px] text-muted-foreground">
                  {stopItems.length === 0
                    ? "Add stops in the Timeline Editor, or let Béa draft the days from a plan you already have."
                    : "Companion walks through one day with you: where you are, what is next, and when to set off. On a travel day it opens on today by itself."}
                </p>
                {/* The days right here, so the prompt is never a dead end. */}
                {stopItems.length > 0 && (
                  <div
                    role="group"
                    aria-label="Day to follow"
                    className="flex flex-wrap gap-1.5 pt-1"
                  >
                    {chips
                      .filter((chip) => chip.count > 0)
                      .map((chip) => (
                        <button
                          key={chip.key || "undated"}
                          type="button"
                          onClick={() => setDayChoice(chip.key)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold"
                        >
                          {chip.ordinal ? (
                            <span className="text-primary">{chip.ordinal}</span>
                          ) : null}
                          {chip.label}
                          <span className="text-[11.5px] font-normal text-muted-foreground">
                            {chip.count}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mounted only while showing: Leaflet cannot lay out in a hidden box. */}
        {perspective === "map" && (
          <div className="space-y-3">
            {stopItems.length > 0 && (
              <DayMapView
                key={`${chosenDay}:${mapFocus ?? ""}`}
                focusId={mapFocus}
                groups={shownGroups}
                nesting={view.prefs.nesting}
                area={formatTripLocation(trip.city, trip.country)}
                todayKey={todayKey}
                ordinals={Object.fromEntries(chips.map((chip) => [chip.key, chip.ordinal]))}
                legFor={travelInto}
              />
            )}
            {/* The whole trip, city to city — only when looking at the whole
                trip. Under a single day it was a second, busier map repeating
                the first. The same stop list the directions are built from,
                so the map and the route can never describe different journeys. */}
            {!chosenCity && shownGroups.length > 1 && (
              <TripMap stops={routeStops} {...(directionArea ? { area: directionArea } : {})} />
            )}
          </div>
        )}

        {/* Day and Trip stay mounted and are hidden instead, so an edit in
            progress survives a tab switch and the action row's buttons can
            open their forms from any tab. */}
        <div hidden={perspective !== "timeline"}>
          {perspective === "timeline" && timelineByDay && offerDays && stopItems.length > 0 && (
            <StickyDayBar
              chips={chips}
              value={chosenDay}
              onChange={setDayChoice}
              anchor={dayCardsRef}
              onCurrency={() => setCurrencyOpen(true)}
            />
          )}
          <div data-guide="trip-timeline" className="plain-card px-3 pb-3 pt-4">
            {editingTimeline && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-primary-soft px-3 py-2">
                <p className="text-[13px] font-semibold text-primary">Editing every stop at once</p>
                <button
                  type="button"
                  onClick={() => setEditingTimeline(false)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary px-3 text-[13px] font-semibold text-primary-foreground"
                >
                  <Check className="size-4" aria-hidden />
                  Done editing
                </button>
              </div>
            )}

            {stopItems.length === 0 ? (
              <>
                <TimelineHead
                  title="Your itinerary"
                  line="Activities, meals, transport and notes."
                  onAdd={() => {
                    setAddDay(addToDay ?? "");
                    setAddingTimeline(true);
                  }}
                  addLabel="Add to the timeline"
                />
                <p className="px-1 py-4 text-[14px] text-muted-foreground">
                  Nothing planned yet. Add a stop, or let Béa draft the days from a plan you already
                  have.
                </p>
              </>
            ) : timelineByDay ? (
              <div className="space-y-6">
                {shownGroups.map((group) => {
                  const dayOpen = !collapsedDays[group.key];
                  const isToday = group.key === todayKey;
                  const divider = isToday ? nowDivider(group.items, minutesNow) : null;
                  const coming = isToday ? nextUp(group.items, minutesNow) : null;
                  const untilNext = minutesUntilLabel(coming, minutesNow);
                  // Both read the day as written: one says where the clock
                  // and the distances disagree, the other says which stops
                  // are close enough that their order stops mattering.
                  const tight = dayTightnessNote(group.items);
                  const runLabels = runLabelsByIndex(walkableRuns(group.items));
                  const visited = group.items.filter(isDone).length;
                  const length = dayLengthLabel(group.items, travelInto);
                  return (
                    <section
                      key={group.key || "undated"}
                      data-day-key={group.key}
                      className="min-w-0"
                    >
                      <TimelineHead
                        title={dayTitle(group.key, ordinalFor(group.key), group.label)}
                        line={[
                          `${group.items.length} ${group.items.length === 1 ? "stop" : "stops"}`,
                          length,
                          visited ? `${visited} visited` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        open={dayOpen}
                        onToggle={() =>
                          setCollapsedDays((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                        }
                        onAdd={() => {
                          setAddDay(group.key);
                          setAddingTimeline(true);
                        }}
                        addLabel={`Add something to ${group.label}`}
                        onMore={() => setTimelineMenuOpen(true)}
                        {...directionsButton}
                      >
                        {coming && (
                          <span className="mt-1 block text-[12.5px] font-semibold text-primary">
                            Next: {coming.title}
                            {untilNext ? ` · ${untilNext}` : ""}
                          </span>
                        )}
                        {/* Two numbers the plan already carries, put next to
                            each other. Never a verdict on the day. */}
                        {tight && (
                          <span className="mt-1 block text-[12.5px] text-muted-foreground">
                            {tight}
                          </span>
                        )}
                      </TimelineHead>
                      {dayOpen && dayMaps.maps[group.key] && (
                        <details className="mb-2 rounded-2xl bg-elevated p-2">
                          <summary className="cursor-pointer px-1 text-[13px] font-semibold">
                            Map of the day · saved on this phone
                          </summary>
                          <img
                            src={dayMaps.maps[group.key]}
                            alt={`Map of ${group.label}, stops numbered in order`}
                            className="mt-2 w-full rounded-xl"
                          />
                          <p className="mt-1 px-1 text-[10.5px] text-muted-foreground">
                            Stops numbered in order; the line joins them, it isn't the walking
                            route. {OSM_ATTRIBUTION} · {GEOAPIFY_ATTRIBUTION} ·{" "}
                            {OVERTURE_ATTRIBUTION}
                          </p>
                        </details>
                      )}
                      {dayOpen && (
                        <ol className="relative min-w-0 space-y-1 overflow-x-hidden py-1">
                          <RailLine />
                          {hidingDone && group.items.every(isDone) && (
                            <li className="list-none py-2 pl-[5.25rem] text-[13px] text-muted-foreground">
                              ✓ Every stop on this day is visited.
                            </li>
                          )}
                          {byArea && !editingTimeline
                            ? groupByArea(
                                group.items.filter((item) => !(hidingDone && isDone(item))),
                              ).map((area) => (
                                <Fragment key={area.area}>
                                  <li className="relative z-10 flex list-none items-center gap-1.5 pl-[5.25rem] pt-2 text-[12.5px] font-semibold text-muted-foreground">
                                    <MapPin className="size-3.5 text-primary" aria-hidden />
                                    <span>
                                      {area.area}
                                      <span className="font-normal">
                                        {` · ${area.items.length} ${area.items.length === 1 ? "stop" : "stops"}`}
                                      </span>
                                    </span>
                                  </li>
                                  {area.items.map((item) => (
                                    <TimelineEntry
                                      compact={compactCards && !editingTimeline}
                                      key={item.id}
                                      item={item}
                                      showDay={false}
                                      number={group.items.indexOf(item) + 1}
                                      onLocate={() => locate(item)}
                                      onSaveBooking={(patch) => board.updateItem(item.id, patch)}
                                      {...docProps(item)}
                                      onToggleDone={() => toggleDone(item)}
                                      {...withNear(item.day_date)}
                                      {...nestProps(item)}
                                      onEdit={(field) => board.setEditing(field)}
                                      onUpdate={(patch) => void board.updateItem(item.id, patch)}
                                      onRemove={() => void removeTimelineItem(item)}
                                      tripStart={trip.start_date}
                                      tripEnd={trip.end_date}
                                      onKeep={keepItemAsReco}
                                      kept={isKept(item)}
                                      stray={strayIds.has(item.id)}
                                      {...foldProps(item)}
                                    />
                                  ))}
                                </Fragment>
                              ))
                            : (() => {
                                // Drag to reorder: a grip on each card, inside
                                // the day, not while editing every card at once.
                                const sortable = !editingTimeline && group.items.length > 1;
                                const dragging = draggingDay === group.key;
                                const rows = group.items.map((item, dayIndex) => {
                                  if (hidingDone && isDone(item)) return null;
                                  const entry = (bind?: SortableBind) => (
                                    <TimelineEntry
                                      {...(bind ?? {})}
                                      compact={compactCards && !editingTimeline}
                                      item={item}
                                      showDay={false}
                                      number={dayIndex + 1}
                                      showSwipeHint={dayIndex === 0}
                                      onLocate={() => locate(item)}
                                      onSaveBooking={(patch) => board.updateItem(item.id, patch)}
                                      {...docProps(item)}
                                      onToggleDone={() => toggleDone(item)}
                                      editing={editingTimeline}
                                      {...withNear(item.day_date)}
                                      {...nestProps(item)}
                                      onEdit={(field) => board.setEditing(field)}
                                      onUpdate={(patch) => void board.updateItem(item.id, patch)}
                                      onRemove={() => void removeTimelineItem(item)}
                                      {...moveProps(item)}
                                      tripStart={trip.start_date}
                                      tripEnd={trip.end_date}
                                      onKeep={keepItemAsReco}
                                      kept={isKept(item)}
                                      stray={strayIds.has(item.id)}
                                      {...foldProps(item)}
                                    />
                                  );
                                  // The next stop on the list as shown, so the
                                  // connector never points at a hidden one.
                                  const next = group.items
                                    .slice(dayIndex + 1)
                                    .find((n) => !(hidingDone && isDone(n)));
                                  return (
                                    <Fragment key={item.id}>
                                      {!dragging && divider === dayIndex && <NowLine />}
                                      {/* A run of stops close enough together to
                                          be one decision rather than several. A
                                          label, not a container. */}
                                      {!dragging && runLabels.has(dayIndex) && (
                                        <li className="relative z-10 list-none pl-[5.25rem] pt-1 text-[12px] text-muted-foreground">
                                          {runLabels.get(dayIndex)}
                                        </li>
                                      )}
                                      {sortable ? (
                                        <SortableStop id={item.id} title={item.title}>
                                          {entry}
                                        </SortableStop>
                                      ) : (
                                        entry()
                                      )}
                                      {next && !editingTimeline && !dragging && (
                                        <TravelConnector
                                          from={item}
                                          to={next}
                                          leg={travelInto(item, next)}
                                          area={directionArea ?? ""}
                                          showTime={view.prefs.walkTimes}
                                          onAddBetween={() => openAddBetween(item, next)}
                                          fromNumber={dayIndex + 1}
                                        />
                                      )}
                                    </Fragment>
                                  );
                                });
                                if (!sortable) return rows;
                                return (
                                  <SortableDay
                                    ids={group.items
                                      .filter((item) => !(hidingDone && isDone(item)))
                                      .map((item) => item.id)}
                                    onDragging={(on) => setDraggingDay(on ? group.key : null)}
                                    onDrop={(activeId, overId) => {
                                      const move = dropMove(stopItems, activeId, overId);
                                      if (move) void moveStops([move]).catch(() => undefined);
                                    }}
                                  >
                                    {rows}
                                  </SortableDay>
                                );
                              })()}
                          {divider === group.items.length && <NowLine done />}
                        </ol>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <>
                <TimelineHead
                  title="All entries"
                  line={[
                    `${stopItems.length} ${stopItems.length === 1 ? "stop" : "stops"}`,
                    doneCount ? `${doneCount} visited` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onAdd={() => {
                    setAddDay(addToDay ?? "");
                    setAddingTimeline(true);
                  }}
                  addLabel="Add to the timeline"
                  onMore={() => setTimelineMenuOpen(true)}
                  {...directionsButton}
                />
                <ol className="relative min-w-0 space-y-1 overflow-x-hidden py-1">
                  <RailLine />
                  {stopItems.map((item, i) =>
                    hidingDone && isDone(item) ? null : (
                      <Fragment key={item.id}>
                        <TimelineEntry
                          compact={compactCards && !editingTimeline}
                          item={item}
                          showDay
                          number={i + 1}
                          showSwipeHint={i === 0}
                          onLocate={() => locate(item)}
                          onSaveBooking={(patch) => board.updateItem(item.id, patch)}
                          {...docProps(item)}
                          onToggleDone={() => toggleDone(item)}
                          editing={editingTimeline}
                          {...withNear(item.day_date)}
                          {...nestProps(item)}
                          onEdit={(field) => board.setEditing(field)}
                          onUpdate={(patch) => void board.updateItem(item.id, patch)}
                          onRemove={() => void removeTimelineItem(item)}
                          {...moveProps(item)}
                          tripStart={trip.start_date}
                          tripEnd={trip.end_date}
                          onKeep={keepItemAsReco}
                          kept={isKept(item)}
                          stray={strayIds.has(item.id)}
                          {...foldProps(item)}
                        />
                        {(() => {
                          const next = stopItems
                            .slice(i + 1)
                            .find((n) => !(hidingDone && isDone(n)));
                          if (!next || editingTimeline) return null;
                          return (
                            <TravelConnector
                              from={item}
                              to={next}
                              leg={travelInto(item, next)}
                              area={directionArea ?? ""}
                              showTime={view.prefs.walkTimes}
                              onAddBetween={() => openAddBetween(item, next)}
                              fromNumber={i + 1}
                            />
                          );
                        })()}
                      </Fragment>
                    ),
                  )}
                </ol>
              </>
            )}

            {/* "Now", on a trip day: back to the stop you're at or the next
                one. Sticky at the bottom of the list while it is on screen. */}
            {nowStop && !editingTimeline && (
              <div className="pointer-events-none sticky bottom-3 z-30 mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={jumpToNow}
                  aria-label={`Jump to ${nowStop.title}`}
                  className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground shadow-lg"
                >
                  <LocateFixed className="size-4" aria-hidden />
                  Now
                </button>
              </div>
            )}

            {/* Opened from the signpost on a day's header; each leg draws
                under the entry it leaves from. */}
            <ItineraryDirections
              open={directionsOpen}
              onClose={() => setDirectionsOpen(false)}
              timelineCount={savedDirectionRows.length}
              onRemoveFromTimeline={removeDirectionRows}
              onForgetOffline={() => {
                dir.clear();
                dayMaps.clear();
                offlineMap.clear();
                setLiveLegs(null);
                toast.success("Directions deleted from this phone");
              }}
              stops={directionStops}
              travel={travel}
              onTravel={chooseTravel}
              existingTitles={board.items.map((i) => i.title)}
              onAddToTimeline={board.upsertItems}
              onKeepOffline={(result, stops) => {
                const kept = dir.keep(result, stops);
                // A picture of each day's map goes with the directions, so
                // the day can be followed with no signal at all; and, where
                // the day map is drawn from vector tiles, the map itself
                // around each day's stops, so it still pans and zooms.
                if (kept) {
                  void dayMaps.save(daysForMaps(stopItems));
                  // Every day, not only the pictures' first three weeks:
                  // the tile plan has its own cap.
                  void offlineMap.save(daysForMaps(stopItems, Infinity));
                }
                return kept;
              }}
              onLegs={setLiveLegs}
              onPlaced={(placed) => {
                // The router already found these. Keep them, so the map can
                // draw the trip and the next Refresh does not pay again.
                for (const stop of placed) {
                  void board.updateItem(stop.id, { lat: stop.lat, lon: stop.lon });
                }
              }}
              onBusy={setDirectionsBusy}
              {...(dir.saved?.signature ? { savedSignature: dir.saved.signature } : {})}
              {...(dir.saved?.savedAt ? { savedAt: dir.saved.savedAt } : {})}
              {...(directionArea ? { area: directionArea } : {})}
            />
          </div>

          {/**
           * Adding opens over the page, not under the list, so the form
           * arrives where you are looking, with the fields in reach.
           */}
          <Sheet
            open={addingTimeline}
            onClose={() => {
              setAddingTimeline(false);
              setAddDay("");
              setAddBetween(null);
            }}
            title={addBetween ? "Add a stop between" : "Add to the timeline"}
          >
            <TimelineEntryForm
              tripStart={trip.start_date}
              tripEnd={trip.end_date}
              {...(addDay ? { openDay: addDay } : {})}
              {...(addBetween?.time ? { openTime: addBetween.time } : {})}
              {...withNear(addDay || null)}
              existing={board.items.map((item) => ({
                title: item.title,
                address: item.address,
                lat: item.lat,
                lon: item.lon,
              }))}
              onAdd={
                addBetween
                  ? async (entry) => {
                      const id = await board.insertItemAfter(
                        insertAnchor.current ?? addBetween.afterId,
                        entry,
                      );
                      if (id) insertAnchor.current = id;
                      return id;
                    }
                  : board.addItem
              }
              onUpdateEntry={(id, patch) => board.updateItem(id, patch)}
              onDone={() => {
                setAddingTimeline(false);
                setAddDay("");
                setAddBetween(null);
              }}
            />
          </Sheet>

          <MoveStopSheet
            stop={movingStop}
            stops={stopItems}
            days={moveDays}
            onMove={(move) => moveStops([move])}
            onClose={() => setMovingId(null)}
          />

          {/* The list's own ⋯: which stops, in which order, and the tools. */}
          <Sheet
            open={timelineMenuOpen}
            onClose={() => setTimelineMenuOpen(false)}
            title="Timeline"
            hint={`${stopItems.length} ${stopItems.length === 1 ? "stop" : "stops"} scheduled${
              doneCount > 0 ? ` · ${doneCount} visited` : ""
            }`}
            width="sm"
          >
            <div className="space-y-4">
              {stopItems.length > 0 && (
                <TimeChangeBox
                  tripId={trip.id}
                  stops={stopItems}
                  days={moveDays}
                  onChangeTime={async (id, time) => {
                    await board.updateItem(id, { time_label: time });
                  }}
                  onApply={(moves, summary) => moveStops(moves, summary || "Plan changed")}
                  onDone={() => setTimelineMenuOpen(false)}
                />
              )}
              <MenuChoice
                label="Show"
                value={hideDone}
                onChange={setHideDone}
                options={[
                  [false, "All"],
                  [true, `Not visited (${stopItems.length - doneCount})`],
                ]}
              />
              <MenuChoice
                label="Cards"
                value={compactCards}
                onChange={setCompactCards}
                options={[
                  [false, "Full"],
                  [true, "Compact"],
                ]}
              />
              <MenuChoice
                label="List"
                value={timelineByDay}
                onChange={setTimelineByDay}
                options={[
                  [false, "All entries"],
                  [true, "By day"],
                ]}
              />
              {timelineByDay && (
                <MenuChoice
                  label="Order"
                  value={byArea}
                  onChange={setByArea}
                  options={[
                    [false, "Timeline"],
                    [true, "Neighbourhood"],
                  ]}
                />
              )}
              <div className="grid gap-2">
                {stopItems.length > 0 && (
                  <button
                    type="button"
                    aria-pressed={editingTimeline}
                    onClick={() => {
                      setEditingTimeline((v) => !v);
                      setTimelineMenuOpen(false);
                    }}
                    className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-left text-[14.5px] font-semibold"
                  >
                    {editingTimeline ? (
                      <Check className="size-4 text-primary" aria-hidden />
                    ) : (
                      <Pencil className="size-4 text-primary" aria-hidden />
                    )}
                    {editingTimeline ? "Done editing the itinerary" : "Edit the itinerary"}
                  </button>
                )}
                {stopItems.length >= 2 && (
                  <button
                    type="button"
                    data-guide="optimize-trip"
                    onClick={() => {
                      setTimelineMenuOpen(false);
                      setPlannerTab("optimize");
                      setPlannerOpen(true);
                    }}
                    className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-left text-[14.5px] font-semibold"
                  >
                    <Route className="size-4 text-primary" aria-hidden />
                    Optimize the order
                  </button>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground">
                Tap a stop to edit it · the card between stops has the way there.
              </p>
            </div>
          </Sheet>
        </div>

        {/* A sheet, opened by the "To do" button from any tab. */}
        <TripPrep
          tripId={trip.id}
          uid={me.id}
          international={tripWide.international}
          hasLodging={tripWide.hasLodging}
          hasFlights={tripWide.hasFlights}
          tripStart={trip.start_date}
          tripEnd={trip.end_date}
          openSignal={prepSignal}
          openTab={prepAsk}
        />
        {currencyOpen && (
          <CurrencySheet
            key={trip.id}
            open
            onClose={() => setCurrencyOpen(false)}
            tripId={trip.id}
            countries={tripCountries}
          />
        )}
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add to this trip" width="sm">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setAddOpen(false);
              setPerspective("timeline");
              setTimelineOpen(true);
              setAddDay(addToDay ?? "");
              setAddingTimeline(true);
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-elevated"
          >
            <Plus className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="block text-[15px] font-semibold">A stop on the itinerary</span>
              <span className="block text-[12px] text-muted-foreground">
                A place, meal or activity, in the Timeline Editor.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAddOpen(false);
              setSavedOpen(true);
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-elevated"
          >
            <Bookmark className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="block text-[15px] font-semibold">From Saved</span>
              <span className="block text-[12px] text-muted-foreground">
                A place you kept, with its address and map pin.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAddOpen(false);
              setCitySignal((n) => n + 1);
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-elevated"
          >
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="block text-[15px] font-semibold">Another city or location</span>
              <span className="block text-[12px] text-muted-foreground">
                Add a city to the trip's route.
              </span>
            </span>
          </button>
        </div>
      </Sheet>

      <TripStops tripId={trip.id} uid={me.id} openSignal={citySignal} formOnly home={trip} />

      <SavedPlacesSheet
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        city={trip.city}
        dayLabel={addToDayLabel}
        onAdd={async (place) => {
          await board.addItem({
            kind: /food|café|cafe|restaurant|bar|bakery|meal/i.test(place.category ?? "")
              ? "meal"
              : "activity",
            title: place.name,
            ...(addToDay ? { day_date: addToDay } : {}),
            ...(place.address ? { address: place.address } : {}),
            ...(place.lat != null ? { lat: place.lat } : {}),
            ...(place.lon != null ? { lon: place.lon } : {}),
          });
          toast.success(`${place.name} added${addToDayLabel ? ` to ${addToDayLabel}` : ""}`);
        }}
      />

      <ItineraryImport
        open={plannerOpen}
        onClose={() => {
          setPlannerOpen(false);
          setPlannerAsk("");
        }}
        defaultTab={plannerTab}
        initialAsk={plannerAsk}
        existingItems={stopItems.map((item) => ({
          id: item.id,
          day_date: item.day_date,
          time_label: item.time_label,
          kind: item.kind,
          title: item.title,
          detail: item.detail,
          address: item.address,
          lat: item.lat,
          lon: item.lon,
          planned_stay_minutes: item.planned_stay_minutes,
        }))}
        cities={fullRoute.map((stop) => ({
          city: stop.city,
          kind: stop.kind,
          country: stop.country || null,
          arrive_on: stop.arrive_on || null,
          depart_on: stop.depart_on || null,
          lat: stop.lat,
          lon: stop.lon,
        }))}
        planCities={routeCities}
        {...(chosenCity ? { defaultPlanCity: chosenCity.id } : {})}
        {...(trip.city || trip.country
          ? { tripCity: [trip.city, trip.country].filter(Boolean).join(", ") }
          : {})}
        tripTitle={trip.title}
        {...(trip.start_date ? { startDate: trip.start_date } : {})}
        {...(trip.end_date ? { endDate: trip.end_date } : {})}
        onAddItems={board.addItems}
        onRemoveItems={board.removeItems}
        onAddDirections={setDirectionsFor}
        onAddCosts={async (items) => {
          if (!trip.budget_enabled) await onUpdate({ budget_enabled: true });
          await budget.addItems(items);
        }}
        onApplySchedule={async (updates) => {
          // What the optimiser is about to move, as it is now, so Undo can
          // put every stop back on its own day, time and place in the list.
          const previous = updates.flatMap((u) => {
            const row = board.items.find((item) => item.id === u.id);
            return row
              ? [
                  {
                    id: row.id,
                    day_date: row.day_date,
                    time_label: row.time_label,
                    position: row.position,
                  },
                ]
              : [];
          });
          await board.applySchedule(updates);
          toast("New order saved", {
            description: `${updates.length} ${updates.length === 1 ? "stop" : "stops"} rearranged.`,
            duration: 8000,
            action: {
              label: "Undo",
              onClick: () =>
                void board.applySchedule(previous).then(
                  () => toast.success("Back to the previous order"),
                  () => toast.error("Couldn't undo that. Check your connection."),
                ),
            },
          });
        }}
        onApplyDates={async (dates) => {
          await onUpdate(dates);
        }}
        onAddCities={async (list) => {
          await cities.addStops(list);
          // A trip with no place takes the one its plan shows ("Japan").
          const place = tripPlaceFromTowns(trip, list);
          if (place) await onUpdate(place);
        }}
      />

      <TripMenuSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={trip.title}
        subtitle={[
          formatTripLocation(trip.city?.split(",")[0], trip.country),
          tripDateLine(trip.start_date, trip.end_date),
        ]
          .filter(Boolean)
          .join(" · ")}
        art={tripArt}
        section={sheetSection}
        onSection={setSheetSection}
        people={members.map((m) => m.display_name || "Traveller")}
        bookings={bookingCounts}
        onBookings={(kind) => {
          setSettingsOpen(false);
          openBookings(kind);
        }}
        citiesCount={cities.stops.length}
        offlineNote={
          dir.saved
            ? `${savedAgoLabel(dir.saved.savedAt)}${
                savedIsStale(dir.saved.signature, routeStops) ? " · out of date" : ""
              }`
            : ""
        }
        budgetOn={Boolean(trip.budget_enabled)}
        onPrint={() => {
          setSettingsOpen(false);
          printHtml(
            itineraryPrintHtml(
              {
                title: trip.title,
                subtitle: [
                  formatTripLocation(trip.city?.split(",")[0], trip.country),
                  tripDateLine(trip.start_date, trip.end_date),
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
              stopItems,
            ),
          );
        }}
        footer={
          // Only the owner can delete (the "Owner deletes trips" policy). For
          // anyone else the delete matched no rows, said nothing, and sent
          // them to the trip list as if it had worked; they leave instead,
          // from Invite and people.
          me.id === trip.owner_id ? (
            <TripDeleteButton onDelete={onDelete} onConfirmed={() => setSettingsOpen(false)} />
          ) : null
        }
      >
        {sheetSection === "invite" && (
          <TripPeople
            trip={trip}
            meId={me.id}
            members={members}
            invites={board.invites}
            onInvite={onInvite}
            onRevokeInvite={onRevokeInvite}
            onRemoveMember={onRemoveMember}
            onLeave={onLeave}
            onChanged={board.reload}
            onLeft={() => setSettingsOpen(false)}
          />
        )}

        {sheetSection === "packing" && (
          <div className="plain-card p-3.5">
            {templates.packs.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">
                No saved lists yet — create one under Profile → Create packing lists.
              </p>
            ) : (
              <>
                <p className="text-[13px] text-muted-foreground">
                  You get a copy — ticking things off only affects this trip.
                </p>
                <select
                  value={packTemplateId}
                  onChange={(e) => {
                    setPackTemplateId(e.target.value);
                    setPackMsg("");
                  }}
                  className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[14.5px]"
                >
                  <option value="">Choose a list…</option>
                  {templates.packs.map((pk) => (
                    <option key={pk.id} value={pk.id}>
                      {pk.emoji} {pk.name}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!packTemplateId}
                  onClick={async () => {
                    if (!packTemplateId) return;
                    await templates.attachToTrip(packTemplateId, trip.id);
                    setPackTemplateId("");
                    setPackMsg("List attached — open the trip to tick items off.");
                  }}
                  className="btn-primary mt-3 w-full disabled:opacity-50"
                >
                  Attach a copy to this trip
                </button>
                {packMsg && <p className="mt-2 text-[13px] text-muted-foreground">{packMsg}</p>}
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setPrepAsk((cur) => ({ tab: "packing", n: (cur?.n ?? 0) + 1 }));
              }}
              className="mt-3 inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-primary"
            >
              Open this trip's packing
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        )}

        {sheetSection === "offline" && (
          <div className="plain-card p-3.5">
            <p className="text-[13px] text-muted-foreground">
              Download the journeys between stops and Béa keeps the steps on this phone, so you
              never work them out twice. Béa still needs a connection to open, so this is not a
              no-signal map yet. Adding directions to the timeline saves the summary only.
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {cities.stops.length >= 2
                ? `Covers your ${cities.stops.length} cities, in order.`
                : "Covers the timeline stops that have a place on the map."}{" "}
              You can also keep the legs from “Directions between stops” on the trip itself.
            </p>
            <button
              disabled={dir.busy || routeStops.length < 2}
              onClick={() => void dir.download(routeStops, directionArea, travel)}
              className="btn-primary mt-3 w-full disabled:opacity-50"
            >
              {dir.busy ? "Saving…" : dir.saved ? "Refresh directions" : "Download directions"}
            </button>
            {routeStops.length < 2 && (
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                Add at least two cities to this trip first (or two timeline entries with places).
              </p>
            )}
            {dir.saved && savedIsStale(dir.saved.signature, routeStops) && (
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                Your stops have changed since this was saved — refresh to bring it up to date.
              </p>
            )}
            {dir.error && <p className="mt-2 text-[12.5px] text-destructive">{dir.error}</p>}
            {dir.saved && (
              <div className="mt-3 space-y-2">
                {dir.saved.legs.map((l, i) => (
                  <details key={i} className="rounded-xl bg-elevated px-3 py-2">
                    <summary className="cursor-pointer text-[14.5px] font-medium">
                      {l.from} → {l.to}
                      <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                        {l.distance > 0
                          ? `${modeWord(l.mode)} · ${prettyDistance(l.distance)} · ${prettyDuration(l.duration)}`
                          : unroutedLegCopy(l)}
                      </span>
                    </summary>
                    <ol className="mt-2 space-y-1">
                      {l.steps.map((s, k) => (
                        <li key={k} className="text-[13px] text-muted-foreground">
                          {s.instruction}
                          {s.distance > 0 ? ` — ${prettyDistance(s.distance)}` : ""}
                        </li>
                      ))}
                    </ol>
                    <a
                      href={l.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-[13px] font-semibold text-primary"
                    >
                      Open in maps (needs service)
                    </a>
                  </details>
                ))}
                {dir.saved.unresolved.length > 0 && (
                  <p className="text-[12px] text-muted-foreground">
                    Couldn't find on the map: {dir.saved.unresolved.join(", ")}
                  </p>
                )}
                {(dir.saved.deferred?.length || dir.saved.legs.some((l) => l.capped)) && (
                  <p className="text-[12px] text-muted-foreground">
                    Later stretches open in maps — Béa stops looking after a long list.
                  </p>
                )}
                {dayMaps.busy && (
                  <p className="text-[12px] text-muted-foreground">Saving a map of each day…</p>
                )}
                {!dayMaps.busy && Object.keys(dayMaps.maps).length > 0 && (
                  <p className="text-[12px] text-muted-foreground">
                    {Object.keys(dayMaps.maps).length} day{" "}
                    {Object.keys(dayMaps.maps).length === 1 ? "map" : "maps"} saved too — open a day
                    in the Timeline Editor to see it offline.
                  </p>
                )}
                {dayMaps.error && <p className="text-[12px] text-destructive">{dayMaps.error}</p>}
                {offlineMap.progress && (
                  <p className="text-[12px] text-muted-foreground">
                    Saving the trip's map
                    {offlineMap.progress.total > 0
                      ? ` (${Math.round((offlineMap.progress.done / offlineMap.progress.total) * 100)}%)`
                      : ""}
                    …
                  </p>
                )}
                {!offlineMap.busy && offlineMap.saved && (
                  <p className="text-[12px] text-muted-foreground">
                    The map around each day's stops is saved on this phone (
                    {prettyMegabytes(offlineMap.saved.bytes)}), so it still pans and zooms with no
                    signal.
                  </p>
                )}
                {offlineMap.error && (
                  <p className="text-[12px] text-destructive">{offlineMap.error}</p>
                )}
                <button
                  onClick={() => {
                    dir.clear();
                    dayMaps.clear();
                    offlineMap.clear();
                  }}
                  className="text-[12.5px] text-muted-foreground underline"
                >
                  Delete saved directions
                </button>
              </div>
            )}
          </div>
        )}

        {sheetSection === "budget" && (
          <div className="space-y-2">
            <TripBudgetSwitch trip={trip} onUpdate={onUpdate} />
            {trip.budget_enabled && <TripBudget tripId={trip.id} />}
          </div>
        )}

        {/* The trip's cities, in order — the route the trip map draws. */}
        {sheetSection === "cities" && (
          <TripStops
            tripId={trip.id}
            uid={me.id}
            home={trip}
            {...(canFindCities ? { onFindCities: findCities, findingCities } : {})}
          />
        )}

        {sheetSection === "customize" && (
          <div className="plain-card px-3.5 py-1">
            <CustomizeOptions prefs={view.prefs} onToggle={view.toggle} />
          </div>
        )}

        {sheetSection === "edit" && (
          <TripDetailsForm trip={trip} onUpdate={onUpdate} onSaved={() => setSettingsOpen(false)} />
        )}
      </TripMenuSheet>
    </article>
  );
}

/** The dashed line the day's numbered discs sit on. */
function RailLine() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-6 left-[calc(0.875rem-1px)] top-6 border-l-2 border-dashed border-primary/35"
    />
  );
}

/**
 * The Timeline's heading: "Day 1 · Thu, Oct 1" in the serif with the day's
 * size under it, a round + to add to that day, and ⋯ for the list's options.
 * Tapping the title folds the day away.
 */
function TimelineHead({
  title,
  line,
  open = true,
  onToggle,
  onAdd,
  addLabel,
  onMore,
  onDirections,
  directionsBusy = false,
  children,
}: {
  title: string;
  line: string;
  open?: boolean;
  onToggle?: () => void;
  onAdd: () => void;
  addLabel: string;
  onMore?: () => void;
  /** Work out the walks and drives between the stops, from the top of the list. */
  onDirections?: () => void;
  directionsBusy?: boolean;
  children?: ReactNode;
}) {
  const heading = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="block font-display text-[27px] leading-none">{title}</span>
        {onToggle ? (
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
            aria-hidden
          />
        ) : null}
      </span>
      <span className="mt-1 block text-[13.5px] text-muted-foreground">{line}</span>
      {children}
    </>
  );
  return (
    <div className="mb-2 flex items-start justify-between gap-2 border-b border-border pb-3">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          {heading}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{heading}</div>
      )}
      {onDirections ? (
        <button
          type="button"
          onClick={onDirections}
          disabled={directionsBusy}
          aria-label={directionsBusy ? "Working out directions" : "Directions between stops"}
          title="Get directions"
          className="grid size-12 shrink-0 place-items-center rounded-full border border-border bg-card text-primary shadow-xs disabled:opacity-60"
        >
          <Signpost className={`size-5 ${directionsBusy ? "animate-pulse" : ""}`} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onAdd}
        aria-label={addLabel}
        title={addLabel}
        className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
      >
        <Plus className="size-6" aria-hidden />
      </button>
      {onMore ? (
        <button
          type="button"
          onClick={onMore}
          aria-label="Timeline options"
          title="Timeline options"
          className="grid size-12 shrink-0 place-items-center rounded-full border border-border bg-card shadow-xs"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** One row of choices in the Timeline's ⋯ sheet. */
function MenuChoice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  options: readonly (readonly [boolean, string])[];
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <div role="group" aria-label={label} className="flex gap-1 rounded-full bg-elevated p-1">
        {options.map(([v, text]) => (
          <button
            key={text}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`min-h-9 flex-1 rounded-full px-3 text-[13px] transition-colors ${
              value === v
                ? "bg-primary font-semibold text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The line that says you are here.
 *
 * Borrowed from the shape everyone already reads without being taught: the
 * package-tracking rule, the boarding-pass rule. Above it is behind you,
 * below it is what is left. It needs no column on the table and no ticking
 * things off — only the clock and the times already written down — so it is
 * right on a day nobody has touched since it was imported.
 *
 * Drawn only on today, and only on a day that names at least one time. A rule
 * through an untimed list would be claiming an order the plan never had.
 */
function NowLine({ done = false }: { done?: boolean }) {
  return (
    <li aria-hidden className="relative -my-0.5 flex items-center gap-2 py-1">
      <span className="h-px flex-1 bg-primary/40" />
      <span className="text-[11.5px] font-semibold uppercase tracking-wider text-primary">
        {done ? "That was today" : "Now"}
      </span>
      <span className="h-px flex-1 bg-primary/40" />
    </li>
  );
}
