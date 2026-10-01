import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet } from "@/components/Sheet";
import { ArrowRight, Check, Lock, RotateCcw } from "@/components/icons";
import { askDayEdit } from "@/lib/day-edit.functions";
import {
  DAY_EDIT_MAX_ASK,
  dayEditChanges,
  dayEditMoves,
  dayEditRows,
  joinAsks,
  type DayEditPlan,
} from "@/lib/day-edit";
import { stopsOfDay, type StopMove } from "@/lib/stop-move";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { readableError } from "@/lib/optimistic";

type Stop = {
  id: string;
  title: string;
  day_date: string | null;
  time_label: string | null;
  position: number;
  kind?: string | null;
};

/** One-tap starting points for the ask; the box stays editable. */
const IDEAS = [
  "Slower start to the morning",
  "Less walking between stops",
  "Lunch around 12:30",
  "Finish by 6pm",
  "Put the busiest places first",
];

/** The day as Béa read it, to tell whether it changed before Apply. */
const dayKey = (stops: readonly Stop[]) =>
  stops.map((s) => `${s.id}|${s.time_label ?? ""}|${s.position}`).join("\n");

/**
 * "Change a day": pick the day, tick the stops Béa may touch (all by
 * default), say what you'd like, then see the day as it is beside Béa's
 * version. Nothing is saved until "Use Béa's version"; "Change something"
 * asks again with the new words added to the first.
 */
