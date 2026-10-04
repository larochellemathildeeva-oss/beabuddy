/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { type PrepTab } from "@/components/TripPrep";
import { savedMatchesStops } from "@/lib/offline-directions";
import { type RouteLeg } from "@/lib/directions.functions";
import { type ItineraryRow } from "@/hooks/useTrips";
import { groupsInCity } from "@/lib/trip-cities";
import { usePacking } from "@/hooks/usePacking";
import { isSavedDirectionItem } from "@/lib/direction-stops";
import { groupTimelineByDay } from "@/lib/timeline-groups";
import { type TripMenuSection } from "@/components/day/TripMenuSheet";
import { type BookingFilter } from "@/components/day/TripBookings";
import { useTripBookingDocuments } from "@/hooks/useTripDocuments";
import { useStopPhotos } from "@/hooks/useStopPhotos";
import { useTripPreferences } from "@/hooks/useTripPreferences";
import { saveOfflineTrip } from "@/lib/offline-trip";
import { tripDays } from "@/lib/stop-move";
import { useScheduleReview } from "@/hooks/useScheduleReview";
import { toLocalISODate } from "@/lib/trip-dates";
import { strayStopIds } from "@/lib/geocode-plan";
import { directionDetail, directionKey, savedLegStillFits } from "@/lib/timeline-directions";
import { toast } from "sonner";
import { isTravelLeg, legTarget, routeStopOn, withLegNote } from "@/lib/import-stop";
import type { InsideEntry } from "@/lib/inside-list";
import type { TripDetailCtx } from "./ctx";

