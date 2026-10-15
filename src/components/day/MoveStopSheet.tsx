import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { clockMinutes } from "@/lib/companion";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { stopsOfDay, timeFit, type StopMove } from "@/lib/stop-move";

type Stop = {
  id: string;
  title: string;
  day_date: string | null;
  position: number;
  time_label: string | null;
};

/**
 * "Move to…": pick a day, then where in it, and keep or change the time.
 * Nothing moves until "Move here"; the page saves it and offers Undo.
 */
export function MoveStopSheet({
  stop,
  stops,
  days,
  onMove,
  onClose,
}: {
  /** The stop being moved; null when the sheet is closed. */
  stop: Stop | null;
  stops: readonly Stop[];
  /** The trip's days in order, from `tripDays`. */
  days: readonly string[];
  onMove: (move: StopMove) => Promise<void>;
  onClose: () => void;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const others = useMemo(() => (stop ? stopsOfDay(stops, day, stop.id) : []), [stops, day, stop]);

  // Opening on a stop starts where it is now.
  useEffect(() => {
    if (!stop) return;
    setDay(stop.day_date);
    const here = stopsOfDay(stops, stop.day_date).findIndex((s) => s.id === stop.id);
    setIndex(Math.max(0, here));
    setTime(stop.time_label ?? "");
    setProblem("");
    // Only when a new stop opens, not on every reload of the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop?.id]);

  if (!stop) return null;

  /** A new day starts at the place its time fits, else at the end. */
  const pickDay = (next: string | null) => {
    setDay(next);
    if (next === stop.day_date) {
      setIndex(
        Math.max(
          0,
          stopsOfDay(stops, next).findIndex((s) => s.id === stop.id),
        ),
      );
      return;
    }
    const list = stopsOfDay(stops, next, stop.id);
    const at = clockMinutes(time || null);
    const later =
      at == null
        ? -1
        : list.findIndex((s) => {
            const m = clockMinutes(s.time_label);
            return m != null && m > at;
          });
    setIndex(later < 0 ? list.length : later);
  };

  const newTime = time || null;
  const move: StopMove = {
    id: stop.id,
    day_date: day,
    at: { index },
    ...(newTime !== stop.time_label ? { time_label: newTime } : {}),
  };
  const fit = timeFit(stops, move, clockMinutes);
  const here = stopsOfDay(stops, stop.day_date).findIndex((s) => s.id === stop.id);
  const unchanged =
    (day ?? "") === (stop.day_date ?? "") && index === here && newTime === stop.time_label;

  const dayChoices: (string | null)[] = [...days, ...(stop.day_date ? [] : [null])];
  const here0 = stop.day_date ? days.indexOf(stop.day_date) : -1;
  const nowLine = [
    stop.day_date ? `Day ${here0 + 1} · ${formatTimelineDayLabel(stop.day_date)}` : "No date",
    stop.time_label,
  ]
    .filter(Boolean)
    .join(" · ");
  const dayIndex = day ? days.indexOf(day) : -1;

  const submit = async () => {
    setBusy(true);
    setProblem("");
    try {
      await onMove(move);
      onClose();
    } catch {
      // Stays open with the choices made, so trying again is one tap.
      setProblem("Couldn't move that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      page
      title="Move stop"
      hint="Timeline"
      crumb="Back to stop details"
    >
      <div className="space-y-3">
        <p className="text-[14px]">{stop.title}</p>
        <section className="fe-summary">
          <p className="text-[14px] font-semibold">Currently on</p>
          <p className="mt-1 text-[14px]">{nowLine}</p>
        </section>

        <div>
          <label htmlFor="move-day" className="fe-label">
            Move to day
          </label>
          <select
            id="move-day"
            value={day ?? ""}
            onChange={(e) => pickDay(e.target.value || null)}
            className="fe-input"
          >
            {dayChoices.map((d, i) => (
              <option key={d ?? "none"} value={d ?? ""}>
                {d ? `Day ${i + 1} · ${formatTimelineDayLabel(d)}` : "No date"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="fe-label">Where on that day</p>
          <div className="space-y-1" role="radiogroup" aria-label="Where on that day">
            {[null, ...others].map((before, i) => {
              const label = before
                ? `After ${before.time_label ? `${before.time_label} · ` : ""}${before.title}`
                : others.length
                  ? "First of the day"
                  : "On its own";
              return (
                <label
                  key={before?.id ?? "first"}
                  className={`flex min-h-12 items-center gap-2 rounded-[var(--r-card)] border px-3 text-[14px] ${
                    index === i ? "border-primary bg-primary-soft" : "border-border bg-card"
                  }`}
                >
                  <input
                    type="radio"
                    name="move-slot"
                    checked={index === i}
                    onChange={() => setIndex(i)}
                  />
                  <span className="min-w-0 truncate">{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="move-time" className="fe-label">
            Start time
          </label>
          <div className="flex items-center gap-3">
            <input
              id="move-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="fe-input"
            />
            {time && (
              <button
                type="button"
                onClick={() => setTime("")}
                className="shrink-0 text-[14px] font-semibold underline"
              >
                No time
              </button>
            )}
          </div>
          {fit && (
            <p className="mt-2 text-[14px] text-muted-foreground">
              {fit.time} is out of order there.{" "}
              {fit.suggestion && (
                <button
                  type="button"
                  onClick={() => setTime(fit.suggestion!)}
                  className="font-semibold underline"
                >
                  Use {fit.suggestion}
                </button>
              )}
            </p>
          )}
        </div>

        <section className="fe-card">
          <h2 className="text-[18px] font-semibold leading-tight">Review this move</h2>
          <p className="mt-2 text-[14px]">
            {unchanged
              ? "Choose a different day, place or time to move this stop."
              : `Move ${stop.title} to ${
                  day ? `Day ${dayIndex + 1} (${formatTimelineDayLabel(day)})` : "no date"
                }${newTime ? ` at ${newTime}` : ""}.`}
          </p>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Other stops will not be moved automatically.
          </p>
        </section>

        {problem && (
          <p role="alert" className="text-[14px] text-destructive">
            {problem}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="fe-btn">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || unchanged}
            onClick={() => void submit()}
            className="fe-btn fe-btn-primary"
          >
            {busy ? "Moving…" : "Move stop"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
