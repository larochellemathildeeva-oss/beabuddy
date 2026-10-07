import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, FileText, Plus } from "@/components/icons";
import { BookingSheet, type BookingPatch } from "@/components/day/BookingSheet";
import type { ItineraryRow } from "@/hooks/useTrips";
import { eventWhenLabel, type TripDocument } from "@/lib/trip-documents";
import { bookingKind, tripBookings, type BookingKind } from "@/lib/trip-overview";

export type BookingFilter = BookingKind | "all";

const FILTERS: { key: BookingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "flight", label: "Flights" },
  { key: "stay", label: "Stays" },
  { key: "transport", label: "Transport" },
  { key: "activity", label: "Activities" },
];

/** The page's title for each kind: "Flights.", "Stays." … */
export const BOOKING_TITLES: Record<BookingFilter, string> = {
  all: "Bookings",
  flight: "Flights",
  stay: "Stays",
  transport: "Transport",
  activity: "Activities",
};

const EMPTY: Record<BookingFilter, string> = {
  all: "No bookings on this trip yet.",
  flight: "No flights on this trip yet.",
  stay: "No stays on this trip yet.",
  transport: "No transport on this trip yet.",
  activity: "No activities booked on this trip yet.",
};

/**
 * The trip's Bookings tab, as the master draws it: one list of the stops
 * marked booked on the timeline and the Trip documents filed to this trip.
 * The Overview's tiles and the trip menu's Flights, Hotels, Transport and
 * Activities open it on their kind.
 *
 * A stop opens its booking sheet here; a document opens its detail in Trip
 * documents — the same record the itinerary and the library open, behind
 * the documents lock. Stops of the kind that are planned but not booked are
 * listed under the bookings, so marking one booked is a tap away.
 */
export function TripBookings({
  filter,
  onFilter,
  stops,
  docs,
  onSaveBooking,
}: {
  filter: BookingFilter;
  onFilter: (next: BookingFilter) => void;
  stops: ItineraryRow[];
  docs: TripDocument[];
  onSaveBooking: (id: string, patch: BookingPatch) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState<ItineraryRow | null>(null);

  const all = tripBookings(stops, docs);
  const shown = all.filter((b) => filter === "all" || b.kind === filter);
  const bookedIds = new Set(
    all.flatMap((b) => (b.source === "stop" ? [b.id] : b.eventId ? [b.eventId] : [])),
  );
  const planned = stops.filter((stop) => {
    const k = bookingKind(stop);
    if (!k || bookedIds.has(stop.id)) return false;
    // Flights, stays and transport are worth a nudge under "All"; every café
    // on the trip is not a booking list.
    return filter === "all" ? k !== "activity" : k === filter;
  });
  const byId = new Map(stops.map((s) => [s.id, s]));
  const docById = new Map(docs.map((d) => [d.id, d]));

  const stopRow = (stop: ItineraryRow, booked: boolean) => (
    <button
      key={stop.id}
      type="button"
      onClick={() => setEditing(stop)}
      className="menu-row flex items-center gap-3"
    >
      <span className="min-w-0 flex-1">
        <span className="menu-row-title block truncate">{stop.title}</span>
        {booked && stop.booking_ref ? (
          <span className="menu-row-note block truncate">{stop.booking_ref}</span>
        ) : null}
        <span className="menu-row-note block truncate">
          {eventWhenLabel(stop.day_date, stop.time_label) || (booked ? "Booked" : "No date yet")}
        </span>
      </span>
      {booked ? (
        <span aria-hidden className="bk-check">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      ) : (
        <span className="mono-caps bk-mark">Mark booked</span>
      )}
    </button>
  );

  const docRow = (doc: TripDocument, event: ItineraryRow | undefined) => (
    <button
      key={doc.id}
      type="button"
      onClick={() => void navigate({ to: "/profile/documents", search: { doc: doc.id } })}
      className="menu-row flex items-center gap-3"
    >
      <span className="min-w-0 flex-1">
        <span className="menu-row-title block truncate">{doc.title}</span>
        {doc.lines.map((line) => (
          <span key={line} className="menu-row-note block truncate">
            {line}
          </span>
        ))}
        {event ? (
          <span className="menu-row-note block truncate">
            {eventWhenLabel(event.day_date, event.time_label) || event.title}
          </span>
        ) : null}
      </span>
    </button>
  );

  return (
    <div className="bk">
      <div className="bk-tabs" role="group" aria-label="Kind of booking">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => onFilter(f.key)}
            className="mono-caps"
          >
            {f.label}
          </button>
        ))}
      </div>

      <h3 className="mono-caps menu-group-label">Booked</h3>
      {shown.length === 0 ? (
        <p className="menu-row-note py-4">{EMPTY[filter]}</p>
      ) : (
        <div>
          {shown.map((b) => {
            if (b.source === "stop") {
              const stop = byId.get(b.id);
              return stop ? stopRow(stop, true) : null;
            }
            const doc = docById.get(b.id);
            return doc ? docRow(doc, b.eventId ? byId.get(b.eventId) : undefined) : null;
          })}
        </div>
      )}

      {planned.length > 0 && (
        <section>
          <h3 className="mono-caps menu-group-label">Not booked yet</h3>
          <div>{planned.map((stop) => stopRow(stop, false))}</div>
        </section>
      )}

      <Link to="/profile/documents" className="menu-done bg-primary mono-caps gap-2">
        <Plus className="size-4" aria-hidden />
        Add a booking document
      </Link>
      <p className="menu-row-note flex items-center gap-1.5 pt-3 text-[14px] leading-snug">
        <FileText className="size-3.5 shrink-0" aria-hidden />
        Confirmations you add in Trip documents and assign to this trip show up here.
      </p>

      {editing && (
        <BookingSheet
          key={editing.id}
          item={editing}
          open
          onClose={() => setEditing(null)}
          onSave={(patch) => onSaveBooking(editing.id, patch)}
        />
      )}
    </div>
  );
}
