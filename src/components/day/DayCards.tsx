import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { ALL_DAYS, type DayChip, type DayChoice } from "@/lib/trip-days";

/**
 * Which day is on screen, as the master draws it: an arrow either side of a
 * row of day cards, each "Oct 1 / Thu / Day 1". The chosen day is filled
 * with the theme accent, the others outlined. The whole trip leads, as it
 * always has, and an undated pile sits last with no number.
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
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [value]);
  const step = (by: 1 | -1) => {
    const next = choices[at + by];
    if (next !== undefined) onChange(next);
  };
  const arrow =
    "grid size-11 shrink-0 place-items-center rounded-full text-foreground disabled:opacity-30";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={at === 0}
        aria-label="Previous day"
        className={arrow}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <div
        ref={row}
        role="tablist"
        aria-label="Which day to show"
        className="no-scrollbar flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto px-0.5 py-1"
      >
        <Card
          selected={value === ALL_DAYS}
          onSelect={() => onChange(ALL_DAYS)}
          top="All"
          middle={`${chips.filter((c) => c.key).length || chips.length} days`}
          bottom="Trip"
        />
        {chips.map((chip) => {
          const date = chip.key ? new Date(`${chip.key}T00:00:00`) : null;
          return (
            <Card
              key={chip.key || "undated"}
              selected={value === chip.key}
              onSelect={() => onChange(chip.key)}
              top={
                date
                  ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : "No date"
              }
              middle={date ? date.toLocaleDateString(undefined, { weekday: "short" }) : "—"}
              bottom={chip.ordinal || `${chip.count} stops`}
              today={chip.isToday}
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={at >= choices.length - 1}
        aria-label="Next day"
        className={arrow}
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function Card({
  selected,
  onSelect,
  top,
  middle,
  bottom,
  today = false,
}: {
  selected: boolean;
  onSelect: () => void;
  top: string;
  middle: string;
  bottom: string;
  today?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex min-w-[84px] shrink-0 snap-center flex-col items-center rounded-2xl border px-3 py-1.5 leading-tight transition-colors ${
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground"
      }`}
    >
      <span className="text-[14px] font-bold">{top}</span>
      <span
        className={`text-[13px] ${selected ? "text-primary-foreground/85" : "text-muted-foreground"}`}
      >
        {middle}
      </span>
      <span
        className={`text-[13px] ${selected ? "text-primary-foreground/85" : "text-muted-foreground"}`}
      >
        {bottom}
        {today ? " · Today" : ""}
      </span>
    </button>
  );
}
