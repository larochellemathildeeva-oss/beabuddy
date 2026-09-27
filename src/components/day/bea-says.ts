import { dayTightnessNote, type PacedItem } from "@/lib/day-shape";
import type { LeaveBy } from "@/lib/companion";
import { stayLabel } from "@/lib/planned-stay";
import { timeForRail } from "@/lib/timeline-kind";

type Stop = PacedItem & { planned_stay_minutes?: number | null };

/**
 * What Béa says about a stop, in her bubble on Companion and the map.
 *
 * Only facts the plan already carries, in the third person and without a
 * joke: the stay planned here, the next stop and when to leave for it — or,
 * first, the day-shape note when the gap to the next stop is shorter than
 * the walk (the same sentence Split shows as Béa's note). Null when the plan
 * gives her nothing to say, and the bubble is not drawn.
 */
export function beaSaysLine(stop: Stop, next: Stop | null, leave: LeaveBy | null): string | null {
  if (next) {
    const tight = dayTightnessNote([stop, next]);
    if (tight) return tight;
  }
  const stay = stop.planned_stay_minutes ? stayLabel(stop.planned_stay_minutes) : "";
  const nextName = next?.title?.trim() ?? "";
  const nextTime = next ? timeForRail(next.time_label) : "";
  const leaveLine =
    leave?.kind === "time" && nextName
      ? `Leave by ${leave.at} to reach ${nextName}${nextTime ? ` at ${nextTime}` : ""}.`
      : "";
  if (stay && nextName) {
    return `About ${stay} planned here, then ${nextName}.${leaveLine ? ` ${leaveLine}` : ""}`;
  }
  if (leaveLine) return leaveLine;
  if (stay) return `About ${stay} planned here.`;
  if (!next && stop.title?.trim()) return `${stop.title.trim()} is the last stop of the day.`;
  return null;
}
