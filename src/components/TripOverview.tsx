import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PlacePicture } from "@/components/PlacePicture";
import type { ItineraryRow } from "@/hooks/useTrips";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useTripGlances } from "@/hooks/useTripGlances";
import { companionState, companionStops, isDone, type CompanionState } from "@/lib/companion";
import { currentHighlights } from "@/lib/home-trip";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { timelineGlyph } from "@/lib/timeline-kind";
import { tripIsUnderway } from "@/lib/trip-perspective";
import { ALL_DAYS } from "@/lib/trip-days";
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
  /** The stop's id, which the trip page's city switcher picks by. */
  id?: string | null;
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
  onOpenBudget,
  onPlan,
  onAdd,
  budgetOn = false,
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
  /** The Timeline on a day, or on every day of one city (`cityId`). */
  onOpenTimeline: (dayKey?: string, cityId?: string) => void;
  onOpenCompanion: () => void;
  onOpenSaved: () => void;
  onPrep: (tab: PrepTab) => void;
  /** The trip menu: people, budget, photos and the details. */
  onOpenSettings?: () => void;
  /** The budget section of the trip menu. */
  onOpenBudget?: () => void;
  /** Plan with Béa, on this trip. */
  onPlan?: () => void;
  /** Add a stop, a saved place or a city. */
  onAdd?: () => void;
  budgetOn?: boolean;
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

  // Where the trip is, stretch by stretch (Figma "Itinerary sequence"): a
  // city and its days; days the route places nowhere are a stretch of their own.
  const sequence: SequenceCard[] = stretches.map((stretch) => {
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
      days:
        stretch.firstDay === stretch.lastDay
          ? `Day ${stretch.firstDay}`
          : `Days ${stretch.firstDay}\u2013${stretch.lastDay}`,
      note: [
        stretchDates(stretch.start, stretch.end),
        place && isDayTrip(place) ? "Day trip" : "",
        place && manyCountries ? placeCountry(place) : "",
        `${stretch.stops} ${stretch.stops === 1 ? "stop" : "stops"}`,
        mark,
      ]
        .filter(Boolean)
        .join(" / "),
      // One day opens on it; several open on that city's days, or on
      // every day when the stretch has no city to pick.
      onClick: () =>
        stretch.start === stretch.end
          ? onOpenTimeline(stretch.start)
          : onOpenTimeline(ALL_DAYS, place?.id ?? undefined),
    };
  });
  const extras: Row[] = [];
  for (const c of undatedCities) {
    extras.push({
      key: `undated-${c.city}-${c.arrive_on ?? ""}`,
      title: shortCity(c.city),
      note: [isDayTrip(c) ? "Day trip" : "", manyCountries ? placeCountry(c) : "", "No dates yet"]
        .filter(Boolean)
        .join(" / "),
      onClick: () => onOpenTimeline(),
    });
  }
  if (undated) {
    extras.push({
      key: "undated-stops",
      title: `${undated} ${undated === 1 ? "stop" : "stops"} without a day`,
      note: "Give them a day in the Timeline",
      onClick: () => onOpenTimeline(""),
    });
  }

  const kindLine = (parts: [number, string, string][]) =>
    parts
      .filter(([n]) => n > 0)
      .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
      .join(", ");
  const bookingLines = [
    kindLine([
      [bookedByKind.flight, "flight", "flights"],
      [bookedByKind.stay, "stay", "stays"],
    ]),
    kindLine([
      [bookedByKind.transport, "transfer", "transfers"],
      [bookedByKind.activity, "activity", "activities"],
    ]),
  ].filter(Boolean);
  const cityOfDay = (day: string) => {
    const stretch = stretches.find((st) => day >= st.start && day <= st.end);
    return stretch?.city ? shortCity(stretch.city.city) : "";
  };
  // The next few things on the plan, from today on.
  const highlights = items
    .filter(
      (item) => item.day_date && item.day_date >= today && timelineGlyph(item) !== "transport",
    )
    .sort((x, y) => (x.day_date ?? "").localeCompare(y.day_date ?? ""))
    .slice(0, 3);

  return (
    <div className="trip-overview">
      <div className="trip-figures">
        <div>
          <p className="trip-figure">{days.length}</p>
          <p className="trip-figure-label">{days.length === 1 ? "Day" : "Days"}</p>
        </div>
        {/* Nothing until the members have loaded, rather than a guessed "1". */}
        {travellers.length > 0 ? (
          <div>
            <p className="trip-figure">{travellers.length}</p>
            <p className="trip-figure-label">
              {travellers.length === 1 ? "Traveller" : "Travellers"}
            </p>
          </div>
        ) : null}
      </div>

      {live ? <RightNow state={now} onOpenCompanion={onOpenCompanion} /> : null}

      <RuleLabel>Itinerary sequence</RuleLabel>
      {onFindCities && names.length === 0 ? (
        <RowButton
          title={findingCities ? "Finding cities…" : "Find the cities"}
          note="This trip has no cities yet. Béa can find them from your stops."
          onClick={onFindCities}
          disabled={findingCities}
        />
      ) : null}
      {sequence.length === 0 && extras.length === 0 ? (
        <p className="trip-row-empty">
          Nothing planned yet. Add stops, or let Béa draft the days from a plan you already have.
        </p>
      ) : (
        <ol className="ov-sequence">
          {sequence.map((card) => (
            <li key={card.key}>
              <button type="button" onClick={card.onClick} className="ov-city">
                <span className="ov-city-name">{card.title}</span>
                <span className="ov-city-days">{card.days}</span>
                <span className="ov-city-note">{card.note}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {extras.map(({ key, ...row }) => (
        <RowButton key={key} {...row} />
      ))}
      <button type="button" onClick={() => onOpenTimeline()} className="trip-row">
        <span className="trip-row-title">View itinerary</span>
        <span className="trip-row-note">Every day, stop by stop</span>
      </button>

      {onPlan ? (
        <button type="button" onClick={onPlan} className="trip-primary ov-continue">
          <span className="ov-continue-title">Continue planning</span>
          <span className="ov-continue-note">Open assistant</span>
        </button>
      ) : null}

      <RuleLabel>Management</RuleLabel>
      <div className="ov-manage">
        {onAdd ? (
          <button type="button" onClick={onAdd} className="ov-tile">
            <span className="ov-tile-title">Add destination</span>
            <span className="ov-tile-note">Add a city</span>
          </button>
        ) : null}
        <button type="button" onClick={() => onPrep("todo")} className="ov-tile">
          <span className="ov-tile-title">To do</span>
          <span className="ov-tile-note">
            {todos} {todos === 1 ? "task" : "tasks"}
          </span>
        </button>
        {onOpenSettings ? (
          <button type="button" onClick={onOpenSettings} className="ov-tile">
            <span className="ov-tile-title">Trip menu / Settings</span>
            <span className="ov-tile-note">People, photos, details</span>
          </button>
        ) : null}
      </div>

      <div className="ov-cards">
        <button type="button" onClick={() => onOpenBookings("all")} className="ov-card">
          <span className="ov-card-title">Bookings by kind</span>
          {bookingLines.length > 0 ? (
            bookingLines.map((line) => (
              <span key={line} className="ov-card-note">
                {line}
              </span>
            ))
          ) : (
            <span className="ov-card-note">Flights, stays, transport and activities</span>
          )}
          {flightNote ? <span className="ov-card-note">{flightNote}</span> : null}
        </button>
        <button type="button" onClick={() => onPrep("todo")} className="ov-card">
          <span className="ov-card-title">Prep</span>
          <span className="ov-card-note">
            {todos} {todos === 1 ? "task" : "tasks"} left
          </span>
          <span className="ov-card-note">{packed}</span>
        </button>
        <Link to="/profile/documents" className="ov-card">
          <span className="ov-card-title">Documents</span>
          <span className="ov-card-note">Tickets and confirmations</span>
          <span className="ov-card-note">
            {bookingDocs.length ? `${bookingDocs.length} uploaded` : "Passports, tickets and more"}
          </span>
        </Link>
        <button
          type="button"
          onClick={onOpenBudget ?? onOpenSettings}
          disabled={!onOpenBudget && !onOpenSettings}
          className="ov-card"
        >
          <span className="ov-card-title">Budget</span>
          <span className="ov-card-note">
            {budgetOn ? "Review trip expenses" : "Set a trip budget"}
          </span>
        </button>
      </div>

      {gaps.map((gap) => {
        const { key, ...row } = stayRow(gap);
        return <RowButton key={key} {...row} />;
      })}
      <SavedRow cities={savedCities} onOpen={onOpenSaved} />

      {days.length > 0 ? (
        <>
          <RuleLabel>Days at a glance</RuleLabel>
          <ul className="ov-days">
            {days.map((day, i) => (
              <li key={day}>
                <button
                  type="button"
                  onClick={() => onOpenTimeline(day)}
                  className="ov-day"
                  aria-current={day === today && live ? "date" : undefined}
                >
                  <span className="ov-day-n">Day {i + 1}</span>
                  <span className="ov-day-city">{cityOfDay(day)}</span>
                  <span className="ov-day-date">{formatTimelineDayLabel(day)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {highlights.length > 0 ? (
        <>
          <div className="ov-head">
            <RuleLabel>Upcoming highlights</RuleLabel>
            <button type="button" onClick={() => onOpenTimeline()} className="ov-see-all">
              See all
            </button>
          </div>
          <ul className="ov-highlights">
            {highlights.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenTimeline(item.day_date ?? undefined)}
                  className="ov-highlight"
                >
                  <PlacePicture
                    name={item.title}
                    kind={item.kind}
                    lat={item.lat}
                    lon={item.lon}
                    className="ov-highlight-art"
                  />
                  <span className="ov-highlight-title">{item.title}</span>
                  <span className="ov-highlight-date">
                    {item.day_date ? formatTimelineDayLabel(item.day_date) : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

type SequenceCard = { key: string; title: string; days: string; note: string; onClick: () => void };

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
