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

  const others = useMemo(() => (stop ? stopsOfDay(stops, day, stop.id) : []), [stops, day, stop]);

  // Opening on a stop starts where it is now.
  useEffect(() => {
    if (!stop) return;
    setDay(stop.day_date);
    const here = stopsOfDay(stops, stop.day_date).findIndex((s) => s.id === stop.id);
    setIndex(Math.max(0, here));
    setTime(stop.time_label ?? "");
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
  const chip = (active: boolean) =>
    `min-h-9 rounded-full border px-3 text-[13px] font-semibold ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground"
    }`;

  const submit = async () => {
    setBusy(true);
    try {
      await onMove(move);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`Move ${stop.title}`} hint="Pick a day, then where in it">
      <div className="space-y-4">
        <div>
          <p className="label-caps mb-1.5">Day</p>
          <div className="flex flex-wrap gap-1.5">
            {dayChoices.map((d, i) => (
              <button
                key={d ?? "none"}
                type="button"
                aria-pressed={(d ?? "") === (day ?? "")}
                onClick={() => pickDay(d)}
                className={chip((d ?? "") === (day ?? ""))}
              >
                {d ? `Day ${i + 1} · ${formatTimelineDayLabel(d)}` : "No date"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="label-caps mb-1.5">Where on that day</p>
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
                  className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[14px] ${
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
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            Time
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-lg border border-border bg-card px-2 py-1 text-[14px] text-foreground"
            />
            {time && (
              <button
                type="button"
                onClick={() => setTime("")}
                className="text-[12.5px] font-semibold text-primary underline"
              >
                No time
              </button>
            )}
          </label>
          {fit && (
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {fit.time} is out of order there.{" "}
              {fit.suggestion && (
                <button
                  type="button"
                  onClick={() => setTime(fit.suggestion!)}
                  className="font-semibold text-primary underline"
                >
                  Use {fit.suggestion}
                </button>
              )}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={busy || unchanged}
          onClick={() => void submit()}
          className="min-h-11 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Moving…" : "Move here"}
        </button>
      </div>
    </Sheet>
  );
}
