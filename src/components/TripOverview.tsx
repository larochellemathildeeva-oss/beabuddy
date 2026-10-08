import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { ItineraryRow } from "@/hooks/useTrips";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useTripGlances } from "@/hooks/useTripGlances";
import { companionState, companionStops, isDone, type CompanionState } from "@/lib/companion";
import { currentHighlights } from "@/lib/home-trip";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { timelineGlyph } from "@/lib/timeline-kind";
import { tripIsUnderway } from "@/lib/trip-perspective";
import {
  cityStretches,
  countBookings,
  missingStays,
  placesForTrip,
  stretchDates,
  tripBookings,
  type BookingKind,
} from "@/lib/trip-overview";
import { isDayTrip, shortCity } from "@/lib/trip-cities";
import type { TripDocument } from "@/lib/trip-documents";
import type { TimelineDayGroup } from "@/lib/timeline-groups";
import type { PrepTab } from "@/components/TripPrep";

/** A city on the trip's route, as the recap reads it. */
type RouteCity = {
  city: string;
  country?: string | null;
  kind?: string | null;
  arrive_on?: string | null;
  depart_on?: string | null;
};

/**
 * The trip at a glance, as the minimalist design draws it (Figma
 * "trip-overview", 116:892): joined figures (days, travellers), "Your
 * itinerary" rows a stretch of days each, View itinerary, then "Before you
 * go" rows.
 *
 * Every row opens something that exists — Companion, the Timeline, bookings,
 * to-dos and packing, Saved places, Trip documents, the trip menu.
 */
