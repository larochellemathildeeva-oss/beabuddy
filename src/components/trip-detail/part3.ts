/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "@/components/icons";
import { type DayEditSave } from "@/components/day/DayEditSheet";
import { type ItineraryRow } from "@/hooks/useTrips";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { nowTarget } from "@/lib/now-jump";
import { type BookingFilter } from "@/components/day/TripBookings";
import { isNetworkFailure } from "@/lib/ai-errors";
import {
  ALL_DAYS,
  defaultDayChoice,
  shouldOfferDays,
  visibleGroups,
  type DayChoice,
} from "@/lib/trip-days";
import { rearrange, stepMove, timeFit, type StopMove } from "@/lib/stop-move";
import { changeSetForMoves } from "@/lib/itinerary-review";
import type { ScheduleUpdate } from "@/lib/itinerary-schedule-write";
import { pinsToCheck } from "@/lib/pin-check";
import { toast } from "sonner";
import { clockMinutes, companionStops, isDone, toggleDoneWrite } from "@/lib/companion";
import { useTripViewPrefs } from "@/hooks/useTripViewPrefs";
import {
  asPerspective,
  defaultPerspective,
  TRIP_PERSPECTIVES,
  tripIsUnderway,
  type TripPerspective,
} from "@/lib/trip-perspective";
import type { TripDetailCtx } from "./ctx";

