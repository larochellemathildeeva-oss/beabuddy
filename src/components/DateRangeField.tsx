import { useEffect, useId, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  formatDateRangeLabel,
  parseLocalDate,
  toLocalISODate,
  type DatesStatus,
} from "@/lib/trip-dates";
import { rangeTap } from "@/lib/trip-cities";

export function DateRangeField({
  start,
  end,
  onChange,
  datesStatus,
  onDatesStatusChange,
  placeholder = "Dates",
  title = "Trip dates",
  month,
  className = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[15px]",
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  datesStatus?: DatesStatus;
  onDatesStatusChange?: (status: DatesStatus) => void;
  placeholder?: string;
  /** The calendar's heading. */
  title?: string;
  /** The month to open on when nothing is picked yet, as YYYY-MM-DD. */
  month?: string | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  /**
   * The start of a range still waiting for its end. The calendar stays open
   * until the second tap: react-day-picker reports the first tap as a whole
   * one-day range, which used to close it before the end could be picked.
   */
  const [pending, setPending] = useState<string | null>(null);
  const openPicker = () => {
    setPending(null);
    setOpen(true);
  };
  // Closed after one tap: a one-day range rather than a start with no end.
  const close = () => {
    if (pending) onChange(pending, pending);
    setPending(null);
    setOpen(false);
  };
  const titleId = useId();
  const label = formatDateRangeLabel(start, end);
  const selected: DateRange = {
    from: start ? parseLocalDate(start) : undefined,
    to: end ? parseLocalDate(end) : undefined,
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${className} flex items-center gap-2`}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className={label ? "text-foreground" : "text-muted-foreground"}>
          {label || placeholder}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={close}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl border border-border bg-card p-4 sm:rounded-2xl"
          >
            <p id={titleId} className="px-1 font-display text-[19px] leading-snug">
              {title}
            </p>
            <p className="mb-2 px-1 text-[13px] text-muted-foreground">
              {pending ? "Now tap the last day." : "Tap the first day, then the last."}
            </p>
            <Calendar
              mode="range"
              selected={pending ? { from: parseLocalDate(pending), to: undefined } : selected}
              defaultMonth={
                selected.from ?? (month ? parseLocalDate(month) : undefined) ?? new Date()
              }
              numberOfMonths={1}
              onSelect={(_range, day) => {
                const tap = rangeTap(pending, toLocalISODate(day));
                onChange(tap.start, tap.end);
                if (tap.done) {
                  setPending(null);
                  setOpen(false);
                } else {
                  setPending(tap.start);
                }
              }}
              className="mx-auto rounded-xl"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange("", "");
                  setPending(null);
                  setOpen(false);
                }}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-[14.5px] font-semibold"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-xl bg-primary px-3 py-2 text-[14.5px] font-semibold text-primary-foreground"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {datesStatus && onDatesStatusChange && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["tentative", "Tentative dates"],
              ["confirmed", "Confirmed dates"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onDatesStatusChange(value)}
              className={`rounded-full border px-3 py-1.5 text-[13px] ${
                datesStatus === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
