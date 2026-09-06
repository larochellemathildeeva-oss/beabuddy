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

export function DateRangeField({
  start,
  end,
  onChange,
  datesStatus,
  onDatesStatusChange,
  placeholder = "Dates",
  className = "w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-left text-[14px]",
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  datesStatus?: DatesStatus;
  onDatesStatusChange?: (status: DatesStatus) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const label = formatDateRangeLabel(start, end);
  const selected: DateRange = {
    from: start ? parseLocalDate(start) : undefined,
    to: end ? parseLocalDate(end) : undefined,
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${className} flex items-center gap-2`}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className={label ? "text-foreground" : "text-muted-foreground"}>{label || placeholder}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl border border-border bg-card p-4 sm:rounded-2xl"
          >
            <p id={titleId} className="px-1 font-display text-[19px] leading-snug">
              Trip dates
            </p>
            <p className="mb-2 px-1 text-[12px] text-muted-foreground">
              Tap the start, then the finish.
            </p>
            <Calendar
              mode="range"
              selected={selected}
              defaultMonth={selected.from ?? new Date()}
              numberOfMonths={1}
              onSelect={(range) => {
                const nextStart = range?.from ? toLocalISODate(range.from) : "";
                const nextEnd = range?.to ? toLocalISODate(range.to) : "";
                onChange(nextStart, nextEnd);
                if (range?.from && range.to) setOpen(false);
              }}
              className="mx-auto rounded-xl"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange("", "");
                  setOpen(false);
                }}
                className="flex-1 rounded-xl border border-border px-3 py-2.5 text-[13px] font-semibold"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-[13px] font-semibold text-primary-foreground"
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
              className={`rounded-full border px-3 py-1.5 text-[12px] ${
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