export function useTripDetailPart2(td: TripDetailCtx) {
  td.removeTimelineItem = (item: ItineraryRow) =>
    td.removeWithUndo({
      label: item.title,
      remove: () => td.board.removeItem(item.id),
      // Comes back at the end of its day rather than its old position.
      restore: async () => {
        await td.board.addItem({
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
  td.foldProps = (item: ItineraryRow) => {
    if (!isTravelLeg(item)) return {};
    const i = td.board.items.indexOf(item);
    const target = legTarget(td.board.items, i);
    const into = target ? td.board.items[target.index] : undefined;
    if (!target || !into) return {};
    return {
      foldInto: into.title,
      onFold: () => {
        void td.board.updateItem(into.id, { detail: withLegNote(into.detail, item, target.after) });
        void td.removeTimelineItem(item);
      },
    };
  };
  td.savedFitsTimeline = savedMatchesStops(td.dir.saved?.signature, td.directionStops);
  const _td14 = useState<RouteLeg[] | null>(null);
  td.liveLegs = _td14[0];
  td.setLiveLegs = _td14[1];
  td.tripCenter = useMemo(() => {
    const placed = td.board.items.filter(
      (
        item,
      ): item is ItineraryRow & {
        lat: number;
        lon: number;
      } => item.lat != null && item.lon != null,
    );
    if (!placed.length) return null;
    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)]!;
    };
    return { lat: median(placed.map((p) => p.lat)), lon: median(placed.map((p) => p.lon)) };
  }, [td.board.items]);
  td.dayCenters = useMemo(() => {
    const byDay = new Map<
      string,
      {
        lat: number[];
        lon: number[];
      }
    >();
    for (const item of td.board.items) {
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
  }, [td.board.items]);
  td.centerOn = (day: string | null | undefined) => {
    const here = routeStopOn(td.cities.stops, day);
    if (here) return here.lat != null && here.lon != null ? { lat: here.lat, lon: here.lon } : null;
    return (day ? td.dayCenters.get(day) : undefined) ?? td.tripCenter;
  };
  td.itemsById = useMemo(() => new Map(td.board.items.map((i) => [i.id, i])), [td.board.items]);
  td.nestedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of td.board.items) {
      if (i.parent_id && td.itemsById.has(i.parent_id)) {
        counts.set(i.parent_id, (counts.get(i.parent_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [td.board.items, td.itemsById]);
  td.nestProps = (item: ItineraryRow) => {
    const onInside = (next: InsideEntry[]) => void td.board.updateItem(item.id, { inside: next });
    // Flat, by choice: every stop on its own line. What is inside stays a pill.
    if (!td.view.prefs.nesting) return { flat: true, onInside };
    const parent = item.parent_id ? td.itemsById.get(item.parent_id) : undefined;
    return {
      ...(parent && parent.day_date === item.day_date ? { parentTitle: parent.title } : {}),
      nestedStops: td.nestedCounts.get(item.id) ?? 0,
      onInside,
    };
  };
  td.withNear = (day: string | null | undefined) => {
    const near = td.nearOn(day);
    const center = td.centerOn(day);
    return { ...(near ? { near } : {}), ...(center ? { center } : {}) };
  };
  td.strayIds = useMemo(() => strayStopIds(td.stopItems), [td.stopItems]);
  td.directionIndexById = new Map(
    td.directionStops.map((stop, i) => [stop.id ?? `#${i}`, i] as const),
  );
  td.legFor = (fromId: string, toId: string) => {
    const index = td.directionIndexById.get(fromId);
    if (index == null || td.directionStops[index + 1]?.id !== toId) return undefined;
    return td.liveLegs?.[index] ?? (td.savedFitsTimeline ? td.dir.saved?.legs[index] : undefined);
  };
  td.travelInto = (from: ItineraryRow, to: ItineraryRow, strict = false) =>
    savedLegStillFits(td.legFor(from.id, to.id), from, to) ??
    savedLegStillFits(
      td.savedTravel.get(directionKey(to.day_date, to.title, from.title)) ??
        td.savedTravel.get(directionKey(from.day_date, to.title, from.title)) ??
        (strict
          ? undefined
          : (td.savedTravel.get(directionKey(to.day_date, to.title)) ??
            td.savedTravel.get(directionKey(from.day_date, to.title)))),
      from,
      to,
    );
  td.templates = usePacking(null);
  const _td15 = useState(false);
  td.settingsOpen = _td15[0];
  td.setSettingsOpen = _td15[1];
  const _td16 = useState<TripMenuSection | null>(null);
  td.sheetSection = _td16[0];
  td.setSheetSection = _td16[1];
  const _td17 = useState("");
  td.packTemplateId = _td17[0];
  td.setPackTemplateId = _td17[1];
  const _td18 = useState("");
  td.packMsg = _td18[0];
  td.setPackMsg = _td18[1];
  const _td19 = useState(0);
  td.prepSignal = _td19[0];
  td.setPrepSignal = _td19[1];
  const _td20 = useState(false);
  td.currencyOpen = _td20[0];
  td.setCurrencyOpen = _td20[1];
  const _td21 = useState<{
    tab: PrepTab;
    n: number;
  } | null>(() => (td.openPrep ? { tab: td.openPrep, n: 1 } : null));
  td.prepAsk = _td21[0];
  td.setPrepAsk = _td21[1];
  const _td22 = useState(false);
  td.addingTimeline = _td22[0];
  td.setAddingTimeline = _td22[1];
  const _td23 = useState(true);
  td.timelineOpen = _td23[0];
  td.setTimelineOpen = _td23[1];
  const _td24 = useState(true);
  td.timelineByDay = _td24[0];
  td.setTimelineByDay = _td24[1];
  const _td25 = useState<Record<string, boolean>>({});
  td.collapsedDays = _td25[0];
  td.setCollapsedDays = _td25[1];
  const _td26 = useState(false);
  td.editingTimeline = _td26[0];
  td.setEditingTimeline = _td26[1];
  const _td27 = useState(false);
  td.directionsOpen = _td27[0];
  td.setDirectionsOpen = _td27[1];
  const _td28 = useState(false);
  td.directionsBusy = _td28[0];
  td.setDirectionsBusy = _td28[1];
  td.directionsButton =
    td.directionStops.length >= 2 && !td.editingTimeline
      ? { onDirections: () => td.setDirectionsOpen(true), directionsBusy: td.directionsBusy }
      : {};
  td.savedDirectionRows = useMemo(
    () => td.board.items.filter(isSavedDirectionItem),
    [td.board.items],
  );
  td.removeDirectionRows = async () => {
    const rows = td.savedDirectionRows;
    if (rows.length === 0) return;
    await td.board.removeItems(rows.map((row) => row.id));
    td.setLiveLegs(null);
    toast.success(`Removed ${rows.length} ${rows.length === 1 ? "journey" : "journeys"}`, {
      action: {
        label: "Undo",
        onClick: () =>
          void td.board.upsertItems(
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
  const _td29 = useState(false);
  td.timelineMenuOpen = _td29[0];
  td.setTimelineMenuOpen = _td29[1];
  const _td30 = useState(false);
  td.dayEditOpen = _td30[0];
  td.setDayEditOpen = _td30[1];
  const _td31 = useState<{
    day: string;
    ask: string;
  } | null>(null);
  td.dayEditStart = _td31[0];
  td.setDayEditStart = _td31[1];
  const _td32 = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  td.minutesNow = _td32[0];
  td.setMinutesNow = _td32[1];
  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      td.setMinutesNow(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(tick);
  }, []);
  td.todayKey = toLocalISODate(new Date());
  const _td33 = useState("");
  td.addDay = _td33[0];
  td.setAddDay = _td33[1];
  const _td34 = useState<BookingFilter>("all");
  td.bookingFilter = _td34[0];
  td.setBookingFilter = _td34[1];
  td.bookingDocs = useTripBookingDocuments(td.trip.id);
  td.stopPhotos = useStopPhotos(td.trip.id, td.me.id, td.trip);
  td.tripPrefs = useTripPreferences(td.trip.id);
  td.keptOffline = Boolean(td.dir.saved);
  useEffect(() => {
    if (!td.keptOffline || !td.me.id || td.board.items.length === 0) return;
    saveOfflineTrip(localStorage, {
      uid: td.me.id,
      savedAt: new Date().toISOString(),
      trip: td.trip,
      members: td.members,
      items: td.board.items,
    });
  }, [td.keptOffline, td.me.id, td.trip, td.members, td.board.items]);
  td.others = td.board.present.filter((p) => p.userId !== td.me.id);
  td.allDayGroups = groupTimelineByDay(td.stopItems);
  td.timelineGroups = td.chosenCity
    ? groupsInCity(td.allDayGroups, td.routeCities, td.chosenCity)
    : td.allDayGroups;
  td.moveDays = tripDays(td.trip.start_date, td.trip.end_date, td.stopItems);
  const _td35 = useState<string | null>(null);
  td.movingId = _td35[0];
  td.setMovingId = _td35[1];
  td.knownDirections = td.directionStops.slice(1).map((to, i) => {
    const from = td.directionStops[i]!;
    // The phone's copy by name too: a stop added since shifts its legs.
    const live =
      (from.id && to.id ? td.legFor(from.id, to.id) : undefined) ??
      td.dir.saved?.legs.find((leg) => leg.from === from.title && leg.to === to.title);
    const row =
      td.savedTravel.get(directionKey(to.day_date, to.title, from.title)) ??
      td.savedTravel.get(directionKey(from.day_date, to.title, from.title));
    const leg = live ?? row;
    // On the timeline only when the row says what this journey says.
    const onTimeline = Boolean(row && (!live || directionDetail(live) === directionDetail(row)));
    return leg ? { leg, onTimeline } : undefined;
  });
  td.knownLegs = td.directionStops.flatMap((stop, i) => {
    const next = td.directionStops[i + 1];
    if (!stop.id || !next?.id) return [];
    const leg = td.legFor(stop.id, next.id);
    if (!leg || leg.capped || leg.unknownSpot || leg.farApartKm != null) return [];
    return [
      {
        fromId: stop.id,
        toId: next.id,
        seconds: leg.sameSpot ? 0 : leg.duration,
        ...(leg.estimated ? { estimated: true } : {}),
      },
    ];
  });
  td.scheduleReview = useScheduleReview({
    stops: td.stopItems,
    all: td.board.items,
    travelChoice: td.travel,
    travelLegs: td.knownLegs,
    applySchedule: td.board.applySchedule,
    onSaved: () => td.setLiveLegs(null),
    errorText: td.scheduleErrorText,
  });
  td.movingStop = td.movingId
    ? (td.stopItems.find((item) => item.id === td.movingId) ?? null)
    : null;
}
