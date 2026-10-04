import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, FileText, Plus } from "@/components/icons";
import { BookingSheet, type BookingPatch } from "@/components/day/BookingSheet";
import { DocumentIcon, KindTile } from "@/components/documents/DocumentParts";
import type { ItineraryRow } from "@/hooks/useTrips";
import { eventKind, eventWhenLabel, type TripDocument } from "@/lib/trip-documents";
import { bookingKind, tripBookings, type BookingKind } from "@/lib/trip-overview";

export type BookingFilter = BookingKind | "all";

const FILTERS: { key: BookingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "flight", label: "Flights" },
  { key: "stay", label: "Stays" },
  { key: "transport", label: "Transport" },
  { key: "activity", label: "Activities" },
];

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
      className="flex w-full items-center gap-3 px-3 py-3 text-left"
    >
      <KindTile kind={eventKind(stop.kind)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-semibold leading-tight">{stop.title}</span>
        {booked && stop.booking_ref ? (
          <span className="block truncate text-[14px] text-muted-foreground">
            {stop.booking_ref}
          </span>
        ) : null}
        <span className="block truncate text-[14px] text-muted-foreground">
          {eventWhenLabel(stop.day_date, stop.time_label) || (booked ? "Booked" : "No date yet")}
        </span>
      </span>
      {booked ? null : (
        <span className="rounded-full bg-elevated px-2 py-0.5 text-[13px] font-semibold text-muted-foreground">
          Not booked
        </span>
      )}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );

  const docRow = (doc: TripDocument, event: ItineraryRow | undefined) => (
    <button
      key={doc.id}
      type="button"
      onClick={() => void navigate({ to: "/profile/documents", search: { doc: doc.id } })}
      className="flex w-full items-center gap-3 px-3 py-3 text-left"
    >
      <DocumentIcon doc={doc} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-semibold leading-tight">{doc.title}</span>
        {doc.lines.map((line) => (
          <span key={line} className="block truncate text-[14px] text-muted-foreground">
            {line}
          </span>
        ))}
        {event ? (
          <span className="block truncate text-[14px] text-muted-foreground">
            {eventWhenLabel(event.day_date, event.time_label) || event.title}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => onFilter(f.key)}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 text-[14px] font-semibold ${
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="plain-card p-4 text-[16px] leading-snug text-muted-foreground">
          {EMPTY[filter]}
        </p>
      ) : (
        <div className="plain-card divide-y divide-border overflow-hidden">
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
          <h3 className="mb-2 px-0.5 font-display text-[20px] leading-tight">
            On the itinerary, not booked yet
          </h3>
          <div className="plain-card divide-y divide-border overflow-hidden">
            {planned.map((stop) => stopRow(stop, false))}
          </div>
        </section>
      )}

      <Link
        to="/profile/documents"
        className="btn-primary flex w-full items-center justify-center gap-2"
      >
        <Plus className="size-5" aria-hidden />
        Add a booking document
      </Link>
      <p className="flex items-center gap-1.5 px-1 text-[14px] leading-snug text-muted-foreground">
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
