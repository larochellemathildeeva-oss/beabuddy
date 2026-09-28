import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Coins } from "@/components/icons";
import { ALL_DAYS, type DayChip, type DayChoice } from "@/lib/trip-days";
import { dayTitle } from "@/components/day/stop-words";

/** The element the app scrolls in (`AppShell`'s <main>), or the page. */
function scrollRoot(from: HTMLElement | null): HTMLElement | null {
  return from?.closest<HTMLElement>('[data-scroll-restoration-id="app-main"]') ?? null;
}

/** Room the bar takes, so a day's heading lands just under it. */
const BAR_PX = 52;

/**
 * "Day 1 · Thu, Oct 1", pinned while the day cards are scrolled away.
 *
 * Arrows only, no swipe: a sideways swipe on the list already marks a stop
 * done or opens its actions. With one day shown the arrows change the day;
 * with the whole trip shown the bar follows the day being read, and the
 * arrows scroll to the day before or after. Tapping the name goes back up to
 * the day cards.
 *
 * It sits in a zero-height sticky strip, so showing it never moves the list.
 * Each day's section carries `data-day-key` for it to read.
 */
export function StickyDayBar({
  chips,
  value,
  onChange,
  anchor,
  onCurrency,
}: {
  chips: DayChip[];
  value: DayChoice;
  onChange: (next: DayChoice) => void;
  /** The day cards: the bar shows once they are out of sight. */
  anchor: RefObject<HTMLElement | null>;
  /** Opens the currency sheet, so a price can be checked mid-day without scrolling up. */
  onCurrency?: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [reading, setReading] = useState<string | null>(null);

  useEffect(() => {
    const target = anchor.current;
    const root = scrollRoot(target);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setShown(Boolean(entry && !entry.isIntersecting)),
      { root },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [anchor]);

  // With the whole trip on screen, which day is being read: the last one
  // whose heading has passed under the bar.
  useEffect(() => {
    if (value !== ALL_DAYS) return;
    const root = scrollRoot(anchor.current);
    if (!root) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const top = root.getBoundingClientRect().top + BAR_PX + 8;
      let key: string | null = null;
      for (const section of root.querySelectorAll<HTMLElement>("[data-day-key]")) {
        if (section.offsetParent === null) continue;
        if (section.getBoundingClientRect().top <= top) key = section.dataset["dayKey"] ?? null;
      }
      setReading(key);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, anchor]);

  const allDays = value === ALL_DAYS;
  const currentKey = allDays ? (reading ?? chips[0]?.key ?? "") : value;
  const at = Math.max(
    0,
    chips.findIndex((chip) => chip.key === currentKey),
  );
  const chip = chips[at];
  const label = chip
    ? dayTitle(chip.key, chip.ordinal, chip.key ? chip.key : "No date")
    : "Whole trip";

  const scrollToDay = (key: string) => {
    const root = scrollRoot(anchor.current);
    const section = root?.querySelector<HTMLElement>(`[data-day-key="${CSS.escape(key)}"]`);
    if (!root || !section) return;
    const offset = section.getBoundingClientRect().top - root.getBoundingClientRect().top;
    root.scrollTo({ top: root.scrollTop + offset - BAR_PX, behavior: "smooth" });
  };

  const step = (by: 1 | -1) => {
    const next = chips[at + by];
    if (!next) return;
    if (allDays) {
      scrollToDay(next.key);
    } else {
      onChange(next.key);
      // The new day starts at its top, under the bar.
      requestAnimationFrame(() => scrollToDay(next.key));
    }
  };

  const arrow =
    "grid size-9 shrink-0 place-items-center rounded-full text-foreground disabled:opacity-30";

  return (
    <div className="sticky top-0 z-30 h-0" aria-hidden={!shown}>
      <div
        className={`absolute -inset-x-3 top-0 flex items-center gap-1 border-b border-border bg-background/90 px-2 py-1.5 backdrop-blur-xl transition-[opacity,transform] duration-200 ${
          shown ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={at === 0}
          tabIndex={shown ? 0 : -1}
          aria-label="Day before"
          className={arrow}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => anchor.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          tabIndex={shown ? 0 : -1}
          className="min-w-0 flex-1 truncate text-center font-display text-[16.5px]"
        >
          {label}
          {chip?.isToday ? <span className="ml-1.5 text-[12px] text-primary">Today</span> : null}
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={at >= chips.length - 1}
          tabIndex={shown ? 0 : -1}
          aria-label="Day after"
          className={arrow}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
        {onCurrency ? (
          <button
            type="button"
            onClick={onCurrency}
            tabIndex={shown ? 0 : -1}
            aria-label="Currency"
            title="Convert prices into your money"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-primary"
          >
            <Coins className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
