import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Sheet } from "@/components/Sheet";
import { ChevronRight, FileText, Plus } from "@/components/icons";
import { BookingSheet, type BookingPatch } from "@/components/day/BookingSheet";
import { DocumentRow, KindTile } from "@/components/documents/DocumentParts";
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
 * The trip's bookings, one list: stops marked booked on the timeline and the
 * Trip documents filed to this trip. It is what the Overview's tiles and the
 * trip menu's Flights, Hotels, Transport and Activities open — they used to
 * switch to the Timeline and leave the finding to you.
 *
 * A stop opens its booking sheet here; a document opens in Trip documents,
 * behind its lock. Stops of the kind that are planned but not booked are
 * listed under the bookings, so marking one booked is a tap away.
 */
export function TripBookingsSheet({
  open,
  onClose,
  kind,
  stops,
  docs,
  onSaveBooking,
}: {
  open: boolean;
  onClose: () => void;
  /** Which chip is chosen when the sheet opens. */
  kind: BookingFilter;
  stops: ItineraryRow[];
  docs: TripDocument[];
  onSaveBooking: (id: string, patch: BookingPatch) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<BookingFilter>(kind);
  const [editing, setEditing] = useState<ItineraryRow | null>(null);
  useEffect(() => {
    if (open) setFilter(kind);
  }, [open, kind]);

  const all = tripBookings(stops, docs);
  const shown = all.filter((b) => filter === "all" || b.kind === filter);
  const bookedIds = new Set(
    all.flatMap((b) => (b.source === "stop" ? [b.id] : b.eventId ? [b.eventId] : [])),
  );
  const planned = stops.filter((stop) => {
    const k = bookingKind(stop);
    if (!k || bookedIds.has(stop.id)) return false;
    // Only flights, stays and transport are worth a nudge in "All"; a list
    // of every café is not a booking list.
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
        <span className="block truncate text-[15px] font-semibold">{stop.title}</span>
        <span className="block truncate text-[12.5px] text-muted-foreground">
          {[eventWhenLabel(stop.day_date, stop.time_label), booked ? stop.booking_ref : ""]
            .filter(Boolean)
            .join(" · ") || (booked ? "Booked" : "Not booked yet")}
        </span>
      </span>
      {booked ? (
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-semibold text-primary">
          Booked
        </span>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );

  return (
    <>
      <Sheet open={open && !editing} onClose={onClose} title="Bookings">
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
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
          <p className="plain-card p-4 text-[14px] text-muted-foreground">{EMPTY[filter]}</p>
        ) : (
          <div className="plain-card divide-y divide-border overflow-hidden">
            {shown.map((b) => {
              if (b.source === "stop") {
                const stop = byId.get(b.id);
                return stop ? stopRow(stop, true) : null;
              }
              const doc = docById.get(b.id);
              if (!doc) return null;
              const event = b.eventId ? byId.get(b.eventId) : undefined;
              return (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  {...(event
                    ? {
                        subtitle: `${event.title} · ${eventWhenLabel(event.day_date, event.time_label)}`,
                      }
                    : {})}
                  onOpen={() => {
                    onClose();
                    void navigate({ to: "/profile/documents", search: { doc: doc.id } });
                  }}
                />
              );
            })}
          </div>
        )}

        {planned.length > 0 && (
          <>
            <p className="mb-2 mt-5 px-0.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              On the itinerary, not booked yet
            </p>
            <div className="plain-card divide-y divide-border overflow-hidden">
              {planned.map((stop) => stopRow(stop, false))}
            </div>
          </>
        )}

        <Link
          to="/profile/documents"
          onClick={onClose}
          className="btn-primary mt-4 flex w-full items-center justify-center gap-2"
        >
          <Plus className="size-5" aria-hidden />
          Add a booking document
        </Link>
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[12.5px] text-muted-foreground">
          <FileText className="size-3.5 shrink-0" aria-hidden />
          Confirmations you add in Trip documents and assign to this trip show up here.
        </p>
      </Sheet>

      {editing && (
        <BookingSheet
          key={editing.id}
          item={editing}
          open
          onClose={() => setEditing(null)}
          onSave={(patch) => onSaveBooking(editing.id, patch)}
        />
      )}
    </>
  );
}
