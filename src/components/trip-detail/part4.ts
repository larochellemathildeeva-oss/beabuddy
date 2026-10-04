import { timelineGlyph } from "@/lib/timeline-kind";
import { type ItineraryRow } from "@/hooks/useTrips";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { countBookings, tripBookings } from "@/lib/trip-overview";
import { dayChips } from "@/lib/trip-days";
import { toLocalISODate } from "@/lib/trip-dates";
import { beaTripNote } from "@/lib/trip-note";
import { strayStopIds } from "@/lib/geocode-plan";
import { midpointTime } from "@/lib/companion";
import { tripCheckup } from "@/lib/trip-checkup";
import { useIdDocuments } from "@/hooks/useIdDocuments";
import { routeCityOn } from "@/lib/import-stop";
import type { TripDetailCtx } from "./ctx";

export function useTripDetailPart4(td: TripDetailCtx) {
  td.tripWide = {
    international: td.cities.countries.length > 1 || Boolean(td.trip.country),
    // Asked by glyph, not by raw kind. A flight stores as "flight" and a
    // hotel as "hotel", so comparing strings here is how both of these
    // quietly answered no for every imported trip.
    hasLodging: td.board.items.some((item) => timelineGlyph(item) === "lodging"),
    hasFlights: td.board.items.some((item) => timelineGlyph(item) === "transport"),
  };
  td.tripCountries = [td.trip.country, ...td.cities.countries];
  td.cityDayKeys = new Set(td.timelineGroups.map((group) => group.key));
  td.chips = td.chosenCity
    ? dayChips(td.allDayGroups, td.todayKey).filter((chip) => td.cityDayKeys.has(chip.key))
    : dayChips(td.allDayGroups, td.todayKey);
  td.ordinalFor = (key: string) => td.chips.find((chip) => chip.key === key)?.ordinal ?? "";
  td.datedDayCount = td.chips.filter((chip) => chip.key).length;
  td.companionOrdinal = td.companionDay ? td.ordinalFor(td.companionDay.key) : "";
  td.companionPlace =
    (td.companionDay?.key ? routeCityOn(td.cities.stops, td.companionDay.key) : "")
      ?.split(",")[0]
      ?.trim() ||
    td.trip.city?.split(",")[0]?.trim() ||
    td.trip.title;
  td.companionDateLine = td.companionDay?.key
    ? new Date(`${td.companionDay.key}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";
  td.cityNames = td.cities.stops.map((stop) => stop.city);
  td.tripArt = bannerArtUrl(
    bannerSceneFor(
      [td.trip.title, ...td.cityNames, td.trip.city, td.trip.country],
      td.trip.title || td.trip.city || "",
    ),
  );
  td.companionArt = bannerArtUrl(
    bannerSceneFor(
      [td.companionPlace, td.trip.title, ...td.cityNames, td.trip.city, td.trip.country],
      td.companionPlace || td.trip.title || "",
    ),
  );
  td.bookingCounts = countBookings(tripBookings(td.stopItems, td.bookingDocs.docs));
  td.openAddBetween = (item: ItineraryRow, next: ItineraryRow) => {
    td.insertAnchor.current = null;
    td.setAddBetween({ afterId: item.id, time: midpointTime(item.time_label, next.time_label) });
    td.setAddDay(item.day_date ?? "");
    td.setAddingTimeline(true);
  };
  td.tripNote = beaTripNote(
    {
      startDate: td.trip.start_date,
      endDate: td.trip.end_date,
      stopCount: td.cities.stops.length,
      plannedCount: td.stopItems.length,
    },
    toLocalISODate(new Date()),
  );
  td.idDocuments = useIdDocuments(td.settingsOpen);
  td.checkup =
    td.settingsOpen && td.stopItems.length > 0
      ? tripCheckup({
          start_date: td.trip.start_date,
          end_date: td.trip.end_date,
          items: td.stopItems,
          // Judged from real pins only: a failed geocode at 0,0 would skew
          // the middle of the trip and hide a genuinely distant stop.
          strayIds: strayStopIds(td.stopItems.filter((i) => !(i.lat === 0 && i.lon === 0))),
          idDocuments: td.idDocuments,
          travelMinutes: (from, to) => {
            const a = td.itemsById.get(from.id);
            const b = td.itemsById.get(to.id);
            const leg = a && b ? td.travelInto(a, b, true) : undefined;
            if (!leg || leg.unknownSpot || leg.capped || !(leg.duration > 0)) return null;
            return Math.round(leg.duration / 60);
          },
        })
      : null;
}
