import { Fragment, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ListChecks,
  MapPinPlus,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { DateRangeField } from "@/components/DateRangeField";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { TripBudget } from "@/components/TripBudget";
import { TripStops } from "@/components/TripStops";
import { Section, SectionAction } from "@/components/Section";
import { TripBanner } from "@/components/TripBanner";
import { TimelineGlyphMark } from "@/components/TimelineGlyph";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import { pickTripPhoto } from "@/lib/trip-card";
import { timeForRail, timelineGlyph, vaultCategory } from "@/lib/timeline-kind";
import { TimelineEntryForm } from "@/components/TimelineEntryForm";
import { Sheet } from "@/components/Sheet";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { TripMap } from "@/components/TripMap";
import { TripPrep } from "@/components/TripPrep";
import { TripToday } from "@/components/TripToday";
import { savedAgoLabel, savedIsStale, savedMatchesStops } from "@/lib/offline-directions";
import { useUndo } from "@/hooks/useUndo";
import { addRecommendationOnce } from "@/hooks/useRecommendations";
import { toNewReco } from "@/lib/captured-place";
import { ItineraryImport } from "@/components/ItineraryImport";
import { ItineraryDirections } from "@/components/ItineraryDirections";
import { prettyDistance, prettyDuration, useOfflineDirections } from "@/hooks/useOfflineDirections";
import type { RouteLeg } from "@/lib/directions.functions";
import type { ParsedPlace } from "@/lib/places.functions";
import { useTripBoard, type ItineraryRow, type MemberRow, type TripRow } from "@/hooks/useTrips";
import { useTripStops } from "@/hooks/useTripStops";
import { useTripBudget } from "@/hooks/useTripBudget";
import { usePacking } from "@/hooks/usePacking";
import {
  mapsPlaceUrl,
  stopsForDirections,
  timelineStopsForDirections,
} from "@/lib/direction-stops";
import {
  formatTripLocation,
  locationFromParsedPlace,
  placePatchForSavedRow,
} from "@/lib/place-label";
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
import { stripEmbeddedMapsUrl, syncDetailDraft, unroutedLegCopy } from "@/lib/timeline-directions";
import { tripStillEditableNote } from "@/lib/trip-copy";
import { beaLine } from "@/lib/bea-voice";
import { toast } from "sonner";
import logo from "@/assets/bea-logo.png";

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
            stops: pending.map((row) => ({ title: row.title, detail: row.address ?? null })),
            area: lookupArea,
          },
        });
        if (cancelled) return;
        for (const hit of found.placed) {
          const row = pending[hit.index];
          if (row) await board.updateItem(row.id, { lat: hit.lat, lon: hit.lon });
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
  const legFor = (index: number) =>
    liveLegs?.[index] ?? (savedFitsTimeline ? dir.saved?.legs[index] : undefined);
  const templates = usePacking(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetSection, setSheetSection] = useState<
    "invite" | "budget" | "edit" | "offline" | "packing" | null
  >(null);
  const [packTemplateId, setPackTemplateId] = useState("");
  const [packMsg, setPackMsg] = useState("");
  const [prepSignal, setPrepSignal] = useState(0);
  const [stopSignal, setStopSignal] = useState(0);
  const [inviteCode, setInviteCode] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** The member about to lose access, or null. Named, so the sheet can say who. */
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; label: string } | null>(null);
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
  const [tripForm, setTripForm] = useState({
    title: trip.title,
    city: formatTripLocation(trip.city, trip.country),
    country: trip.country ?? "",
    start_date: trip.start_date ?? "",
    end_date: trip.end_date ?? "",
    dates_status: trip.dates_status,
    status: trip.status,
  });
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
  const itemIndexById = new Map(board.items.map((item, i) => [item.id, i]));

  // The trip's own photo, out of the one list loaded for the whole page.
  const banner = pickTripPhoto(photos, {
    city: trip.city,
    country: trip.country,
    cities: cities.stops.map((stop) => stop.city),
  });

  return (
    <article className="card-soft overflow-hidden">
      <TripBanner
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
        note={beaTripNote(
          {
            startDate: trip.start_date,
            endDate: trip.end_date,
            stopCount: cities.stops.length,
            plannedCount: board.items.length,
          },
          toLocalISODate(new Date()),
        )}
        // The same name as the card in the list, so the browser tweens the one
        // photograph between them instead of cutting.
        viewTransitionName={`trip-photo-${trip.id}`}
      />
      <div className="flex items-center gap-1 p-3">
        <button
          data-guide="bea-plan"
          aria-label="Let Béa plan this trip"
          title="Let Béa plan this trip"
          onClick={() => {
            setPlannerTab("import");
            setPlannerOpen(true);
          }}
          className="relative grid size-9 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10"
        >
          <img src={logo} alt="" className="size-7 object-contain" />
          <Sparkles className="absolute -right-1 -top-1 size-3.5 rounded-full bg-card p-0.5 text-primary" />
        </button>
        <button
          data-guide="add-stop"
          aria-label="Add a stop to this trip"
          title="Add a stop"
          onClick={() => setStopSignal((n) => n + 1)}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
        >
          <MapPinPlus className="size-4" />
        </button>
        <button
          data-guide="trip-prep"
          aria-label="Things to do and packing for this trip"
          title="Before you go"
          onClick={() => setPrepSignal((n) => n + 1)}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
        >
          <ListChecks className="size-4" />
        </button>
        <button
          aria-label="Trip settings"
          onClick={() => {
            setSettingsOpen(true);
            setSheetSection(null);
          }}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
        >
          <Settings className="size-4" />
        </button>
        <span className="ml-auto truncate pl-2 text-[12.5px] text-muted-foreground">
          {[
            board.items.length ? `${board.items.length} entries` : "",
            cities.stops.length ? `${cities.stops.length} stops` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <div className="section-stagger border-t border-border px-4 pb-4 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-nexttime" />
            <p className="text-[13px] text-muted-foreground">
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

        <TripToday startDate={trip.start_date} endDate={trip.end_date} items={board.items} />

        <TripStops tripId={trip.id} uid={me.id} openSignal={stopSignal} />

        <TripPrep
          tripId={trip.id}
          uid={me.id}
          international={cities.countries.length > 1 || Boolean(trip.country)}
          hasLodging={
            // Asked by glyph, not by raw kind. A flight stores as "flight" and
            // a hotel as "hotel", so comparing strings here is how both of
            // these quietly answered no for every imported trip.
            board.items.some((item) => timelineGlyph(item) === "lodging")
          }
          hasFlights={board.items.some((item) => timelineGlyph(item) === "transport")}
          tripStart={trip.start_date}
          openSignal={prepSignal}
        />

        {trip.budget_enabled && <TripBudget tripId={trip.id} />}

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

              {/* The strip only appears in day view: the flat list is one
                  run of rows on purpose, and filtering it to a day would
                  leave a list with nothing to be flat about. */}
              {board.items.length > 0 && timelineByDay && offerDays && (
                <DaySelector
                  chips={dayChips(timelineGroups, todayKey)}
                  value={chosenDay}
                  onChange={setDayChoice}
                />
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
                      <div
                        key={group.key || "undated"}
                        className="rounded-xl border border-border/60"
                      >
                        <div className="flex items-center gap-1 pr-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedDays((prev) => ({
                                ...prev,
                                [group.key]: !prev[group.key],
                              }))
                            }
                            aria-expanded={dayOpen}
                            className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-left"
                          >
                            <span className="min-w-0">
                              <span className="block font-display text-[20px] leading-tight">
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
                        {dayOpen && (
                          <ol className="relative mx-3 mb-3 min-w-0 space-y-3 overflow-x-hidden py-2">
                            {group.items.map((item, dayIndex) => (
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
                                  leg={legFor(itemIndexById.get(item.id) ?? -1)}
                                  editing={editingTimeline}
                                  {...(directionArea ? { near: directionArea } : {})}
                                  onEdit={(field) => board.setEditing(field)}
                                  onUpdate={(patch) => void board.updateItem(item.id, patch)}
                                  onRemove={() => void removeTimelineItem(item)}
                                  onMove={(direction) => void board.moveItem(item.id, direction)}
                                  canMoveUp={canMove(board.items, item.id, -1)}
                                  canMoveDown={canMove(board.items, item.id, 1)}
                                  tripStart={trip.start_date}
                                  tripEnd={trip.end_date}
                                  onKeep={keepItemAsReco}
                                />
                              </Fragment>
                            ))}
                            {divider === group.items.length && <NowLine done />}
                          </ol>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ol className="relative min-w-0 space-y-3 overflow-x-hidden">
                  {board.items.map((item, i) => (
                    <TimelineEntry
                      key={item.id}
                      item={item}
                      showDay
                      leg={legFor(i)}
                      editing={editingTimeline}
                      {...(directionArea ? { near: directionArea } : {})}
                      onEdit={(field) => board.setEditing(field)}
                      onUpdate={(patch) => void board.updateItem(item.id, patch)}
                      onRemove={() => void removeTimelineItem(item)}
                      onMove={(direction) => void board.moveItem(item.id, direction)}
                      canMoveUp={canMove(board.items, item.id, -1)}
                      canMoveDown={canMove(board.items, item.id, 1)}
                      tripStart={trip.start_date}
                      tripEnd={trip.end_date}
                      onKeep={keepItemAsReco}
                    />
                  ))}
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
                }}
                title="Add to the timeline"
              >
                <TimelineEntryForm
                  tripStart={trip.start_date}
                  tripEnd={trip.end_date}
                  {...(addDay ? { openDay: addDay } : {})}
                  {...(directionArea ? { near: directionArea } : {})}
                  existing={board.items.map((item) => ({
                    title: item.title,
                    address: item.address,
                    lat: item.lat,
                    lon: item.lon,
                  }))}
                  onAdd={board.addItem}
                  onUpdateEntry={(id, patch) => board.updateItem(id, patch)}
                  onDone={() => {
                    setAddingTimeline(false);
                    setAddDay("");
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
            onKeepOffline={dir.keep}
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

        {/* The same stop list the directions are built from, so the map and
            the route can never describe different journeys. */}
        <TripMap stops={routeStops} {...(directionArea ? { area: directionArea } : {})} />
      </div>

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
        onApplySchedule={board.applySchedule}
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
              <p className="text-[12px] text-muted-foreground">
                Codes expire in 7 days and work once. Creating a new code revokes the previous open
                one.
              </p>
              <button
                onClick={async () => {
                  const code = await onInvite();
                  setInviteCode(code);
                  await board.reload();
                }}
                className="mt-2 w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground"
              >
                Create an invite code
              </button>
              {(() => {
                const active = inviteCode
                  ? { code: inviteCode, expires_at: null as string | null }
                  : board.invites.find(
                      (inv) =>
                        !inv.revoked_at &&
                        inv.use_count < inv.max_uses &&
                        (!inv.expires_at || Date.parse(inv.expires_at) > Date.now()),
                    );
                if (!active) return null;
                return (
                  <div className="mt-2 space-y-2 text-center">
                    <p className="text-[14.5px] text-muted-foreground">
                      Share this code:{" "}
                      <span className="font-semibold tracking-widest text-foreground">
                        {active.code}
                      </span>
                    </p>
                    {active.expires_at && (
                      <p className="text-[12px] text-muted-foreground">
                        Expires {new Date(active.expires_at).toLocaleDateString()}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await onRevokeInvite(active.code);
                        setInviteCode("");
                        await board.reload();
                      }}
                      className="text-[13px] font-semibold text-destructive underline"
                    >
                      Revoke this code
                    </button>
                  </div>
                );
              })()}

              {members.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-[12px] font-semibold text-muted-foreground">
                    People on this trip
                  </p>
                  <ul className="mt-2 space-y-2">
                    {members.map((m) => {
                      const isMe = m.user_id === me.id;
                      const isOwner = m.user_id === trip.owner_id;
                      const iAmOwner = me.id === trip.owner_id;
                      const label =
                        m.display_name?.trim() || (isMe ? "You" : isOwner ? "Owner" : "Traveler");
                      return (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 text-[14.5px]"
                        >
                          <span>
                            {label}
                            {isOwner ? " · owner" : ""}
                            {isMe && !isOwner ? " · you" : ""}
                          </span>
                          {iAmOwner && !isMe && (
                            <button
                              type="button"
                              onClick={() => setConfirmRemove({ id: m.user_id, label })}
                              className="text-[13px] font-semibold text-destructive underline"
                            >
                              Remove
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {me.id && me.id !== trip.owner_id && (
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(true)}
                      className="mt-3 w-full rounded-xl border border-destructive/40 px-4 py-2 text-[14.5px] font-semibold text-destructive"
                    >
                      Leave trip
                    </button>
                  )}
                  {me.id === trip.owner_id &&
                    members.some((m) => m.user_id !== me.id) === false && (
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        You&apos;re the only person here. Delete the trip from settings if you want
                        it gone.
                      </p>
                    )}
                </div>
              )}
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
                  <button
                    onClick={dir.clear}
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
              <label className="flex items-center gap-2 px-1 text-[14.5px]">
                <input
                  type="checkbox"
                  checked={trip.budget_enabled}
                  onChange={(e) => void onUpdate({ budget_enabled: e.target.checked })}
                  className="size-5"
                />
                Track a budget for this trip
              </label>
            </div>
          )}

          <button
            onClick={() => {
              const next = sheetSection === "edit" ? null : "edit";
              setSheetSection(next);
              if (next === "edit") {
                setTripForm({
                  title: trip.title,
                  city: formatTripLocation(trip.city, trip.country),
                  country: trip.country ?? "",
                  start_date: trip.start_date ?? "",
                  end_date: trip.end_date ?? "",
                  dates_status: trip.dates_status,
                  status: trip.status,
                });
              }
            }}
            className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold hover:bg-elevated"
          >
            Trip Options
          </button>
          {sheetSection === "edit" && (
            <div className="space-y-2 rounded-xl bg-elevated p-3">
              <input
                value={tripForm.title}
                onChange={(e) => setTripForm({ ...tripForm, title: e.target.value })}
                placeholder="Trip name"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
              />
              <PlaceSearchInput
                value={tripForm.city}
                onChange={(v) => setTripForm({ ...tripForm, city: v })}
                onPick={(p) => {
                  const loc = locationFromParsedPlace(p);
                  setTripForm({
                    ...tripForm,
                    city: loc.city,
                    country: loc.country || tripForm.country,
                  });
                }}
                placeholder="Starting city — search it"
              />
              <DateRangeField
                start={tripForm.start_date}
                end={tripForm.end_date}
                onChange={(start_date, end_date) =>
                  setTripForm({ ...tripForm, start_date, end_date })
                }
                datesStatus={tripForm.dates_status}
                onDatesStatusChange={(dates_status) => setTripForm({ ...tripForm, dates_status })}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-[14.5px]"
              />
              {tripForm.start_date &&
                tripForm.end_date &&
                tripForm.end_date < tripForm.start_date && (
                  <p className="px-1 text-[13px] font-medium text-destructive">
                    End date can't be earlier than the start date.
                  </p>
                )}
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["upcoming", "Upcoming"],
                  ["active", "In progress"],
                  ["past", "Past"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTripForm({ ...tripForm, status: v as string })}
                    className={`rounded-full border px-3 py-1.5 text-[13px] ${
                      tripForm.status === v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                disabled={
                  !tripForm.title.trim() ||
                  !!(
                    tripForm.start_date &&
                    tripForm.end_date &&
                    tripForm.end_date < tripForm.start_date
                  )
                }
                onClick={async () => {
                  await onUpdate({
                    title: tripForm.title.trim(),
                    city: tripForm.city,
                    country: tripForm.country,
                    start_date: tripForm.start_date,
                    end_date: tripForm.end_date,
                    dates_status: tripForm.dates_status,
                    status: tripForm.status,
                  } as Partial<TripRow>);
                }}
                className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                Save changes
              </button>
            </div>
          )}

          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-destructive hover:bg-elevated"
          >
            Delete trip
          </button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this trip?"
        body="This permanently removes the trip, its timeline, stops, budget and invites. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          setSettingsOpen(false);
          void onDelete();
        }}
      />

      <ConfirmSheet
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave this trip?"
        body="You will lose access to the itinerary, the stops and the budget. Someone still on the trip would have to invite you back."
        confirmLabel="Leave"
        onConfirm={() => {
          setConfirmLeave(false);
          void onLeave().then(
            () => setSettingsOpen(false),
            (e: unknown) =>
              toast.error(e instanceof Error ? e.message : "Couldn't leave that trip."),
          );
        }}
      />

      <ConfirmSheet
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.label ?? "this person"}?`}
        body="They lose access to this trip immediately, including the itinerary and anything they added to it."
        confirmLabel="Remove"
        onConfirm={() => {
          const target = confirmRemove;
          setConfirmRemove(null);
          if (!target) return;
          void onRemoveMember(target.id).catch((e: unknown) =>
            toast.error(e instanceof Error ? e.message : "Couldn't remove them."),
          );
        }}
      />
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

/**
 * One editable timeline row. Shared by the flat list and the by-day groups so
 * direction legs stay keyed to the same item id either way.
 */
function TimelineEntry({
  item,
  showDay,
  leg,
  editing = false,
  near,
  onEdit,
  onUpdate,
  onRemove,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  tripStart,
  tripEnd,
  onKeep,
}: {
  item: ItineraryRow;
  showDay: boolean;
  leg?: RouteLeg | undefined;
  /** Edit mode for the whole itinerary, held by the page and toggled in its header. */
  editing?: boolean;
  /** Where the trip is, so a place search is answered locally. */
  near?: string | undefined;
  onEdit: (field: string | null) => void;
  onUpdate: (
    patch: Partial<
      Pick<
        ItineraryRow,
        "title" | "detail" | "time_label" | "kind" | "day_date" | "address" | "lat" | "lon"
      >
    >,
  ) => void;
  onRemove: () => void;
  /** Swap with the entry above or below, within the same day. */
  onMove?: ((direction: -1 | 1) => void) | undefined;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  tripStart?: string | null | undefined;
  tripEnd?: string | null | undefined;
  /** Save this stop to the vault, so a good find outlives the trip. */
  onKeep?: ((item: ItineraryRow) => Promise<void>) | undefined;
}) {
  const [kept, setKept] = useState(false);
  const rail = timeForRail(item.time_label);

  return (
    <li className="relative flex min-w-0 gap-3">
      {/* Time reads down the page as a column, so a day can be scanned rather
          than read. The kind moves into the glyph beside it. */}
      <p className="w-[52px] shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums text-foreground">
        {rail}
      </p>
      <TimelineGlyphMark item={item} />
      <div className="min-w-0 flex-1">
        {showDay && item.day_date ? (
          <p className="text-[12px] text-muted-foreground">{item.day_date}</p>
        ) : null}
        <input
          defaultValue={item.title}
          onFocus={() => onEdit(item.title)}
          onBlur={(e) => {
            onEdit(null);
            if (e.target.value.trim() && e.target.value !== item.title)
              onUpdate({ title: e.target.value.trim() });
          }}
          className="w-full min-w-0 truncate bg-transparent text-[15px] font-medium outline-none"
        />
        <TimelineDetailInput
          detail={item.detail}
          onFocus={() => onEdit(item.title)}
          onCommit={(next) => {
            onEdit(null);
            const prev = stripEmbeddedMapsUrl(item.detail);
            if (next !== prev) onUpdate({ detail: next || null });
          }}
        />
        {item.address && (
          <p className="break-words text-[12px] text-muted-foreground">
            📍 {item.address}
            {item.lat != null && item.lon != null && (
              <a
                href={mapsPlaceUrl(item.title, item)}
                target="_blank"
                rel="noreferrer"
                className="ml-2 font-semibold text-primary underline"
              >
                Map
              </a>
            )}
          </p>
        )}
        <StopDirections leg={leg} />

        {/**
         * Changing an entry after it is saved.
         *
         * A plan moves: dinner slides to the next night, the museum swaps with
         * lunch. Until now a saved entry could only have its title and detail
         * edited — the day was printed as plain text and the order was
         * whatever it was added in. The day and time write through the same
         * updateItem the form uses; the arrows swap position with the
         * neighbour on the same day, and hide at the ends of one, because
         * rows sort by day first and a cross-day swap would move nothing you
         * can see.
         *
         * These open for the whole list at once, from the pencil in the
         * section header, rather than per row: reordering a day means
         * comparing rows, and a mode you turn on once beats opening and
         * closing each entry in turn.
         */}
        {editing && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-elevated p-2">
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              Day
              <input
                type="date"
                value={item.day_date ?? ""}
                aria-label={`Day for ${item.title}`}
                {...(tripStart ? { min: tripStart } : {})}
                {...(tripEnd ? { max: tripEnd } : {})}
                onChange={(e) => onUpdate({ day_date: e.target.value || null })}
                className="rounded-lg border border-border bg-card px-2 py-1 text-[12.5px] text-foreground"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              Time
              <input
                type="time"
                value={rail}
                aria-label={`Time for ${item.title}`}
                onChange={(e) => onUpdate({ time_label: e.target.value || null })}
                className="rounded-lg border border-border bg-card px-2 py-1 text-[12.5px] text-foreground"
              />
            </label>
            {onMove && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!canMoveUp}
                  onClick={() => onMove(-1)}
                  aria-label={`Move ${item.title} earlier`}
                  className="tap-44 grid size-7 place-items-center rounded-lg border border-border disabled:opacity-30"
                >
                  <ChevronUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown}
                  onClick={() => onMove(1)}
                  aria-label={`Move ${item.title} later`}
                  className="tap-44 grid size-7 place-items-center rounded-lg border border-border disabled:opacity-30"
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
              </div>
            )}
            <TimelinePlaceEditor
              item={item}
              {...(near ? { near } : {})}
              onPick={(place) => onUpdate(placePatchForSavedRow(place))}
            />
          </div>
        )}

        <div className="mt-0.5 flex items-center gap-3">
          {editing && (
            <button
              type="button"
              onClick={onRemove}
              className="text-[12px] text-muted-foreground underline"
            >
              Remove
            </button>
          )}
          {onKeep && item.kind !== "note" && (
            <button
              type="button"
              disabled={kept}
              onClick={() => {
                void onKeep(item).then(
                  () => setKept(true),
                  (e: unknown) =>
                    toast.error(
                      e instanceof Error ? e.message : "Couldn't save that to your places.",
                    ),
                );
              }}
              className="text-[12px] text-muted-foreground underline disabled:no-underline disabled:opacity-60"
            >
              {kept ? "Saved to your places" : "Save to my places"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Move a saved entry to a different place.
 *
 * "Order" and "where" are the two things that change about a plan after it is
 * written down, and only order had a control. The search is the same one the
 * add form uses, so a pick brings the address and the point with it — which is
 * also what puts the entry on the trip's map.
 */
function TimelinePlaceEditor({
  item,
  near,
  onPick,
}: {
  item: ItineraryRow;
  near?: string | undefined;
  onPick: (place: ParsedPlace) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setQuery(item.title);
          setOpen(true);
        }}
        className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[12px] text-muted-foreground"
      >
        <MapPinPlus className="size-3.5" aria-hidden />
        {item.address ? "Change place" : "Set place"}
      </button>
    );

  return (
    <div className="w-full space-y-1.5">
      <PlaceSearchInput
        value={query}
        onChange={setQuery}
        onPick={(place) => {
          onPick(place);
          setOpen(false);
        }}
        placeholder={`Where is ${item.title}?`}
        {...(near ? { near } : {})}
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[12px] text-muted-foreground underline"
      >
        Cancel
      </button>
    </div>
  );
}

/** Keeps the detail draft while focused so a realtime row refresh cannot wipe it. */
function TimelineDetailInput({
  detail,
  onFocus,
  onCommit,
}: {
  detail: string | null;
  onFocus: () => void;
  onCommit: (next: string) => void;
}) {
  const remote = stripEmbeddedMapsUrl(detail);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(remote);

  useEffect(() => {
    setDraft((current) => syncDetailDraft(focused, current, detail));
  }, [detail, focused]);

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder="Add a detail"
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => {
        setFocused(false);
        const next = stripEmbeddedMapsUrl(draft);
        setDraft(next);
        onCommit(next);
      }}
      className="w-full min-w-0 truncate bg-transparent text-[13px] text-muted-foreground outline-none"
    />
  );
}

/**
 * Saved walking/driving directions for the leg that starts at this stop.
 * Collapsed to a single quiet line so the timeline stays readable — the steps
 * are only worth screen space at the moment someone is about to walk them.
 */
function StopDirections({ leg }: { leg?: RouteLeg | undefined }) {
  const [open, setOpen] = useState(false);
  if (!leg) return null;

  const measured = leg.distance > 0;
  const summary = measured
    ? `${leg.mode === "walking" ? "Walk" : "Drive"} to ${leg.to} · ${prettyDistance(leg.distance)} · ${prettyDuration(leg.duration)}`
    : `Directions to ${leg.to}`;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="min-w-0 text-left text-[12px] font-medium text-primary underline underline-offset-2 [overflow-wrap:anywhere]"
      >
        {open ? "Hide directions" : summary}
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-border bg-elevated p-2">
          {leg.steps.length > 0 ? (
            <ol className="space-y-1">
              {leg.steps.map((step, s) => (
                <li key={s} className="text-[12px] text-muted-foreground">
                  {step.instruction}
                  {step.distance > 0 && ` · ${prettyDistance(step.distance)}`}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[12px] text-muted-foreground">{unroutedLegCopy(leg)}.</p>
          )}
          <a
            href={leg.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block text-[12px] font-semibold text-primary underline"
          >
            Open in maps
          </a>
        </div>
      )}
    </div>
  );
}