export function useTripDetailPart3(td: TripDetailCtx) {
  td.moveStops = async (moves: StopMove[], summary?: string) => {
    // The traveller's own moves are checked first; Béa's (with a summary)
    // were planned as a whole and saved as they are.
    let updates: ScheduleUpdate[];
    if (summary) {
      updates = rearrange(td.stopItems, moves);
    } else {
      const proposal = changeSetForMoves(td.stopItems, moves);
      if (!proposal) return;
      const now = td.scheduleReview.review("stops", proposal);
      if (!now) return;
      updates = now.updates;
    }
    if (updates.length === 0) return;
    const previous = updates.flatMap((u) => {
      const row = td.board.items.find((item) => item.id === u.id);
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
    const fit = single ? timeFit(td.stopItems, single, clockMinutes) : null;
    const stop = single ? td.stopItems.find((item) => item.id === single.id) : undefined;
    const crossedDay = single && stop && (stop.day_date ?? "") !== (single.day_date ?? "");
    const undo = () =>
      void td.board.applySchedule(previous).then(
        () => toast.success("Back where it was"),
        () => toast.error("Couldn't undo that. Check your connection."),
      );
    try {
      await td.board.applySchedule(updates);
    } catch (e) {
      // Rows are written one by one, so some may have saved before the
      // failure. The list has reloaded to show them; offer to put it back.
      td.setLiveLegs(null);
      toast.error("Couldn't save all of that move.", {
        description: isNetworkFailure(e)
          ? "Check your connection. Some stops may already have moved."
          : "Some stops may already have moved.",
        duration: 10000,
        action: { label: "Put back", onClick: undo },
      });
      throw e;
    }
    // Journeys worked out just now were for the old neighbours.
    td.setLiveLegs(null);
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
            void td.board
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
        `${stop?.title ?? "Stop"} moved to ${single?.day_date ? formatTimelineDayLabel(single.day_date) : "No date"}`,
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
  td.applyDayEdit = async ({ updates, added, summary }: DayEditSave) => {
    const previous = updates.flatMap((u) => {
      const row = td.board.items.find((item) => item.id === u.id);
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
    let addedIds: string[] = [];
    try {
      await td.board.applySchedule(updates);
      addedIds = (await td.board.addItems(added)) ?? [];
    } finally {
      // Journeys worked out just now were for the old neighbours.
      td.setLiveLegs(null);
    }
    const undo = async () => {
      await td.board.removeItems(addedIds);
      await td.board.applySchedule(previous);
    };
    const parts = [
      updates.length ? `${updates.length} ${updates.length === 1 ? "change" : "changes"}` : "",
      added.length ? `${added.length} new ${added.length === 1 ? "place" : "places"}` : "",
    ].filter(Boolean);
    toast(summary.length > 90 ? "Day updated" : summary, {
      description: `${parts.join(" · ")} saved.`,
      duration: 10000,
      action: {
        label: "Undo",
        onClick: () =>
          void undo().then(
            () => toast.success("Back to the day as it was"),
            () => toast.error("Couldn't undo all of that. Check your connection."),
          ),
      },
    });
  };
  td.moveProps = (item: ItineraryRow) => {
    const up = stepMove(td.stopItems, item.id, -1, td.moveDays);
    const down = stepMove(td.stopItems, item.id, 1, td.moveDays);
    return {
      onMove: (direction: -1 | 1) => {
        const move = direction < 0 ? up : down;
        if (move)
          // moveStops says what went wrong itself.
          void td.moveStops([move]).catch(() => undefined);
      },
      canMoveUp: up !== null,
      canMoveDown: down !== null,
      onMoveTo: () => td.setMovingId(item.id),
    };
  };
  const _td36 = useState<DayChoice | null>(null);
  td.dayChoice = _td36[0];
  td.setDayChoice = _td36[1];
  td.chosenDay = td.dayChoice ?? defaultDayChoice(td.timelineGroups, td.todayKey);
  td.shownGroups = visibleGroups(td.timelineGroups, td.chosenDay);
  td.todayGroup = td.timelineGroups.find((group) => group.key === td.todayKey);
  td.nowStop = td.todayGroup ? nowTarget(td.todayGroup.items, td.minutesNow) : null;
  td.jumpToNow = () => {
    const nowStop = td.nowStop;
    if (!nowStop) return;
    if (td.timelineByDay && td.chosenDay !== ALL_DAYS && td.chosenDay !== td.todayKey)
      td.setDayChoice(td.todayKey);
    td.setCollapsedDays((prev) => ({ ...prev, [td.todayKey]: false }));
    // After the day has rendered: two frames, one for the state, one for layout.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .getElementById(`stop-${nowStop.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      ),
    );
  };
  td.jumpToStop = (stopId: string) => {
    const stop = td.stopItems.find((item) => item.id === stopId);
    if (!stop) return;
    td.setPerspective("timeline");
    // Filters that could leave the stop off the page: another city picked,
    // or visited stops hidden.
    if (td.cityChoice) td.setCityChoice("");
    td.setHideDone(false);
    const day = stop.day_date ?? "";
    if (td.timelineByDay && td.chosenDay !== ALL_DAYS && td.chosenDay !== day) td.setDayChoice(day);
    td.setCollapsedDays((prev) => ({ ...prev, [day]: false }));
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .getElementById(`stop-${stopId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      ),
    );
  };
  td.dayCardsRef = useRef<HTMLDivElement>(null);
  td.offerDays = shouldOfferDays(td.timelineGroups);
  const _td37 = useState<TripPerspective>(() =>
    defaultPerspective(tripIsUnderway(td.trip, td.todayKey)),
  );
  td.perspective = _td37[0];
  td.setPerspective = _td37[1];
  td.activePerspective = TRIP_PERSPECTIVES.find((p) => p.id === td.perspective)!;
  td.viewKey = `bea-trip-page-${td.trip.id}`;
  const _td38 = useState(false);
  td.hideDone = _td38[0];
  td.setHideDone = _td38[1];
  const _td39 = useState(false);
  td.byArea = _td39[0];
  td.setByArea = _td39[1];
  const _td40 = useState(false);
  td.compactCards = _td40[0];
  td.setCompactCards = _td40[1];
  const _td41 = useState<string | null>(null);
  td.draggingDay = _td41[0];
  td.setDraggingDay = _td41[1];
  td.doneCount = td.stopItems.filter(isDone).length;
  td.hidingDone = td.hideDone && !td.editingTimeline;
  td.restored = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(td.viewKey) ?? "null") as {
        perspective?: unknown;
        day?: unknown;
        hideDone?: unknown;
        byArea?: unknown;
        compact?: unknown;
      } | null;
      const p = asPerspective(saved?.perspective);
      if (p) td.setPerspective(p);
      if (saved?.perspective === "bookings") td.setBookingsOpen(true);
      if (typeof saved?.day === "string") td.setDayChoice(saved.day);
      if (saved?.hideDone === true) td.setHideDone(true);
      if (saved?.byArea === true) td.setByArea(true);
      if (saved?.compact === true) td.setCompactCards(true);
    } catch {
      /* storage unavailable: start from the defaults */
    }
    td.restored.current = true;
  }, [td.viewKey]);
  useEffect(() => {
    if (!td.restored.current) return;
    try {
      window.localStorage.setItem(
        td.viewKey,
        JSON.stringify({
          perspective: td.perspective,
          day: td.dayChoice,
          hideDone: td.hideDone,
          byArea: td.byArea,
          compact: td.compactCards,
        }),
      );
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  }, [td.viewKey, td.perspective, td.dayChoice, td.hideDone, td.byArea, td.compactCards]);
  td.view = useTripViewPrefs();
  td.toCheck = useMemo(() => pinsToCheck(td.stopItems), [td.stopItems]);
  const _td42 = useState(false);
  td.pinReviewOpen = _td42[0];
  td.setPinReviewOpen = _td42[1];
  td.docsByStop = new Map<string, string[]>();
  for (const doc of td.bookingDocs.docs) {
    if (!doc.itinerary_item_id) continue;
    td.docsByStop.set(doc.itinerary_item_id, [
      ...(td.docsByStop.get(doc.itinerary_item_id) ?? []),
      doc.id,
    ]);
  }
  td.docProps = (item: ItineraryRow) => ({
    ...td.linkedDocProps(item),
    photos: {
      title: item.title,
      photos: td.stopPhotos.byStop.get(item.id) ?? [],
      available: td.stopPhotos.available,
      uid: td.me.id,
      onAdd: (files: File[]) => td.stopPhotos.add(item, files),
      onRemove: td.stopPhotos.remove,
    },
  });
  td.linkedDocProps = (item: ItineraryRow) => {
    const ids = td.docsByStop.get(item.id);
    if (!ids?.length) return {};
    return {
      linkedDocuments: ids.length,
      // One opens straight onto its detail; several open the library on
      // this stop's documents.
      onOpenDocuments: () =>
        void td.navigate({
          to: "/profile/documents",
          search: ids.length === 1 ? { doc: ids[0]! } : { event: item.id },
        }),
    };
  };
  td.openBookings = (kind: BookingFilter) => {
    td.setBookingFilter(kind);
    td.setPerspective("overview");
    td.setBookingsOpen(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        td.bookingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      ),
    );
  };
  // Arriving with a request in the link (Plan with Béa, a booking link):
  // after the saved tab is restored, so the request wins over it.
  useEffect(() => {
    if (td.openView === "bookings") td.openBookings("all");
    if (td.openPlan) {
      td.setPlannerTab(td.openPlan.tab);
      td.setPlannerAsk(td.openPlan.ask ?? "");
      td.setPlannerOpen(true);
    }
  }, []);
  const _td43 = useState(false);
  td.savedOpen = _td43[0];
  td.setSavedOpen = _td43[1];
  const _td44 = useState(false);
  td.addOpen = _td44[0];
  td.setAddOpen = _td44[1];
  const _td45 = useState(0);
  td.citySignal = _td45[0];
  td.setCitySignal = _td45[1];
  td.addToDay = td.chosenDay !== ALL_DAYS && td.chosenDay !== "" ? td.chosenDay : null;
  td.addToDayLabel = td.addToDay
    ? (td.timelineGroups.find((group) => group.key === td.addToDay)?.label ?? null)
    : null;
  const _td46 = useState<string | null>(null);
  td.peekId = _td46[0];
  td.setPeekId = _td46[1];
  const _td47 = useState<string | null>(null);
  td.mapFocus = _td47[0];
  td.setMapFocus = _td47[1];
  td.locate = (item: ItineraryRow) => {
    if (item.day_date) td.setDayChoice(item.day_date);
    td.setMapFocus(item.id);
    td.setPerspective("map");
  };
  const _td48 = useState<{
    afterId: string;
    time: string;
  } | null>(null);
  td.addBetween = _td48[0];
  td.setAddBetween = _td48[1];
  td.insertAnchor = useRef<string | null>(null);
  td.toggleDone = (item: ItineraryRow) => {
    const write = toggleDoneWrite(item, new Date());
    const wasDone = isDone(item);
    void td.board.setProgress([{ id: write.id, patch: write.patch }]).then(
      () =>
        toast(
          wasDone
            ? `${item.title}: not done`
            : td.hideDone
              ? `${item.title}: done, and off the Not visited list`
              : `${item.title}: done`,
          {
            action: {
              label: "Undo",
              onClick: () => void td.board.setProgress([{ id: write.id, patch: write.undo }]),
            },
          },
        ),
      (e: unknown) => toast.error(e instanceof Error ? e.message : "That didn't save."),
    );
  };
  td.companionDay =
    td.chosenDay === ALL_DAYS
      ? (td.timelineGroups.find((group) => group.key !== "" && group.key === td.todayKey) ??
        // A one-day trip has no day strip to pick from, so there is only
        // one day to follow. Without this it asked for a choice it hid.
        (td.timelineGroups.length === 1 ? td.timelineGroups[0]! : null))
      : (td.shownGroups[0] ?? null);
  td.nowStops = td.companionDay ? companionStops(td.companionDay.items) : [];
  td.peekStop = td.nowStops.find((stop) => stop.id === td.peekId) ?? null;
  td.tripStopsForNow = companionStops(td.board.items);
  td.nowLegs = td.tripStopsForNow
    .slice(0, -1)
    .map((stop, i) => td.travelInto(stop, td.tripStopsForNow[i + 1]!, true));
}