export function DayEditSheet({
  open,
  onClose,
  tripId,
  stops,
  days,
  initialDay,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  stops: readonly Stop[];
  /** The trip's days in order, from `tripDays`. */
  days: readonly string[];
  /** The day to open on, when the sheet was opened from one. */
  initialDay?: string | null | undefined;
  /** Save Béa's moves, with its own Undo. */
  onApply: (moves: StopMove[], summary: string) => Promise<void>;
}) {
  const ask = useServerFn(askDayEdit);
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  /** What has been asked so far: the first ask, then each "Change something". */
  const [asks, setAsks] = useState<string[]>([]);
  const [refining, setRefining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [proposal, setProposal] = useState<{ plan: DayEditPlan; basis: string } | null>(null);

  const dayStops = useMemo(() => (day ? stopsOfDay(stops, day) : []), [stops, day]);
  const filled = days.filter((d) => stops.some((s) => s.day_date === d));

  const chooseDay = (next: string | null) => {
    setDay(next);
    setPicked(new Set(next ? stopsOfDay(stops, next).map((s) => s.id) : []));
    setProposal(null);
    setAsks([]);
    setRefining(false);
    setProblem("");
  };

  // Opening starts on the day it was opened from, else the first with stops.
  useEffect(() => {
    if (!open) return;
    const start =
      initialDay && filled.includes(initialDay)
        ? initialDay
        : filled.length === 1
          ? filled[0]!
          : null;
    chooseDay(start);
    setText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on opening only
  }, [open, initialDay]);

  const dayName = (d: string | null) => {
    if (!d) return "No date";
    const index = days.indexOf(d);
    return index < 0 ? formatTimelineDayLabel(d) : `Day ${index + 1}`;
  };

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allPicked = dayStops.length > 0 && dayStops.every((s) => picked.has(s.id));

  const run = async (nextAsks: string[]) => {
    if (!day) return;
    const stopIds = dayStops.filter((s) => picked.has(s.id)).map((s) => s.id);
    if (stopIds.length === 0) {
      setProblem("Tick at least one stop Béa may change.");
      return;
    }
    setBusy(true);
    setProblem("");
    const basis = dayKey(dayStops);
    try {
      // The server reads the day itself; only which day, which stops and the words go.
      const plan = await ask({ data: { tripId, day, stopIds, request: joinAsks(nextAsks) } });
      if (!dayEditChanges(plan, dayStops)) {
        setProblem(plan.reply || "Béa didn't find anything to change for that.");
        return;
      }
      setAsks(nextAsks);
      setProposal({ plan, basis });
      setRefining(false);
      setText("");
    } catch (err) {
      setProblem(readableError(err) ?? "Béa couldn't answer just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!proposal || !day) return;
    // Someone changed the day since Béa read it: ask again rather than apply
    // her version of the old day to the new.
    if (dayKey(dayStops) !== proposal.basis) {
      setProposal(null);
      setProblem("This day changed since Béa suggested this. Ask again.");
      return;
    }
    setBusy(true);
    try {
      await onApply(
        dayEditMoves(proposal.plan, dayStops, day),
        proposal.plan.reply || `${dayName(day)} changed`,
      );
      onClose();
    } catch {
      setProblem("Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground"
    }`;

  const askBox = (label: string, placeholder: string, onSend: () => void, send: string) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <label
        htmlFor="day-edit-ask"
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        {label}
      </label>
      <textarea
        id="day-edit-ask"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={DAY_EDIT_MAX_ASK}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-[16px]"
      />
      <button
        type="submit"
        disabled={busy || !text.trim() || picked.size === 0}
        className="mt-2 min-h-11 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Béa is reworking the day…" : send}
      </button>
    </form>
  );

  const rows = proposal ? dayEditRows(proposal.plan, dayStops) : [];
  const awayStops = proposal
    ? proposal.plan.away.flatMap((row) => {
        const stop = dayStops.find((s) => s.id === row.id);
        return stop ? [{ stop, to: row.day_date }] : [];
      })
    : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={proposal ? `${dayName(day)}: before and after` : "Change a day"}
      hint={
        proposal
          ? "Nothing is saved until you use Béa's version"
          : "Pick a day, the stops, and what you'd like"
      }
      {...(proposal ? { onBack: () => setProposal(null) } : {})}
      width="lg"
      tall
    >
      {!proposal ? (
        <div className="space-y-4">
          <div>
            <p className="label-caps mb-1.5">1 · Which day?</p>
            {filled.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">
                No day has stops yet. Add a few, then come back.
              </p>
            ) : (
              <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
                {days.map((d, i) => {
                  const count = stops.filter((s) => s.day_date === d).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={d === day}
                      onClick={() => chooseDay(d)}
                      className={chip(d === day)}
                    >
                      Day {i + 1} · {formatTimelineDayLabel(d)} · {count}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {day && dayStops.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="label-caps">2 · Which stops may change?</p>
                <button
                  type="button"
                  onClick={() =>
                    setPicked(allPicked ? new Set() : new Set(dayStops.map((s) => s.id)))
                  }
                  className="text-[13px] font-semibold text-primary underline underline-offset-2"
                >
                  {allPicked ? "Clear" : "Select all"}
                </button>
              </div>
              <ul className="space-y-1">
                {dayStops.map((stop) => (
                  <li key={stop.id}>
                    <label
                      className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-[14px] ${
                        picked.has(stop.id)
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-card"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={picked.has(stop.id)}
                        onChange={() => toggle(stop.id)}
                        className="size-4 accent-[var(--primary)]"
                      />
                      <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                        {stop.time_label ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{stop.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Unticked stops keep their time and stay on this day.
              </p>
            </div>
          )}

          {day && dayStops.length > 0 && (
            <div className="space-y-2">
              <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setText((cur) => (cur.trim() ? `${cur.trim()}. ${idea}` : idea))}
                    className="min-h-8 shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-3 text-[12.5px]"
                  >
                    {idea}
                  </button>
                ))}
              </div>
              {askBox(
                "3 · What would you like to change?",
                "e.g. start later, move the museum after lunch, take Orsay off this day",
                () => void run([text]),
                "Show me Béa's version",
              )}
            </div>
          )}
          {problem && <p className="text-[13px] text-destructive">{problem}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {proposal.plan.reply && (
            <p className="rounded-xl bg-primary-soft px-3 py-2 text-[13.5px] text-foreground">
              {proposal.plan.reply}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <section aria-label="Now" className="min-w-0">
              <p className="label-caps mb-1.5">Now</p>
              <ol className="space-y-1">
                {dayStops.map((stop) => {
                  const leaving = awayStops.some((a) => a.stop.id === stop.id);
                  return (
                    <li
                      key={stop.id}
                      className={`rounded-lg border border-border/70 bg-card px-2 py-1.5 ${
                        leaving ? "opacity-60" : ""
                      }`}
                    >
                      <p className="text-[11.5px] tabular-nums text-muted-foreground">
                        {stop.time_label ?? "No time"}
                      </p>
                      <p
                        className={`break-words text-[13.5px] font-medium ${leaving ? "line-through" : ""}`}
                      >
                        {stop.title}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
            <section aria-label="Béa's version" className="min-w-0">
              <p className="label-caps mb-1.5 text-primary">Béa&apos;s version</p>
              <ol className="space-y-1">
                {rows.map((row) => {
                  const changed = row.moved || row.retimed;
                  return (
                    <li
                      key={row.stop.id}
                      className={`rounded-lg border px-2 py-1.5 ${
                        changed ? "border-primary/40 bg-primary-soft" : "border-border/70 bg-card"
                      }`}
                    >
                      <p className="flex items-center gap-1 text-[11.5px] tabular-nums text-muted-foreground">
                        <span className={row.retimed ? "font-semibold text-primary" : ""}>
                          {row.time_label ?? "No time"}
                        </span>
                        {!picked.has(row.stop.id) && <Lock className="size-3" aria-label="Kept" />}
                      </p>
                      <p className="break-words text-[13.5px] font-medium">{row.stop.title}</p>
                      {changed && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                          {[row.moved && "Moved", row.retimed && "New time"]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
              {awayStops.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {awayStops.map(({ stop, to }) => (
                    <li
                      key={stop.id}
                      className="rounded-lg border border-dashed border-border px-2 py-1.5 text-[12.5px]"
                    >
                      <span className="font-medium">{stop.title}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        <ArrowRight className="inline size-3" aria-hidden />{" "}
                        {to ? dayName(to) : "Off the plan (No date)"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {problem && <p className="text-[13px] text-destructive">{problem}</p>}

          {refining ? (
            askBox(
              "What should Béa change?",
              "e.g. keep the Louvre first, but lunch later",
              () => void run([...asks, text]),
              "Ask again",
            )
          ) : (
            <div className="grid gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Check className="size-4" aria-hidden />
                {busy ? "Saving…" : "Use Béa's version"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setText("");
                    setProblem("");
                    setRefining(true);
                  }}
                  className="min-h-11 rounded-xl border border-border bg-card text-[14px] font-semibold"
                >
                  Change something
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setProposal(null);
                    setAsks([]);
                    setProblem("");
                  }}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[14px] font-semibold text-muted-foreground"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Start over
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
