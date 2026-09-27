import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

/**
 * The booking detail every place shows the same way: the stop's booking
 * sheet, the trip, and Trip documents. Two halves — the facts, read, and the
 * fields, edited — so a booking looks and is typed the same wherever it is
 * opened.
 */

export type BookingFact = { label: string; value: ReactNode };

/** "Confirmation  BEA-48321" rows split by hairlines; empty values skipped. */
export function BookingFacts({ facts }: { facts: BookingFact[] }) {
  const shown = facts.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="divide-y divide-border">
      {shown.map((f) => (
        <div key={f.label} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-[14px] text-muted-foreground">{f.label}</dt>
          <dd className="min-w-0 text-right text-[14.5px] font-semibold [overflow-wrap:anywhere]">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Booked (optional), reference and details — the booking's editable part.
 * Controlled: the caller keeps the draft and decides when it is saved.
 */
export function BookingFields({
  subject,
  booked,
  onBookedChange,
  reference,
  onReferenceChange,
  referenceMax,
  details,
  onDetailsChange,
  detailsMax,
  detailsLabel = "Details",
  detailsPlaceholder = "Provider, entry time, what to bring",
}: {
  /** What is booked, for the switch's accessible name. */
  subject: string;
  booked?: boolean | undefined;
  onBookedChange?: ((booked: boolean) => void) | undefined;
  reference: string;
  onReferenceChange: (value: string) => void;
  referenceMax: number;
  details: string;
  onDetailsChange: (value: string) => void;
  detailsMax: number;
  detailsLabel?: string;
  detailsPlaceholder?: string;
}) {
  return (
    <div className="space-y-3">
      {booked !== undefined && onBookedChange && (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated px-3 py-2.5">
          <span className="text-[14.5px] font-semibold">Booked</span>
          <Switch
            checked={booked}
            onCheckedChange={onBookedChange}
            aria-label={`${subject} is booked`}
          />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-[12.5px] font-semibold text-muted-foreground">Reference</span>
        <input
          value={reference}
          onChange={(e) => onReferenceChange(e.target.value)}
          maxLength={referenceMax}
          placeholder="Confirmation or ticket number"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] tabular-nums"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[12.5px] font-semibold text-muted-foreground">{detailsLabel}</span>
        <textarea
          value={details}
          onChange={(e) => onDetailsChange(e.target.value)}
          maxLength={detailsMax}
          rows={3}
          placeholder={detailsPlaceholder}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
        />
      </label>
    </div>
  );
}
