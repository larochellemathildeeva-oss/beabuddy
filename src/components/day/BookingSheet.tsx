import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Switch } from "@/components/ui/switch";
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
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated px-3 py-2.5">
          <span className="text-[14.5px] font-semibold">Booked</span>
          <Switch
            checked={booked}
            onCheckedChange={setBooked}
            aria-label={`${item.title} is booked`}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[12.5px] font-semibold text-muted-foreground">Reference</span>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            maxLength={BOOKING_REF_MAX}
            placeholder="Confirmation or ticket number"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] tabular-nums"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[12.5px] font-semibold text-muted-foreground">Details</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={BOOKING_DETAILS_MAX}
            rows={3}
            placeholder="Provider, entry time, what to bring"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
          />
        </label>
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-destructive">
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
