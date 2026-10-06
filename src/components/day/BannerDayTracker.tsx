import { useEffect, useRef } from "react";
import { Check } from "@/components/icons";

export type TrackerDay = {
  key: string;
  /** What sits in the circle: the day's number, or "All". */
  mark: string;
  title: string;
  subtitle: string;
  /** Every stop of the day is reached. */
  complete: boolean;
};

/**
 * The trip's days as plain circles with a name and date, on the banner's
 * picture. The Overview banner and the Map's day switcher both draw it, so
 * the two stay identical. With `value` set, the chosen day is ringed.
 */
export function BannerDayTracker({
  label,
  summary,
  days,
  value,
  onPick,
  onPhoto = true,
}: {
  label: string;
  summary?: string;
  days: TrackerDay[];
  value?: string | undefined;
  onPick: (key: string) => void;
  /** False on the page's own colour (the trip banner's strip). */
  onPhoto?: boolean;
}) {
  const list = useRef<HTMLOListElement>(null);
  // On a long trip, bring the chosen day into view.
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [value]);
  return (
    <section aria-label={label} className={onPhoto ? "text-white" : "text-foreground"}>
      {summary ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={`text-[14px] ${onPhoto ? "text-white/85" : "text-muted-foreground"}`}>
            {summary}
          </p>
        </div>
      ) : null}
      <ol ref={list} className="no-scrollbar relative mt-1 flex gap-2 overflow-x-auto">
        {days.map((day) => {
          const chosen = value !== undefined && day.key === value;
          return (
            <li key={day.key || "undated"} className="min-w-[100px] flex-1">
              <button
                type="button"
                aria-label={`${day.mark === "All" ? "All days" : `Day ${day.mark}`}, ${day.title}`}
                aria-pressed={value !== undefined ? chosen : undefined}
                onClick={() => onPick(day.key)}
                className="relative flex min-h-11 w-full items-center justify-center gap-2 px-2 py-1 text-[14px]"
              >
                <span
                  className={`relative grid size-7 shrink-0 place-items-center rounded-full border-2 text-[13px] font-semibold ${
                    chosen
                      ? `border-transparent bg-primary text-primary-foreground ring-4 ${onPhoto ? "ring-white/40" : "ring-primary/25"}`
                      : day.complete
                        ? onPhoto
                          ? "border-white bg-white text-black"
                          : "border-foreground bg-foreground text-background"
                        : onPhoto
                          ? "border-white bg-black/30 text-white"
                          : "border-foreground/70 text-foreground"
                  }`}
                >
                  {day.complete && !chosen ? <Check className="size-4" aria-hidden /> : day.mark}
                </span>
                <span className="flex min-w-0 flex-col text-left leading-tight">
                  <span className={`truncate ${chosen ? "font-bold" : "font-semibold"}`}>
                    {day.title}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[13px] ${onPhoto ? "text-white/80" : "text-muted-foreground"}`}
                  >
                    {day.subtitle}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
