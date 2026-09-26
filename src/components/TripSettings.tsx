import { useState } from "react";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { DateRangeField } from "@/components/DateRangeField";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import type { TripRow } from "@/hooks/useTrips";
import { formatTripLocation, locationFromParsedPlace } from "@/lib/place-label";

/*
 * The trip's own settings, lifted out of the full trip page's settings sheet
 * so the day route's Trip tab can offer the same controls. Behaviour is
 * unchanged; each piece takes the trip and the page's `onUpdate`.
 */

type OnUpdate = (patch: Partial<TripRow>) => Promise<void>;

export function TripBudgetSwitch({ trip, onUpdate }: { trip: TripRow; onUpdate: OnUpdate }) {
  return (
    <label className="flex items-center gap-2 px-1 text-[14.5px]">
      <input
        type="checkbox"
        checked={trip.budget_enabled}
        onChange={(e) => void onUpdate({ budget_enabled: e.target.checked })}
        className="size-5"
      />
      Track a budget for this trip
    </label>
  );
}

/**
 * Name, starting place, dates and status.
 *
 * A draft, saved with the button, rather than a live edit: renaming a trip
 * one keystroke at a time would rename it for everyone on it one keystroke
 * at a time. The draft starts from the trip each time the form appears.
 */
export function TripDetailsForm({
  trip,
  onUpdate,
  onSaved,
}: {
  trip: TripRow;
  onUpdate: OnUpdate;
  /** After a save goes through — to close the sheet the form sits in. */
  onSaved?: (() => void) | undefined;
}) {
  const [form, setForm] = useState({
    title: trip.title,
    city: formatTripLocation(trip.city, trip.country),
    country: trip.country ?? "",
    start_date: trip.start_date ?? "",
    end_date: trip.end_date ?? "",
    dates_status: trip.dates_status,
    status: trip.status,
  });
  const backwards = Boolean(form.start_date && form.end_date && form.end_date < form.start_date);
  // The button used to await the save with nothing either side of it: a
  // failure was an unhandled rejection and a success changed nothing on
  // screen, so both looked like a button that does nothing.
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="space-y-2">
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Trip name"
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
      />
      <PlaceSearchInput
        value={form.city}
        onChange={(v) => setForm({ ...form, city: v })}
        onPick={(p) => {
          const loc = locationFromParsedPlace(p);
          setForm({ ...form, city: loc.city, country: loc.country || form.country });
        }}
        placeholder="Starting city — search it"
        areas
      />
      <DateRangeField
        start={form.start_date}
        end={form.end_date}
        onChange={(start_date, end_date) => setForm({ ...form, start_date, end_date })}
        datesStatus={form.dates_status}
        onDatesStatusChange={(dates_status) => setForm({ ...form, dates_status })}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-[14.5px]"
      />
      {backwards && (
        <p className="px-1 text-[13px] font-medium text-destructive">
          End date can't be earlier than the start date.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {[
          ["upcoming", "Upcoming"],
          ["active", "In progress"],
          ["past", "Past"],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setForm({ ...form, status: v as string })}
            className={`rounded-full border px-3 py-1.5 text-[13px] ${
              form.status === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        disabled={busy || !form.title.trim() || backwards}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          try {
            await onUpdate({
              title: form.title.trim(),
              city: form.city,
              country: form.country,
              start_date: form.start_date,
              end_date: form.end_date,
              dates_status: form.dates_status,
              status: form.status,
            } as Partial<TripRow>);
            setMessage({ ok: true, text: "Saved." });
            onSaved?.();
          } catch (e) {
            const text =
              e instanceof Error
                ? e.message
                : typeof e === "object" && e && "message" in e
                  ? String((e as { message: unknown }).message)
                  : "";
            setMessage({ ok: false, text: text ? `Couldn't save: ${text}` : "Couldn't save." });
          } finally {
            setBusy(false);
          }
        }}
        className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`px-1 text-[13px] font-medium ${
            message.ok ? "text-muted-foreground" : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

/** Delete, behind a confirmation that says what goes with it. */
export function TripDeleteButton({
  onDelete,
  onConfirmed,
}: {
  onDelete: () => Promise<void>;
  /** Right after confirming, before the delete finishes — to close a sheet. */
  onConfirmed?: (() => void) | undefined;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-destructive hover:bg-elevated"
      >
        Delete trip
      </button>
      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this trip?"
        body="This permanently removes the trip, its timeline, stops, budget and invites. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirming(false);
          onConfirmed?.();
          void onDelete();
        }}
      />
    </>
  );
}
