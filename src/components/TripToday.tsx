import { useState } from "react";
import { format } from "date-fns";
import { TimelineGlyphMark } from "@/components/TimelineGlyph";
import { timeForRail } from "@/lib/timeline-kind";
import { parseLocalDate } from "@/lib/trip-dates";
import { tripTodayView, untilLabel, type TodayItem } from "@/lib/trip-today";

function dayLabel(date: string): string {
  const parsed = parseLocalDate(date);
  return parsed ? format(parsed, "EEE d MMMM") : "";
}

/**
 * Today, on the trip page.
 *
 * Reading one day used to mean opening the month calendar, finding the square
 * and tapping it — a grid over every trip you have, to answer a question about
 * the one you are already looking at. This says it inline instead: what is on
 * today, or, before you go, how long you have and what day one holds. The
 * calendar keeps the job only it can do, which is every trip at once.
 */
export function TripToday({
  startDate,
  endDate,
  items,
}: {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  items: readonly TodayItem[];
}) {
  const view = tripTodayView({ startDate, endDate, items }, format(new Date(), "yyyy-MM-dd"));
  const [showAll, setShowAll] = useState(false);

  // A finished trip has nothing to say here, and an undated one has no day to
  // say it about. Both stay quiet rather than showing an empty strip.
  if (view.state === "past" || view.state === "undated") return null;

  const heading = view.state === "today" ? "Today" : untilLabel(view.daysUntil);
  const empty = view.state === "today" ? "Nothing planned today." : "Nothing on day one yet.";

  return (
    <div className="mb-3 rounded-xl bg-elevated p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="label-caps text-foreground">{heading}</p>
        <p className="text-[12px] text-muted-foreground">{dayLabel(view.date)}</p>
      </div>

      {view.items.length === 0 ? (
        <p className="mt-1 text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {(showAll ? view.items : view.items.slice(0, PREVIEW)).map((item) => {
            const time = timeForRail(item.time_label);
            return (
              <li key={item.id} className="flex items-center gap-2.5">
                <TimelineGlyphMark item={item} />
                {time && (
                  <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">
                    {time}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[14.5px]">{item.title}</span>
              </li>
            );
          })}
        </ul>
      )}
      {view.items.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-2 min-h-9 text-[12.5px] font-semibold text-primary underline underline-offset-2"
        >
          {showAll ? "Show fewer" : `Show all ${view.items.length}`}
        </button>
      )}
    </div>
  );
}

/** A day of forty-five entries is a list to open, not one to scroll past. */
const PREVIEW = 5;
