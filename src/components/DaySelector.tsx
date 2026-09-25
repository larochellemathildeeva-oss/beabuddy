import { ALL_DAYS, type DayChip, type DayChoice } from "@/lib/trip-days";

/**
 * Which day of the trip is on screen.
 *
 * A horizontal strip rather than a dropdown: the days of a trip are few, and
 * seeing how many there are — and how loaded each one is — is half of what
 * this answers. A select box would hide both behind a tap.
 *
 * "All days" leads, because it is where the screen has always started and
 * where a plan still being written belongs. The numbered days follow in
 * order, and the undated pile sits last with no number, the same way the
 * timeline groups it.
 */
export function DaySelector({
  chips,
  value,
  onChange,
}: {
  chips: DayChip[];
  value: DayChoice;
  onChange: (next: DayChoice) => void;
}) {
  const total = chips.reduce((sum, chip) => sum + chip.count, 0);

  return (
    <div
      role="tablist"
      aria-label="Which day to show"
      // -mx-1/px-1 so the focus ring on the first and last chip is not
      // clipped by the scroll container.
      className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 sm:gap-2"
    >
      <DayTab
        selected={value === ALL_DAYS}
        onSelect={() => onChange(ALL_DAYS)}
        ordinal="Whole trip"
        label={`${chips.length} ${chips.length === 1 ? "day" : "days"}`}
        count={total}
      />
      {chips.map((chip) => (
        <DayTab
          key={chip.key || "undated"}
          selected={value === chip.key}
          onSelect={() => onChange(chip.key)}
          // The undated pile is no day in particular, so its label carries
          // the whole meaning and the eyebrow says so rather than sitting
          // empty.
          ordinal={chip.ordinal || "Undated"}
          label={chip.label}
          count={chip.count}
          isToday={chip.isToday}
        />
      ))}
    </div>
  );
}

function DayTab({
  selected,
  onSelect,
  ordinal,
  label,
  count,
  isToday = false,
}: {
  selected: boolean;
  onSelect: () => void;
  ordinal: string;
  label: string;
  count: number;
  isToday?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      // The prototype's day card: charcoal when chosen, white otherwise.
      // Sizes from the prototype's DaySelector: 40px tall on a phone, 46 wider.
      className={`flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 text-left shadow-2xs transition-all sm:min-h-[46px] sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-2 ${
        selected
          ? "scale-[1.01] border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground"
      }`}
    >
      <span className="min-w-0">
        <span
          className={`block text-[9px] font-bold uppercase tracking-wider sm:text-[10px] ${
            selected ? "text-[oklch(0.78_0.1_45)]" : "text-muted-foreground"
          }`}
        >
          {ordinal}
          {/* Spoken as part of the tab, so a screen reader reaching today
              hears it without needing the colour. */}
          {isToday && <span className="ml-1">· Today</span>}
        </span>
        <span className="block whitespace-nowrap text-xs font-semibold tracking-tight">
          {label}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold sm:rounded-lg sm:px-2 sm:text-[10px] ${
          selected ? "bg-background/15 text-background/85" : "bg-elevated text-muted-foreground"
        }`}
      >
        {count} {count === 1 ? "stop" : "stops"}
      </span>
    </button>
  );
}
