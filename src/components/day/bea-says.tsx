import { useMemo } from "react";
import { dayTightnessNote, type PacedItem } from "@/lib/day-shape";
import { stopAside, type StopMood } from "@/lib/bea-personality";
import { beaRecent, rememberBeaLine, useBeaSettings } from "@/hooks/useBeaSettings";
import type { LeaveBy } from "@/lib/companion";
import { stayLabel } from "@/lib/planned-stay";
import { timeForRail, timelineGlyph } from "@/lib/timeline-kind";

type Stop = PacedItem & { planned_stay_minutes?: number | null };

/**
 * What Béa says about a stop, in her bubble on Companion and the map.
 *
 * The facts part: only what the plan already carries, in the third person
 * (her personality is added on top by `useBeaSays`): the stay planned here, the next stop and when to leave for it — or,
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

/**
 * Béa's line with her personality on top: the plain facts, then — for a
 * playful mix with "Béa says" on — a short aside about the kind of stop.
 * The aside is picked once per stop, so it does not change on every render.
 */
export function useBeaSays(stop: Stop | null, next: Stop | null, leave: LeaveBy | null) {
  const settings = useBeaSettings();
  const id = (stop as { id?: string } | null)?.id ?? "";
  const aside = useMemo(() => {
    if (!stop) return null;
    const glyph = timelineGlyph(stop as { kind?: string | null; title?: string | null });
    const mood: StopMood = glyph === "note" ? "activity" : glyph;
    const hour = Number.parseInt(timeForRail(stop.time_label).slice(0, 2), 10);
    const line = stopAside({
      mood,
      hour: Number.isFinite(hour) ? hour : null,
      settings,
      recent: beaRecent(),
    });
    rememberBeaLine(line);
    return line;
    // One pick per stop and per change of mix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, settings]);
  const facts = stop ? beaSaysLine(stop, next, leave) : null;
  if (!facts) return aside;
  return aside ? `${facts} ${aside}` : facts;
}
