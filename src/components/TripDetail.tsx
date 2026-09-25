import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  Clock,
  Download,
  MapPin,
  ChevronDown,
  ListChecks,
  Pencil,
  Plus,
  Settings,
} from "lucide-react";
import { TripBudget } from "@/components/TripBudget";
import { TripStops } from "@/components/TripStops";
import { TripPeople } from "@/components/TripPeople";
import { TripBudgetSwitch, TripDeleteButton, TripDetailsForm } from "@/components/TripSettings";
import { Section, SectionAction } from "@/components/Section";
import { TripBanner } from "@/components/TripBanner";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import { pickTripPhoto } from "@/lib/trip-card";
import { timelineGlyph, vaultCategory } from "@/lib/timeline-kind";
import { TimelineEntryForm } from "@/components/TimelineEntryForm";
import { Sheet } from "@/components/Sheet";
import { TripMap } from "@/components/TripMap";
import { TripPrep } from "@/components/TripPrep";
import { savedAgoLabel, savedIsStale, savedMatchesStops } from "@/lib/offline-directions";
import { useUndo } from "@/hooks/useUndo";
import { addRecommendationOnce } from "@/hooks/useRecommendations";
import { toNewReco } from "@/lib/captured-place";
import { ItineraryImport } from "@/components/ItineraryImport";
import { ItineraryDirections } from "@/components/ItineraryDirections";
import { prettyDistance, prettyDuration, useOfflineDirections } from "@/hooks/useOfflineDirections";
import type { RouteLeg } from "@/lib/directions.functions";
import { useTripBoard, type ItineraryRow, type MemberRow, type TripRow } from "@/hooks/useTrips";
import { useTripStops } from "@/hooks/useTripStops";
import { useTripBudget } from "@/hooks/useTripBudget";
import { usePacking } from "@/hooks/usePacking";
import { stopsForDirections, timelineStopsForDirections } from "@/lib/direction-stops";
import { formatTripLocation } from "@/lib/place-label";
import { groupTimelineByDay } from "@/lib/timeline-groups";
import { DaySelector } from "@/components/DaySelector";
import {
  ALL_DAYS,
  dayChips,
  defaultDayChoice,
  shouldOfferDays,
  visibleGroups,
  type DayChoice,
} from "@/lib/trip-days";
import { canMove } from "@/lib/timeline-order";
import { toLocalISODate } from "@/lib/trip-dates";
import { beaTripNote } from "@/lib/trip-note";
import {
  dayShapeLine,
  dayTightnessNote,
  minutesUntilLabel,
  nextUp,
  nowDivider,
} from "@/lib/day-shape";
import { runLabelsByIndex, walkableRuns } from "@/lib/stop-grouping";
import { rowsToPlace, stopLookupTitle, stopsToPlace, tripLookupArea } from "@/lib/stop-placing";
import { geocodePlanStops } from "@/lib/geocode-plan.functions";
import { strayStopIds } from "@/lib/geocode-plan";
import { groupByArea } from "@/lib/neighbourhood";
import { autoPinTrusted } from "@/lib/match-confidence";
import { unroutedLegCopy } from "@/lib/timeline-directions";
import { tripStillEditableNote } from "@/lib/trip-copy";
import { beaLine } from "@/lib/bea-voice";
import { toast } from "sonner";
import logo from "@/assets/bea-logo.png";
import { DayMapView } from "@/components/day/DayMapView";
import { DayRibbon } from "@/components/day/DayRibbon";
import { JourneyTracker } from "@/components/day/JourneyTracker";
import { StopPeek } from "@/components/day/StopPeek";
import { NowPanel } from "@/components/day/NowPanel";
import { companionStops, isDone, toggleDoneWrite } from "@/lib/companion";
import { CustomizeOptions } from "@/components/day/CustomizeTrip";
import { SavedPlacesSheet } from "@/components/day/SavedPlacesSheet";
import { useOfflineDayMaps } from "@/hooks/useOfflineDayMaps";
import { daysForMaps } from "@/lib/day-maps";
import { GEOAPIFY_ATTRIBUTION, OSM_ATTRIBUTION } from "@/lib/geo-endpoints";
import { TravelConnector, TimelineEntry } from "@/components/day/TimelineCard";
import { isTravelLeg, legTarget, withLegNote } from "@/lib/import-stop";
import { useTripViewPrefs } from "@/hooks/useTripViewPrefs";
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
  photos,
  members,
  companionsLine,
  me,
  onInvite,
  onRevokeInvite,
  onUpdate,
  onDelete,
  onLeave,
  onRemoveMember,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  members: MemberRow[];
  companionsLine: string;
  me: { id: string | null; name: string };
  onInvite: () => Promise<string>;
  onRevokeInvite: (code: string) => Promise<void>;
  onUpdate: (patch: Partial<TripRow>) => Promise<void>;
  onDelete: () => Promise<void>;
  onLeave: () => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
}) {
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerTab, setPlannerTab] = useState<"import" | "optimize" | "compare">("import");
  // Everything on this page is about this trip, so the hooks are simply live.
  // As a card this had to be conditional, which is what made the planner button
  // fail with "Open a trip first" when pressed on a collapsed card.
  const activeId = trip.id;
  const board = useTripBoard(activeId, me);
  const { removeWithUndo } = useUndo();
  const budget = useTripBudget(activeId);
  const cities = useTripStops(activeId, me.id);
  const dir = useOfflineDirections(activeId);
  const dayMaps = useOfflineDayMaps(activeId);
  const directionStops = timelineStopsForDirections(board.items);
  const routeStops = stopsForDirections(cities.stops, board.items);
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
            stops: pending.map((row) => ({
              title: row.title,
              detail: row.address ?? null,
              address: row.address ?? null,
            })),
            area: lookupArea,
          },
        });
        if (cancelled) return;
        for (const hit of found.placed) {
          const row = pending[hit.index];
          // Saved only if it plausibly is this stop; a namesake stays
          // unplaced for the person to set, rather than pinned wrongly.
          if (!row || !autoPinTrusted({ title: row.title, address: row.address }, hit)) continue;
          await board.updateItem(row.id, { lat: hit.lat, lon: hit.lon });
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
   * Keep a timeline stop in the vault. A place worth going to on this trip is
   * a place worth remembering after it — that is the whole premise, and the
   * timeline had no way to get anything back out.
   */
  const keepItemAsReco = async (item: ItineraryRow) => {
    await addRecommendationOnce(
      toNewReco(
        {
          name: item.title,
          ...(item.address ? { address: item.address } : {}),
          ...(trip.city ? { city: trip.city } : {}),
          ...(trip.country ? { country: trip.country } : {}),
          ...(item.lat != null ? { lat: item.lat } : {}),
          ...(item.lon != null ? { lon: item.lon } : {}),
          source: `Trip: ${trip.title}`,
        },
        {
          // By glyph, so a row stored as "dinner" or "hotel" files itself
          // correctly rather than landing in the catch-all.
          category: vaultCategory(timelineGlyph(item)),
          ...(item.detail ? { notes: item.detail } : {}),
        },
      ),
    );
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
  // Pins far from the rest of the trip, saved before lookups were bounded to
  // the trip's area: flagged on their cards so they get checked.
  const strayIds = useMemo(() => strayStopIds(board.items), [board.items]);
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
  const templates = usePacking(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetSection, setSheetSection] = useState<
    "invite" | "budget" | "edit" | "offline" | "packing" | "cities" | "customize" | null
  >(null);
  const [packTemplateId, setPackTemplateId] = useState("");
  const [packMsg, setPackMsg] = useState("");
  const [prepSignal, setPrepSignal] = useState(0);
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
  const others = board.present.filter((p) => p.userId !== me.id);
  const timelineGroups = groupTimelineByDay(board.items);
  /**
   * The day on screen. Null until the traveller picks one, so the default
   * keeps tracking the data while it loads — the first render has no items,
   * and "today" only becomes answerable once they arrive. Once a choice is
   * made it sticks, and stops being recomputed underneath them.
   */
  const [dayChoice, setDayChoice] = useState<DayChoice | null>(null);
  const chosenDay = dayChoice ?? defaultDayChoice(timelineGroups, todayKey);
  const shownGroups = visibleGroups(timelineGroups, chosenDay);
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
  const doneCount = board.items.filter(isDone).length;
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
      } | null;
      const p = asPerspective(saved?.perspective);
      if (p) setPerspective(p);
      if (typeof saved?.day === "string") setDayChoice(saved.day);
      if (saved?.hideDone === true) setHideDone(true);
      if (saved?.byArea === true) setByArea(true);
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
        JSON.stringify({ perspective, day: dayChoice, hideDone, byArea }),
      );
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  }, [viewKey, perspective, dayChoice, hideDone, byArea]);
  const view = useTripViewPrefs();

  /**
   * "+ Add stop between": where the next added stop goes. The form stays
   * open after a save, so each further stop lands after the one before it
   * rather than all of them after the first anchor.
   */
  const [savedOpen, setSavedOpen] = useState(false);
  // Where "Add" from Saved places lands: the day in view, if it is one day.
  const addToDay = chosenDay !== ALL_DAYS && chosenDay !== "" ? chosenDay : null;
  const addToDayLabel = addToDay
    ? (timelineGroups.find((group) => group.key === addToDay)?.label ?? null)
    : null;

  /** A stop tapped on Companion's ribbon or tracker, to look at without moving Now. */
  const [peekId, setPeekId] = useState<string | null>(null);

  /** "Locate on map" from a Timeline card: the stop Map Split opens on. */
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
  // Fresh legs first, then saved ones while they still match the timeline.
  const nowLegs = liveLegs ?? (savedFitsTimeline ? (dir.saved?.legs ?? null) : null);
  const tripWide = {
    international: cities.countries.length > 1 || Boolean(trip.country),
    // Asked by glyph, not by raw kind. A flight stores as "flight" and a
    // hotel as "hotel", so comparing strings here is how both of these
    // quietly answered no for every imported trip.
    hasLodging: board.items.some((item) => timelineGlyph(item) === "lodging"),
    hasFlights: board.items.some((item) => timelineGlyph(item) === "transport"),
  };

  // The trip's own photo, out of the one list loaded for the whole page.
  const banner = pickTripPhoto(photos, {
    city: trip.city,
    country: trip.country,
    cities: cities.stops.map((stop) => stop.city),
  });

  const tripNote = beaTripNote(
    {
      startDate: trip.start_date,
      endDate: trip.end_date,
      stopCount: cities.stops.length,
      plannedCount: board.items.length,
    },
    toLocalISODate(new Date()),
  );

  return (
    // Edge to edge on a phone, a card from tablet width up. `overflow-clip`,
    // not hidden: hidden makes this the scroll box and the pinned banner would
    // never stick.
    <article className="overflow-clip sm:mx-4 sm:mt-3 sm:rounded-3xl sm:border sm:border-border sm:bg-card">
      {/* Pinned: where and when stay on screen while the itinerary scrolls. */}
      <div className="sticky top-0 z-30 shadow-sm">
        <TripBanner
          compact
          title={trip.title}
          city={trip.city}
          country={trip.country}
          cities={cities.stops.map((stop) => stop.city)}
          startDate={trip.start_date}
          endDate={trip.end_date}
          tentative={trip.dates_status === "tentative"}
          photo={banner}
          companions={companionsLine}
          stops={cities.stops.map((stop) => ({
            title: stop.place_name || stop.city,
            ...(stop.lat != null ? { lat: stop.lat } : {}),
            ...(stop.lon != null ? { lon: stop.lon } : {}),
          }))}
          // The same name as the card in the list, so the browser tweens the one
          // photograph between them instead of cutting.
          viewTransitionName={`trip-photo-${trip.id}`}
        />
      </div>
      {/* Béa's line scrolls away with the page; only the bar above stays. */}
      {tripNote ? (
        <p className="px-3 pt-2.5 text-[13px] text-muted-foreground">{tripNote}</p>
      ) : null}
      {/* The prototype's labelled action pills, in place of bare icons. */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <button
          data-guide="bea-plan"
          title="Let Béa plan this trip"
          onClick={() => {
            setPlannerTab("import");
            setPlannerOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 py-1 pl-1 pr-2.5 text-xs font-semibold text-primary shadow-2xs transition-all active:scale-95"
        >
          <img src={logo} alt="" className="size-5 object-contain" />
          Plan with Béa
        </button>
        <button
          data-guide="trip-prep"
          title="To-dos and packing for this trip"
          onClick={() => setPrepSignal((n) => n + 1)}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs transition-all active:scale-95"
        >
          <ListChecks className="size-3.5 text-primary" aria-hidden />
          To do
        </button>
        <button
          onClick={() => {
            setSettingsOpen(true);
            setSheetSection(null);
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs transition-all active:scale-95"
        >
          <Settings className="size-3.5 text-primary" aria-hidden />
          Settings
        </button>
        <button
          type="button"
          onClick={() => setSavedOpen(true)}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs transition-all active:scale-95"
        >
          <Bookmark className="size-3.5 text-primary" aria-hidden />
          Saved
        </button>
        <button
          data-guide="add-stop"
          title="Add a stop to this trip's itinerary"
          onClick={() => {
            // A stop on the itinerary, in the Timeline Editor. The trip's
            // cities are added in Settings → Cities on this trip.
            setPerspective("timeline");
            setTimelineOpen(true);
            setAddDay("");
            setAddingTimeline(true);
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-2xs transition-all active:scale-95"
        >
          <Plus className="size-3.5" aria-hidden />
          Add stop
        </button>
        <span className="ml-auto truncate pl-1 text-[11px] text-muted-foreground">
          {[
            board.items.length ? `${board.items.length} entries` : "",
            cities.stops.length ? `${cities.stops.length} stops` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <div className="section-stagger border-t border-border px-3 pb-4 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5">
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

        {/* One day strip for Now, Map and Day (by day), as in the prototype:
            the chosen day in charcoal, and the optimiser beside it. */}
        {board.items.length > 0 &&
          (perspective === "companion" ||
            perspective === "map" ||
            (perspective === "timeline" && timelineByDay)) && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {offerDays && (
                <div className="w-full min-w-0">
                  <DaySelector
                    chips={dayChips(timelineGroups, todayKey)}
                    value={chosenDay}
                    onChange={setDayChoice}
                  />
                </div>
              )}
            </div>
          )}

        {/* The prototype's segmented control, holding Béa's four views. */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <nav
            role="tablist"
            aria-label="How to look at this trip"
            className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-border bg-elevated p-1 sm:flex-initial"
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
                  className={`flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-center text-xs transition-all sm:flex-initial sm:px-3 ${
                    on
                      ? "bg-card font-bold text-foreground shadow-xs ring-1 ring-primary/20"
                      : "font-semibold text-muted-foreground"
                  }`}
                >
                  {/* The prototype's short label on a phone. */}
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
        </div>
        <p className="mb-3 px-0.5 text-[11px] text-muted-foreground">{activePerspective.hint}</p>

        {perspective === "companion" && (
          <div className="space-y-3">
            {nowStops.length > 0 ? (
              <>
                {/* The prototype's order: the ribbon, then the tracker. Both
                    can be tapped to look at a stop without moving Now. */}
                {view.prefs.ribbon && (
                  <DayRibbon
                    stops={nowStops}
                    dayLabel={
                      dayChips(timelineGroups, todayKey).find((c) => c.key === companionDay?.key)
                        ?.ordinal
                    }
                    selectedId={peekStop?.id ?? null}
                    onSelect={setPeekId}
                  />
                )}
                {view.prefs.journey && (
                  <JourneyTracker
                    stops={nowStops}
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
                  key={companionDay?.key ?? ""}
                  dayStops={nowStops}
                  tripStops={companionStops(board.items)}
                  legs={nowLegs}
                  {...(directionArea ? { area: directionArea } : {})}
                  onProgress={board.setProgress}
                />
              </>
            ) : (
              <div className="card-soft space-y-2 p-4">
                <p className="font-display text-[19px] leading-snug">
                  {board.items.length === 0 ? "Nothing on this trip yet." : "Pick a day to follow."}
                </p>
                <p className="text-[14px] text-muted-foreground">
                  {board.items.length === 0
                    ? "Add stops in the Timeline Editor, or let Béa draft the days from a plan you already have."
                    : "Companion walks through one day with you: where you are, what is next, and when to set off. On a travel day it opens on today by itself."}
                </p>
                {/* The days right here, so the prompt is never a dead end: the
                    strip above scrolls sideways and is easy to miss. */}
                {board.items.length > 0 && (
                  <div
                    role="group"
                    aria-label="Day to follow"
                    className="flex flex-wrap gap-1.5 pt-1"
                  >
                    {dayChips(timelineGroups, todayKey)
                      .filter((chip) => chip.count > 0)
                      .map((chip) => (
                        <button
                          key={chip.key || "undated"}
                          type="button"
                          onClick={() => setDayChoice(chip.key)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-elevated px-3 text-[13px] font-semibold"
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
            {board.items.length > 0 && (
              <DayMapView
                key={`${chosenDay}:${mapFocus ?? ""}`}
                focusId={mapFocus}
                groups={shownGroups}
                area={formatTripLocation(trip.city, trip.country)}
              />
            )}
            {/* The whole trip, city to city — only when looking at the whole
                trip. Under a single day it was a second, busier map repeating
                the first. The same stop list the directions are built from,
                so the map and the route can never describe different journeys. */}
            {shownGroups.length > 1 && (
              <TripMap stops={routeStops} {...(directionArea ? { area: directionArea } : {})} />
            )}
          </div>
        )}

        {/* Day and Trip stay mounted and are hidden instead, so an edit in
            progress survives a tab switch and the action row's buttons can
            open their forms from any tab. */}
        <div hidden={perspective !== "timeline"}>
          {board.items.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-2xs">
              <div className="min-w-0">
                <p className="text-xs font-bold">All Scheduled Stops</p>
                <p className="text-[10px] text-muted-foreground">
                  {board.items.length} {board.items.length === 1 ? "stop" : "stops"} scheduled
                  {doneCount > 0 ? ` · ${doneCount} visited` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Every stop, or only the ones still ahead. A stop swiped done
                  leaves the second list; Undo on its toast brings it back. */}
                <div
                  role="group"
                  aria-label="Which stops to show"
                  className="flex gap-0.5 rounded-xl border border-border bg-elevated p-0.5"
                >
                  {(
                    [
                      [false, "All"],
                      [true, `Not visited (${board.items.length - doneCount})`],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={String(value)}
                      type="button"
                      aria-pressed={hideDone === value}
                      onClick={() => setHideDone(value)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] transition-all ${
                        hideDone === value
                          ? "border border-border bg-card font-bold text-foreground shadow-2xs"
                          : "border border-transparent font-semibold text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {timelineByDay && (
                  <div
                    role="group"
                    aria-label="How to list the stops"
                    className="flex gap-0.5 rounded-xl border border-border bg-elevated p-0.5"
                  >
                    {(
                      [
                        [false, "Timeline"],
                        [true, "Neighbourhood"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={byArea === value}
                        onClick={() => setByArea(value)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] transition-all ${
                          byArea === value
                            ? "border border-border bg-card font-bold text-foreground shadow-2xs"
                            : "border border-transparent font-semibold text-muted-foreground"
                        }`}
                      >
                        {value ? (
                          <MapPin className="size-3" aria-hidden />
                        ) : (
                          <Clock className="size-3" aria-hidden />
                        )}
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="w-full text-[10.5px] text-muted-foreground">
                Tap a stop to edit it · the card between stops has the way there
              </span>
            </div>
          )}
          <Section
            guide="trip-timeline"
            title="Your itinerary"
            hint={
              board.items.length === 0
                ? "Activities, meals, transport and notes."
                : `${board.items.length} entr${board.items.length === 1 ? "y" : "ies"}`
            }
            open={timelineOpen}
            onToggle={() => setTimelineOpen((v) => !v)}
            actions={
              <>
                <SectionAction
                  onClick={() => {
                    setAddDay("");
                    setTimelineOpen(true);
                    setAddingTimeline(!addingTimeline);
                  }}
                >
                  {addingTimeline ? "Cancel" : "Add"}
                </SectionAction>
                {board.items.length > 0 && (
                  <SectionAction
                    icon
                    pressed={editingTimeline}
                    label={editingTimeline ? "Done editing the itinerary" : "Edit the itinerary"}
                    onClick={() => {
                      setTimelineOpen(true);
                      setEditingTimeline((v) => !v);
                    }}
                  >
                    {editingTimeline ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <Pencil className="size-4" aria-hidden />
                    )}
                  </SectionAction>
                )}
                {board.items.length >= 2 && (
                  <SectionAction
                    guide="optimize-trip"
                    onClick={() => {
                      setPlannerTab("optimize");
                      setPlannerOpen(true);
                    }}
                  >
                    Optimize
                  </SectionAction>
                )}
              </>
            }
          >
            {timelineOpen && (
              <div className="space-y-3">
                {board.items.length > 0 && (
                  <div
                    role="group"
                    aria-label="Timeline layout"
                    className="flex gap-1.5 rounded-xl border border-border bg-elevated p-1"
                  >
                    {(
                      [
                        ["list", "All entries"],
                        ["day", "By day"],
                      ] as const
                    ).map(([mode, label]) => {
                      const active = mode === "day" ? timelineByDay : !timelineByDay;
                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setTimelineByDay(mode === "day")}
                          className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
                            active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {board.items.length === 0 ? null : timelineByDay ? (
                  <div className="space-y-3">
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
                      return (
                        <div key={group.key || "undated"} className="min-w-0">
                          <div className="flex items-center gap-1 pr-1">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedDays((prev) => ({
                                  ...prev,
                                  [group.key]: !prev[group.key],
                                }))
                              }
                              aria-expanded={dayOpen}
                              className="flex min-w-0 flex-1 items-center justify-between gap-2 px-1 py-2 text-left"
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-bold leading-tight">
                                  {group.label}
                                </span>
                                <span className="block text-[12.5px] text-muted-foreground">
                                  {/* What the day is made of, not just how big it
                                      is: eighteen museums and eighteen meals are
                                      not the same Tuesday. */}
                                  {dayShapeLine(group.items) ||
                                    `${group.items.length} ${group.items.length === 1 ? "thing" : "things"}`}
                                </span>
                                {coming && (
                                  <span className="mt-0.5 block text-[12.5px] font-semibold text-primary">
                                    Next: {coming.title}
                                    {untilNext ? ` · ${untilNext}` : ""}
                                  </span>
                                )}
                                {/* Two numbers the plan already carries, put
                                    next to each other. Never a verdict on the
                                    day — the reader draws that themselves. */}
                                {tight && (
                                  <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                                    {tight}
                                  </span>
                                )}
                              </span>
                              <ChevronDown
                                className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                                  dayOpen ? "" : "-rotate-90"
                                }`}
                                aria-hidden
                              />
                            </button>
                            {group.key && (
                              <button
                                type="button"
                                aria-label={`Add something to ${group.label}`}
                                onClick={() => {
                                  setAddDay(group.key);
                                  setAddingTimeline(true);
                                }}
                                className="tap-44 grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-card"
                              >
                                <Plus className="size-3.5" aria-hidden />
                              </button>
                            )}
                          </div>
                          {dayOpen && dayMaps.maps[group.key] && (
                            <details className="mb-2 rounded-xl border border-border bg-card p-2 shadow-2xs">
                              <summary className="cursor-pointer px-1 text-xs font-semibold">
                                Map of the day · saved on this phone
                              </summary>
                              <img
                                src={dayMaps.maps[group.key]}
                                alt={`Map of ${group.label}, stops numbered in order`}
                                className="mt-2 w-full rounded-lg"
                              />
                              <p className="mt-1 px-1 text-[10.5px] text-muted-foreground">
                                Stops numbered in order; the line joins them, it isn't the walking
                                route. {OSM_ATTRIBUTION} · {GEOAPIFY_ATTRIBUTION}
                              </p>
                            </details>
                          )}
                          {dayOpen && (
                            <ol className="relative mb-2 min-w-0 space-y-2 overflow-x-hidden py-1">
                              {hidingDone && group.items.every(isDone) && (
                                <li className="list-none px-2 py-2 text-[13px] text-muted-foreground">
                                  ✓ Every stop on this day is visited.
                                </li>
                              )}
                              {byArea && !editingTimeline
                                ? groupByArea(
                                    group.items.filter((item) => !(hidingDone && isDone(item))),
                                  ).map((area) => (
                                    <Fragment key={area.area}>
                                      <li className="flex list-none items-center gap-1.5 px-1 pt-1 text-[12.5px] font-semibold text-muted-foreground">
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
                                          key={item.id}
                                          item={item}
                                          showDay={false}
                                          number={group.items.indexOf(item) + 1}
                                          onLocate={() => locate(item)}
                                          onSaveBooking={(patch) =>
                                            board.updateItem(item.id, patch)
                                          }
                                          onToggleDone={() => toggleDone(item)}
                                          {...(directionArea ? { near: directionArea } : {})}
                                          {...(tripCenter ? { center: tripCenter } : {})}
                                          onEdit={(field) => board.setEditing(field)}
                                          onUpdate={(patch) =>
                                            void board.updateItem(item.id, patch)
                                          }
                                          onRemove={() => void removeTimelineItem(item)}
                                          tripStart={trip.start_date}
                                          tripEnd={trip.end_date}
                                          onKeep={keepItemAsReco}
                                          stray={strayIds.has(item.id)}
                                          {...foldProps(item)}
                                        />
                                      ))}
                                    </Fragment>
                                  ))
                                : group.items.map((item, dayIndex) =>
                                    hidingDone && isDone(item) ? null : (
                                      <Fragment key={item.id}>
                                        {divider === dayIndex && <NowLine />}
                                        {/* A run of stops close enough together to be
                                      one decision rather than several. A label,
                                      not a container: the rows underneath are
                                      unchanged, and still reorder one at a
                                      time. */}
                                        {runLabels.has(dayIndex) && (
                                          <li className="-mb-1 list-none pt-1 text-[12px] text-muted-foreground">
                                            {runLabels.get(dayIndex)}
                                          </li>
                                        )}
                                        <TimelineEntry
                                          item={item}
                                          showDay={false}
                                          number={dayIndex + 1}
                                          showSwipeHint={dayIndex === 0}
                                          onLocate={() => locate(item)}
                                          onSaveBooking={(patch) =>
                                            board.updateItem(item.id, patch)
                                          }
                                          onToggleDone={() => toggleDone(item)}
                                          editing={editingTimeline}
                                          {...(directionArea ? { near: directionArea } : {})}
                                          {...(tripCenter ? { center: tripCenter } : {})}
                                          onEdit={(field) => board.setEditing(field)}
                                          onUpdate={(patch) =>
                                            void board.updateItem(item.id, patch)
                                          }
                                          onRemove={() => void removeTimelineItem(item)}
                                          onMove={(direction) =>
                                            void board.moveItem(item.id, direction)
                                          }
                                          canMoveUp={canMove(board.items, item.id, -1)}
                                          canMoveDown={canMove(board.items, item.id, 1)}
                                          tripStart={trip.start_date}
                                          tripEnd={trip.end_date}
                                          onKeep={keepItemAsReco}
                                          stray={strayIds.has(item.id)}
                                          {...foldProps(item)}
                                        />
                                        {(() => {
                                          // The next stop on the list as shown, so
                                          // the paw never points at a hidden one.
                                          const next = group.items
                                            .slice(dayIndex + 1)
                                            .find((n) => !(hidingDone && isDone(n)));
                                          if (!next || editingTimeline) return null;
                                          const leg = legFor(item.id, next.id);
                                          return (
                                            <TravelConnector
                                              from={item}
                                              to={next}
                                              leg={leg}
                                              area={directionArea ?? ""}
                                              showTime={view.prefs.walkTimes}
                                            />
                                          );
                                        })()}
                                      </Fragment>
                                    ),
                                  )}
                              {divider === group.items.length && <NowLine done />}
                            </ol>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ol className="relative min-w-0 space-y-3 overflow-x-hidden">
                    {board.items.map((item, i) =>
                      hidingDone && isDone(item) ? null : (
                        <Fragment key={item.id}>
                          <TimelineEntry
                            item={item}
                            showDay
                            number={i + 1}
                            showSwipeHint={i === 0}
                            onLocate={() => locate(item)}
                            onSaveBooking={(patch) => board.updateItem(item.id, patch)}
                            onToggleDone={() => toggleDone(item)}
                            editing={editingTimeline}
                            {...(directionArea ? { near: directionArea } : {})}
                            {...(tripCenter ? { center: tripCenter } : {})}
                            onEdit={(field) => board.setEditing(field)}
                            onUpdate={(patch) => void board.updateItem(item.id, patch)}
                            onRemove={() => void removeTimelineItem(item)}
                            onMove={(direction) => void board.moveItem(item.id, direction)}
                            canMoveUp={canMove(board.items, item.id, -1)}
                            canMoveDown={canMove(board.items, item.id, 1)}
                            tripStart={trip.start_date}
                            tripEnd={trip.end_date}
                            onKeep={keepItemAsReco}
                            stray={strayIds.has(item.id)}
                            {...foldProps(item)}
                          />
                          {(() => {
                            const next = board.items
                              .slice(i + 1)
                              .find((n) => !(hidingDone && isDone(n)));
                            if (!next || editingTimeline) return null;
                            return (
                              <TravelConnector
                                from={item}
                                to={next}
                                leg={legFor(item.id, next.id)}
                                area={directionArea ?? ""}
                                showTime={view.prefs.walkTimes}
                              />
                            );
                          })()}
                        </Fragment>
                      ),
                    )}
                  </ol>
                )}

                {/**
                 * Adding opens over the page, not under the list.
                 *
                 * This form used to render after every entry on the timeline, so
                 * on a trip with a day's worth of stops the Add button scrolled
                 * a form into existence somewhere below the fold. Over the page
                 * it arrives where you are looking, with the fields in reach.
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
                    {...(directionArea ? { near: directionArea } : {})}
                    {...(tripCenter ? { center: tripCenter } : {})}
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
              </div>
            )}

            {/* Directions live with the stops they join rather than in a section
                of their own: this is the control strip, and each leg draws under
                the entry it leaves from. */}
            <ItineraryDirections
              stops={directionStops}
              existingTitles={board.items.map((i) => i.title)}
              onAddToTimeline={board.upsertItems}
              onKeepOffline={(result, stops) => {
                const kept = dir.keep(result, stops);
                // A picture of each day's map goes with the directions, so the
                // day can be followed with no signal at all.
                if (kept) void dayMaps.save(daysForMaps(board.items));
                return kept;
              }}
              onLegs={setLiveLegs}
              onPlaced={(placed) => {
                // The router already found these. Keep them, so the map can draw
                // the trip and the next Refresh does not pay for the same lookups.
                for (const stop of placed) {
                  void board.updateItem(stop.id, { lat: stop.lat, lon: stop.lon });
                }
              }}
              {...(dir.saved?.signature ? { savedSignature: dir.saved.signature } : {})}
              {...(dir.saved?.savedAt ? { savedAt: dir.saved.savedAt } : {})}
              {...(directionArea ? { area: directionArea } : {})}
            />
          </Section>
        </div>

        {/* A sheet, opened by the "To do" button from any tab. */}
        <TripPrep
          tripId={trip.id}
          uid={me.id}
          international={tripWide.international}
          hasLodging={tripWide.hasLodging}
          hasFlights={tripWide.hasFlights}
          tripStart={trip.start_date}
          openSignal={prepSignal}
        />
      </div>

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
        onClose={() => setPlannerOpen(false)}
        defaultTab={plannerTab}
        existingItems={board.items.map((item) => ({
          id: item.id,
          day_date: item.day_date,
          time_label: item.time_label,
          kind: item.kind,
          title: item.title,
          detail: item.detail,
          address: item.address,
          lat: item.lat,
          lon: item.lon,
        }))}
        cities={cities.stops.map((stop) => ({
          city: stop.city,
          country: stop.country,
          arrive_on: stop.arrive_on,
          depart_on: stop.depart_on,
          lat: stop.lat,
          lon: stop.lon,
        }))}
        {...(trip.city ? { tripCity: [trip.city, trip.country].filter(Boolean).join(", ") } : {})}
        {...(trip.start_date ? { startDate: trip.start_date } : {})}
        {...(trip.end_date ? { endDate: trip.end_date } : {})}
        onAddItems={board.addItems}
        onRemoveItems={board.removeItems}
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
      />

      <Sheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={trip.title}
        width="sm"
      >
        <div className="space-y-1">
          <button
            onClick={() => setSheetSection(sheetSection === "invite" ? null : "invite")}
            className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold hover:bg-elevated"
          >
            Invite a friend
          </button>
          {sheetSection === "invite" && (
            <div className="rounded-xl bg-elevated p-3">
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
            </div>
          )}

          <button
            onClick={() => setSheetSection(sheetSection === "packing" ? null : "packing")}
            className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold hover:bg-elevated"
          >
            Attach a packing list
          </button>
          {sheetSection === "packing" && (
            <div className="rounded-xl bg-elevated p-3">
              {templates.packs.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No saved lists yet — create one under Profile → Create packing lists.
                </p>
              ) : (
                <>
                  <p className="text-[12px] text-muted-foreground">
                    You get a copy — ticking things off only affects this trip.
                  </p>
                  <select
                    value={packTemplateId}
                    onChange={(e) => {
                      setPackTemplateId(e.target.value);
                      setPackMsg("");
                    }}
                    className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
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
                    className="mt-2 w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Attach a copy to this trip
                  </button>
                  {packMsg && <p className="mt-2 text-[13px] text-muted-foreground">{packMsg}</p>}
                </>
              )}
            </div>
          )}

          <button
            onClick={() => setSheetSection(sheetSection === "offline" ? null : "offline")}
            className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold hover:bg-elevated"
          >
            Saved directions
            {dir.saved && (
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {savedAgoLabel(dir.saved.savedAt)}
                {savedIsStale(dir.saved.signature, routeStops) ? " · out of date" : ""}
              </span>
            )}
          </button>
          {sheetSection === "offline" && (
            <div className="rounded-xl bg-elevated p-3">
              <p className="text-[12px] text-muted-foreground">
                Download the walk or drive between stops and Béa keeps the steps on this phone, so
                you never work them out twice. Béa still needs a connection to open, so this is not
                a no-signal map yet. Adding directions to the timeline saves the summary only.
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {cities.stops.length >= 2
                  ? `Covers your ${cities.stops.length} cities, in order.`
                  : "Covers the timeline stops that have a place on the map."}{" "}
                You can also keep the legs from “Directions between stops” on the trip itself.
              </p>
              <button
                disabled={dir.busy || routeStops.length < 2}
                onClick={() => void dir.download(routeStops, directionArea)}
                className="mt-2 w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {dir.busy ? "Saving…" : dir.saved ? "Refresh directions" : "Download directions"}
              </button>
              {routeStops.length < 2 && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Add at least two cities to this trip first (or two timeline entries with places).
                </p>
              )}
              {dir.saved && savedIsStale(dir.saved.signature, routeStops) && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Your stops have changed since this was saved — refresh to bring it up to date.
                </p>
              )}
              {dir.error && <p className="mt-2 text-[12px] text-destructive">{dir.error}</p>}
              {dir.saved && (
                <div className="mt-3 space-y-2">
                  {dir.saved.legs.map((l, i) => (
                    <details key={i} className="rounded-xl bg-elevated px-3 py-2">
                      <summary className="cursor-pointer text-[14.5px] font-medium">
                        {l.from} → {l.to}
                        <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                          {l.distance > 0
                            ? `${l.mode === "walking" ? "Walk" : "Drive"} · ${prettyDistance(l.distance)} · ${prettyDuration(l.duration)}`
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
                      {Object.keys(dayMaps.maps).length === 1 ? "map" : "maps"} saved too — open a
                      day in the Timeline Editor to see it offline.
                    </p>
                  )}
                  {dayMaps.error && <p className="text-[12px] text-destructive">{dayMaps.error}</p>}
                  <button
                    onClick={() => {
                      dir.clear();
                      dayMaps.clear();
                    }}
                    className="text-[12px] text-muted-foreground underline"
                  >
                    Delete saved directions
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setSheetSection(sheetSection === "budget" ? null : "budget")}
            className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold hover:bg-elevated"
          >
            Budget Options
          </button>
          {sheetSection === "budget" && (
            <div className="space-y-2 rounded-xl bg-elevated p-3">
              <TripBudgetSwitch trip={trip} onUpdate={onUpdate} />
              {trip.budget_enabled && <TripBudget tripId={trip.id} />}
            </div>
          )}

          {/* The trip's cities, in order — the route the trip map draws. */}
          <button
            onClick={() => setSheetSection(sheetSection === "cities" ? null : "cities")}
            className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold hover:bg-elevated"
          >
            Cities on this trip
            {cities.stops.length > 0 && (
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {cities.stops.length}
              </span>
            )}
          </button>
          {sheetSection === "cities" && (
            <div className="rounded-xl bg-elevated p-3">
              <TripStops tripId={trip.id} uid={me.id} />
            </div>
          )}

          {/* What the trip page shows: the switches that sat beside the tabs. */}
          <button
            onClick={() => setSheetSection(sheetSection === "customize" ? null : "customize")}
            className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold hover:bg-elevated"
          >
            Customize this page
          </button>
          {sheetSection === "customize" && (
            <div className="rounded-xl bg-elevated px-3 py-1">
              <CustomizeOptions prefs={view.prefs} onToggle={view.toggle} />
            </div>
          )}

          <button
            onClick={() => setSheetSection(sheetSection === "edit" ? null : "edit")}
            className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold hover:bg-elevated"
          >
            Trip Options
          </button>
          {sheetSection === "edit" && (
            <div className="rounded-xl bg-elevated p-3">
              <TripDetailsForm trip={trip} onUpdate={onUpdate} />
            </div>
          )}

          {/* Only the owner can delete (the "Owner deletes trips" policy). For
              anyone else the delete matched no rows, said nothing, and sent
              them to the trip list as if it had worked; they leave instead. */}
          {me.id === trip.owner_id && (
            <TripDeleteButton onDelete={onDelete} onConfirmed={() => setSettingsOpen(false)} />
          )}
        </div>
      </Sheet>
    </article>
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
