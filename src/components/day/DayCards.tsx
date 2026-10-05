import { useDayStepper, useDaySwipe } from "@/hooks/useDaySwipe";
import { ALL_DAYS, type DayChip, type DayChoice } from "@/lib/trip-days";

/**
 * Which day is on screen, in one slim line: the day's name and a dot for each
 * day, the chosen one filled. Swipe the screen sideways to change day; the
 * dots are small touch targets too, for a mouse or a keyboard. The whole trip
 * leads, and an undated pile sits last.
 */
export function DayCards({
  chips,
  value,
  onChange,
}: {
  chips: DayChip[];
  value: DayChoice;
  onChange: (next: DayChoice) => void;
}) {
  const choices: DayChoice[] = [ALL_DAYS, ...chips.map((chip) => chip.key)];
  const at = Math.max(0, choices.indexOf(value));
  const step = useDayStepper(chips, value, onChange);
  const swipe = useDaySwipe(step);
  const nameOf = (key: DayChoice) => {
    if (key === ALL_DAYS) return "All days";
    const date = key ? new Date(`${key}T00:00:00`) : null;
    return date
      ? `${date.toLocaleDateString(undefined, { weekday: "short" })} ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : "No date";
  };
  const chip = chips.find((c) => c.key === value);
  return (
    <div
      role="tablist"
      aria-label="Which day to show. Swipe sideways to change day."
      className="flex min-h-9 w-full touch-pan-y items-center justify-between gap-3 px-1"
      {...swipe}
    >
      <p aria-live="polite" className="min-w-0 truncate text-[14px] font-semibold">
        {nameOf(value)}
        {chip?.isToday ? <span className="font-normal text-muted-foreground"> · Today</span> : null}
        {value !== ALL_DAYS && chip?.ordinal ? (
          <span className="font-normal text-muted-foreground"> · {chip.ordinal}</span>
        ) : null}
      </p>
      <div className="flex shrink-0 items-center">
        {choices.map((key, index) => (
          <button
            key={key || "undated"}
            type="button"
            role="tab"
            aria-selected={index === at}
            aria-label={nameOf(key)}
            title={nameOf(key)}
            onClick={() => onChange(key)}
            className="grid size-6 place-items-center"
          >
            <span
              className={`rounded-full transition-all ${
                index === at ? "size-2.5 bg-primary" : "size-1.5 bg-muted-foreground/40"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
