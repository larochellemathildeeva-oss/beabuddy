import { useEffect, useRef } from "react";
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

  return (
    <div
      ref={row}
      role="tablist"
      aria-label="Which day to show"
      className="no-scrollbar flex w-full snap-x gap-1.5 overflow-x-auto px-0.5 py-0.5"
    >
      <Card
        selected={value === ALL_DAYS}
        onSelect={() => onChange(ALL_DAYS)}
        label="All days"
        title={`All ${chips.filter((c) => c.key).length || chips.length} days of the trip`}
      />
      {chips.map((chip) => {
        const date = chip.key ? new Date(`${chip.key}T00:00:00`) : null;
        const label = date
          ? `${date.toLocaleDateString(undefined, { weekday: "short" })} ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : "No date";
        return (
          <Card
            key={chip.key || "undated"}
            selected={value === chip.key}
            onSelect={() => onChange(chip.key)}
            label={label}
            title={[chip.ordinal, `${chip.count} stops`, chip.isToday ? "today" : ""]
              .filter(Boolean)
              .join(" · ")}
            today={chip.isToday}
          />
        );
      })}
    </div>
  );
}

function Card({
  selected,
  onSelect,
  label,
  title,
  today = false,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  title: string;
  today?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      title={title}
      className={`inline-flex min-h-9 shrink-0 snap-center items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[14px] font-semibold transition-colors ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground"
      }`}
    >
      {label}
      {today && (
        <span
          aria-hidden
          className={`size-1.5 rounded-full ${selected ? "bg-primary-foreground" : "bg-primary"}`}
        />
      )}
      <span className="sr-only">{title ? `, ${title}` : ""}</span>
    </button>
  );
}
