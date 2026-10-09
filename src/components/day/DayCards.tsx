import { useEffect, useRef } from "react";
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
  ruled = false,
  allDays = true,
}: {
  chips: DayChip[];
  value: DayChoice;
  onChange: (next: DayChoice) => void;
  /** The map's words-only tabs (Figma "Today / All days"): "Today", "Day 2", "All days". */
  ruled?: boolean;
  /** Offer the whole trip as a choice. */
  allDays?: boolean;
}) {
  const choices: DayChoice[] = [...(allDays ? [ALL_DAYS] : []), ...chips.map((chip) => chip.key)];
  const at = Math.max(0, choices.indexOf(value));
  const dots = useRef<HTMLDivElement>(null);
  // On a long trip the dots scroll; keep the chosen one in view.
  useEffect(() => {
    dots.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [value]);
  const step = useDayStepper(chips, value, onChange);
  const swipe = useDaySwipe(step);
  const nameOf = (key: DayChoice) => {
    if (key === ALL_DAYS) return "All days";
    const date = key ? new Date(`${key}T00:00:00`) : null;
    return date
      ? `${date.toLocaleDateString(undefined, { weekday: "short" })} ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : "No date";
  };
  const parts = (key: DayChoice) => {
    if (key === ALL_DAYS) return { top: "All", bottom: "days", small: true };
    const date = key ? new Date(`${key}T00:00:00`) : null;
    return date
      ? {
          top: date.toLocaleDateString(undefined, { weekday: "short" }),
          bottom: String(date.getDate()),
        }
      : { top: "No", bottom: "date", small: true };
  };
  return (
    <div
      role="tablist"
      aria-label="Which day to show. Swipe sideways to change day."
      className={ruled ? "day-tabs-ruled touch-pan-y" : "day-pills touch-pan-y"}
      {...swipe}
    >
      <div ref={dots} className="no-scrollbar flex w-full items-stretch gap-1 overflow-x-auto">
        {choices.map((key, index) => {
          const { top, bottom, small } = parts(key);
          const chip = chips.find((c) => c.key === key);
          const today = chip?.isToday;
          return (
            <button
              key={key || "undated"}
              type="button"
              role="tab"
              tabIndex={index === at ? 0 : -1}
              aria-selected={index === at}
              aria-label={`${chip?.ordinal ? `${chip?.ordinal}, ` : ""}${nameOf(key)}${today ? ", today" : ""}`}
              title={nameOf(key)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? Math.min(index + 1, choices.length - 1)
                    : event.key === "ArrowLeft"
                      ? Math.max(index - 1, 0)
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? choices.length - 1
                          : undefined;
                if (next === undefined) return;
                event.preventDefault();
                const choice = choices[next];
                if (choice === undefined) return;
                onChange(choice);
                dots.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
              }}
              onClick={() => onChange(key)}
              className={ruled ? undefined : "day-pill"}
            >
              {ruled ? (
                <span>
                  {key === ALL_DAYS ? "All days" : today ? "Today" : chip?.ordinal || nameOf(key)}
                </span>
              ) : (
                <>
                  <span className="text-[12px]">{top}</span>
                  <span className={small ? "text-[12px]" : "text-[16px] leading-none tabular-nums"}>
                    {bottom}
                  </span>
                  {today ? <span aria-hidden className="day-pill-dot" /> : null}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