export function TripOverview({
  tripId,
  items,
  cities,
  country,
  homeCity,
  today,
  startDate,
  endDate,
  onFindCities,
  findingCities = false,
  groups,
  days,
  route,
  bookingDocs,
  onOpenBookings,
  onOpenTimeline,
  onOpenCompanion,
  onOpenSaved,
  onPrep,
  onOpenSettings,
  travellers = [],
}: {
  tripId: string;
  items: ItineraryRow[];
  /** The trip's destinations, in order. */
  cities: { city: string; country: string | null }[];
  /** The trip's own country, for a destination saved without one. */
  country?: string | null;
  /** The trip's starting city, so saved places match before destinations exist. */
  homeCity?: string | null;
  today: string;
  startDate?: string | null;
  endDate?: string | null;
  /** Offered when the trip has stops with pins but no destinations. */
  onFindCities?: (() => void) | undefined;
  findingCities?: boolean | undefined;
  groups: TimelineDayGroup<ItineraryRow>[];
  /** Every day of the trip, in order, empty days too. */
  days: string[];
  /** The cities the trip moves between, day trips included. */
  route: RouteCity[];
  /** Trip documents filed to this trip: they are bookings too. */
  bookingDocs: TripDocument[];
  /** The trip's bookings list, open on one kind. */
  onOpenBookings: (kind: BookingKind | "all") => void;
  onOpenTimeline: (dayKey?: string) => void;
  onOpenCompanion: () => void;
  onOpenSaved: () => void;
  onPrep: (tab: PrepTab) => void;
  /** The trip menu: people, budget, photos and the details. */
  onOpenSettings?: () => void;
  /** Names of everyone on the trip. */
  travellers?: string[];
}) {
  const { glances } = useTripGlances([tripId]);
  const glance = glances[tripId];
  const bookingsAll = tripBookings(items, bookingDocs);
  const bookedByKind = countBookings(bookingsAll);
  const booked = bookingsAll.length;
  const names = [
    ...new Set(cities.map((c) => (c.city.split(",")[0] ?? "").trim()).filter(Boolean)),
  ];
  const countries = new Set(
    cities
      .map((c) => (c.country || c.city.split(",").slice(1).pop() || country || "").trim())
      .filter(Boolean)
      .map((c) => c.toLowerCase()),
  );
  const todos = glance?.todos.open ?? 0;
  const packing = glance?.packing;
  const stretches = cityStretches(days, route, items);
  const undatedCities = route.filter((c) => !stretches.some((s) => s.city === c));
  const undated = items.filter((item) => !item.day_date).length;
  const placeCountry = (c: RouteCity) =>
    (c.country || c.city.split(",").slice(1).pop() || country || "").trim();
  const manyCountries = countries.size > 1;

  const live = tripIsUnderway({ start_date: startDate, end_date: endDate }, today);
  const end = endDate || startDate || "";
  const past = Boolean(end && today > end);
  const ahead = !live && !past;
  const byDay = new Map(groups.map((group) => [group.key, group.items]));
  const todayStops = companionStops(byDay.get(today) ?? []);
  const now = companionState(todayStops);
  const lodgingItems = items.filter((item) => timelineGlyph(item) === "lodging");
  const gaps = missingStays(
    days,
    stretches,
    lodgingItems.flatMap((item) => (item.day_date ? [item.day_date] : [])),
    lodgingItems.length > 0 || bookedByKind.stay > 0,
  );
  const flight = currentHighlights(items, today).flight;
  const savedCities = [homeCity, ...cities.map((c) => c.city)].filter((city): city is string =>
    Boolean(city?.trim()),
  );

  const stayRow = (gap: (typeof gaps)[number]) => ({
    key: `stay-${gap.city ?? "trip"}-${gap.start ?? ""}`,
    title: gap.city ? `No stay in ${shortCity(gap.city)} yet` : "No place to stay yet",
    note: gap.start ? stretchDates(gap.start, gap.end ?? gap.start) : "Add where you sleep",
    onClick: () => onOpenBookings("stay"),
  });
  const flightNote = flight
    ? [
        flight.title,
        flight.time_label && /^\d{1,2}:\d{2}/.test(flight.time_label) ? flight.time_label : "",
        flight.day_date ? formatTimelineDayLabel(flight.day_date) : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const packed = packing?.total
    ? `${Math.round(packing.ratio * 100)}% packed`
    : "No packing list yet";

  // Where the trip is, stretch by stretch (Figma "Your itinerary"): a city
  // and its days. A trip with days but no cities gets a row a day.
  const itinerary: Row[] = stretches.length
    ? stretches.map((stretch) => {
        const place = stretch.city;
        const stretchDays = days.filter((d) => d >= stretch.start && d <= stretch.end);
        const marks = stretchDays.map((day) =>
          dayMark(day, today, live, companionStops(byDay.get(day) ?? [])),
        );
        const mark = marks.includes("Today")
          ? "Today"
          : marks.length && marks.every((m) => m === "Done")
            ? "Done"
            : "";
        return {
          key: `${stretch.start}-${place?.city ?? ""}`,
          title: place ? shortCity(place.city) : homeCity ? shortCity(homeCity) : "No city set",
          note: [
            stretchDates(stretch.start, stretch.end),
            place && isDayTrip(place) ? "Day trip" : "",
            place && manyCountries ? placeCountry(place) : "",
            `${stretch.stops} ${stretch.stops === 1 ? "stop" : "stops"}`,
            mark,
          ]
            .filter(Boolean)
            .join(" / "),
          onClick: () => onOpenTimeline(stretch.start),
        };
      })
    : days.map((day, index) => {
        const count = byDay.get(day)?.length ?? 0;
        return {
          key: day,
          title: `Day ${index + 1}`,
          note: [
            formatTimelineDayLabel(day),
            `${count} ${count === 1 ? "stop" : "stops"}`,
            dayMark(day, today, live, companionStops(byDay.get(day) ?? [])) ?? "",
          ]
            .filter(Boolean)
            .join(" / "),
          onClick: () => onOpenTimeline(day),
        };
      });
  for (const c of undatedCities) {
    itinerary.push({
      key: `undated-${c.city}-${c.arrive_on ?? ""}`,
      title: shortCity(c.city),
      note: [isDayTrip(c) ? "Day trip" : "", manyCountries ? placeCountry(c) : "", "No dates yet"]
        .filter(Boolean)
        .join(" / "),
      onClick: () => onOpenTimeline(),
    });
  }
  if (undated) {
    itinerary.push({
      key: "undated-stops",
      title: `${undated} ${undated === 1 ? "stop" : "stops"} without a day`,
      note: "Give them a day in the Timeline",
      onClick: () => onOpenTimeline(""),
    });
  }

  return (
    <div className="trip-overview">
      <div className="trip-figures">
        <div>
          <p className="trip-figure">{days.length}</p>
          <p className="trip-figure-label">{days.length === 1 ? "Day" : "Days"}</p>
        </div>
        <div>
          <p className="trip-figure">{Math.max(1, travellers.length)}</p>
          <p className="trip-figure-label">{travellers.length > 1 ? "Travellers" : "Traveller"}</p>
        </div>
      </div>

      {live ? <RightNow state={now} onOpenCompanion={onOpenCompanion} /> : null}

      <RuleLabel>Your itinerary</RuleLabel>
      {onFindCities && names.length === 0 ? (
        <RowButton
          title={findingCities ? "Finding cities…" : "Find the cities"}
          note="This trip has no cities yet. Béa can find them from your stops."
          onClick={onFindCities}
          disabled={findingCities}
        />
      ) : null}
      {itinerary.length === 0 ? (
        <p className="trip-row-empty">
          Nothing planned yet. Add stops, or let Béa draft the days from a plan you already have.
        </p>
      ) : (
        itinerary.map(({ key, ...row }) => <RowButton key={key} {...row} />)
      )}
      <button type="button" onClick={() => onOpenTimeline()} className="trip-primary">
        View itinerary
      </button>

      <RuleLabel>{past ? "This trip" : "Before you go"}</RuleLabel>
      <RowButton
        title="Bookings"
        note={[booked ? `${booked} booked` : "Flights, stays, transport and activities", flightNote]
          .filter(Boolean)
          .join(" / ")}
        onClick={() => onOpenBookings("all")}
      />
      {gaps.map((gap) => {
        const { key, ...row } = stayRow(gap);
        return <RowButton key={key} {...row} />;
      })}
      <RowButton
        title="To do and packing"
        note={`${todos} ${todos === 1 ? "to-do" : "to-dos"} / ${packed}`}
        onClick={() => onPrep("todo")}
      />
      <SavedRow cities={savedCities} onOpen={onOpenSaved} />
      <Link to="/profile/documents" className="trip-row">
        <span className="trip-row-title">Travel documents</span>
        <span className="trip-row-note">Passports, tickets and confirmations</span>
      </Link>
      {onOpenSettings ? (
        <RowButton
          title="Trip settings"
          note="People, budget, photos and the details"
          onClick={onOpenSettings}
        />
      ) : null}
    </div>
  );
}

type Row = { key: string; title: string; note: string; onClick: () => void };

/** A hairline, then a small label: how the design opens each group of rows. */
function RuleLabel({ children }: { children: ReactNode }) {
  return <h2 className="trip-rule-label">{children}</h2>;
}

/** The design's menu row: a 16px name over a 14px line, on a hairline. */
function RowButton({
  title,
  note,
  onClick,
  disabled = false,
}: {
  title: string;
  note: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="trip-row">
      <span className="trip-row-title">{title}</span>
      <span className="trip-row-note">{note}</span>
    </button>
  );
}

function dayMark(
  day: string,
  today: string,
  live: boolean,
  stops: readonly { arrived_at?: string | null; left_at?: string | null }[],
): "Today" | "Done" | null {
  const done = stops.length > 0 && stops.every((stop) => isDone(stop));
  if (done && day <= today) return "Done";
  if (day === today && live) return "Today";
  return null;
}

function RightNow({
  state,
  onOpenCompanion,
}: {
  state: CompanionState<ItineraryRow>;
  onOpenCompanion: () => void;
}) {
  const { phase, current, next, reached, total } = state;
  const focus = phase === "at" ? current : phase === "done" ? null : next;
  const kicker =
    phase === "at"
      ? "You are here"
      : phase === "between"
        ? "On the way"
        : phase === "done"
          ? "That's the day."
          : "Up next";
  const title =
    phase === "done" ? "Every stop is reached." : focus ? focus.title : "Nothing on today's plan.";
  const time =
    phase === "between" && next?.time_label
      ? `arrive ${next.time_label}`
      : phase === "at" || phase === "not-started"
        ? (focus?.time_label ?? "")
        : "";
  return (
    <>
      <RuleLabel>Right now</RuleLabel>
      <RowButton
        title={title}
        note={[
          kicker,
          time,
          phase === "at" && next
            ? `Next ${next.time_label ? `${next.time_label} ` : ""}${next.title}`
            : "",
          total > 0 ? `${reached} of ${total} reached` : "",
        ]
          .filter(Boolean)
          .join(" / ")}
        onClick={onOpenCompanion}
      />
    </>
  );
}

/** Places saved in the trip's cities, opening the Saved sheet. */
function SavedRow({ cities, onOpen }: { cities: string[]; onOpen: () => void }) {
  const { rows, loading } = useRecommendations();
  const count = placesForTrip(rows, cities).length;
  return (
    <RowButton
      title="Saved for this trip"
      note={
        loading
          ? "Loading your places…"
          : count
            ? `${count} ${count === 1 ? "place" : "places"} in these cities`
            : "Places you save in Recs for these cities show up here"
      }
      onClick={onOpen}
    />
  );
}
