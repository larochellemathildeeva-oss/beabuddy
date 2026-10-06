import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sheet } from "@/components/Sheet";
import { ChevronRight, FileText } from "@/components/icons";
import { BookingFields } from "@/components/documents/BookingDetail";
import { useStopDocumentCount } from "@/hooks/useTripDocuments";
import type { ItineraryRow } from "@/hooks/useTrips";
import { BOOKING_DETAILS_MAX, BOOKING_REF_MAX, cleanBookingText, isBooked } from "@/lib/bookings";

export type BookingPatch = Pick<ItineraryRow, "booking_ref" | "booking_details"> & {
  booked: boolean;
};

/**
 * A stop's booking: booked or not, the reference, and anything else to show
 * at the door. Opened from the ticket button or the "Booked" badge on a
 * Timeline card. A draft, saved with the button, because a reference half
 * typed is not one anybody should see on the trip.
 *
 * The fields are the shared booking detail (`BookingFields`), the same one
 * Trip documents edits. Documents linked to this stop are one tap away, in
 * Trip documents, behind its lock.
 */
export function BookingSheet({
  item,
  open,
  onClose,
  onSave,
}: {
  item: ItineraryRow;
  open: boolean;
  onClose: () => void;
  onSave: (patch: BookingPatch) => Promise<void>;
}) {
  const [booked, setBooked] = useState(isBooked(item));
  const [ref, setRef] = useState(item.booking_ref ?? "");
  const [details, setDetails] = useState(item.booking_details ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const linkedDocs = useStopDocumentCount(item.id, open);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave({
        booked,
        booking_ref: cleanBookingText(ref, BOOKING_REF_MAX),
        booking_details: cleanBookingText(details, BOOKING_DETAILS_MAX),
      });
      onClose();
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Booking" hint={item.title} width="sm">
      <div className="space-y-3">
        <BookingFields
          subject={item.title}
          booked={booked}
          onBookedChange={setBooked}
          reference={ref}
          onReferenceChange={setRef}
          referenceMax={BOOKING_REF_MAX}
          details={details}
          onDetailsChange={setDetails}
          detailsMax={BOOKING_DETAILS_MAX}
        />
        {linkedDocs > 0 && (
          <Link
            to="/profile/documents"
            search={{ event: item.id }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <FileText className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 text-[14px] font-semibold">
              {linkedDocs === 1 ? "1 document" : `${linkedDocs} documents`} for this stop
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}
        {error && (
          <p role="alert" className="text-[14px] font-semibold text-destructive">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save booking"}
        </button>
      </div>
    </Sheet>
  );
}
