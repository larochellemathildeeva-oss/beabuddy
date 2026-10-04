import { type ReactNode } from "react";
import { ChevronDown, Signpost, MoreHorizontal, Plus } from "@/components/icons";

export function RailLine() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-6 left-[calc(0.875rem-1px)] top-6 border-l-2 border-dashed border-primary/35"
    />
  );
}

/**
 * The Timeline's heading: "Day 1 · Thu, Oct 1" in the serif with the day's
 * size under it, a round + to add to that day, and ⋯ for the list's options.
 * Tapping the title folds the day away.
 */
export function TimelineHead({
  title,
  line,
  open = true,
  onToggle,
  onAdd,
  addLabel,
  onMore,
  onDirections,
  directionsBusy = false,
  children,
}: {
  title: string;
  line: string;
  open?: boolean;
  onToggle?: () => void;
  onAdd: () => void;
  addLabel: string;
  onMore?: () => void;
  /** Work out the walks and drives between the stops, from the top of the list. */
  onDirections?: () => void;
  directionsBusy?: boolean;
  children?: ReactNode;
}) {
  const heading = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="block font-display text-[27px] leading-none">{title}</span>
        {onToggle ? (
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
            aria-hidden
          />
        ) : null}
      </span>
      <span className="mt-1 block text-[13.5px] text-muted-foreground">{line}</span>
      {children}
    </>
  );
  return (
    <div className="mb-2 flex items-start justify-between gap-2 border-b border-border pb-3">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          {heading}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{heading}</div>
      )}
      {onDirections ? (
        <button
          type="button"
          onClick={onDirections}
          disabled={directionsBusy}
          aria-label={directionsBusy ? "Working out directions" : "Directions between stops"}
          title="Get directions"
          className="grid size-12 shrink-0 place-items-center rounded-full border border-border bg-card text-primary shadow-xs disabled:opacity-60"
        >
          <Signpost className={`size-5 ${directionsBusy ? "animate-pulse" : ""}`} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onAdd}
        aria-label={addLabel}
        title={addLabel}
        className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
      >
        <Plus className="size-6" aria-hidden />
      </button>
      {onMore ? (
        <button
          type="button"
          onClick={onMore}
          aria-label="Timeline options"
          title="Timeline options"
          className="grid size-12 shrink-0 place-items-center rounded-full border border-border bg-card shadow-xs"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** One row of choices in the Timeline's ⋯ sheet. */
export function MenuChoice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  options: readonly (readonly [boolean, string])[];
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <div role="group" aria-label={label} className="flex gap-1 rounded-full bg-elevated p-1">
        {options.map(([v, text]) => (
          <button
            key={text}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`min-h-9 flex-1 rounded-full px-3 text-[13px] transition-colors ${
              value === v
                ? "bg-primary font-semibold text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The line that says you are here.
 *
 * Borrowed from the shape everyone already reads without being taught: the
 * package-tracking rule, the boarding-pass rule. Above it is behind you,
 * below it is what is left. It needs no column on the table and no ticking
 * things off — only the clock and the times already written down — so it is
 * right on a day nobody has touched since it was imported.
 *
 * Drawn only on today, and only on a day that names at least one time. A rule
 * through an untimed list would be claiming an order the plan never had.
 */
export function NowLine({ done = false }: { done?: boolean }) {
  return (
    <li aria-hidden className="relative -my-0.5 flex items-center gap-2 py-1">
      <span className="h-px flex-1 bg-primary/40" />
      <span className="text-[11.5px] font-semibold uppercase tracking-wider text-primary">
        {done ? "That was today" : "Now"}
      </span>
      <span className="h-px flex-1 bg-primary/40" />
    </li>
  );
}
