import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { findStopForChange, readTimeChange } from "@/lib/stop-edit";
import { askPlanEdit } from "@/lib/plan-edit.functions";
import { PLAN_EDIT_MAX_REQUEST, PLAN_EDIT_MAX_STOPS } from "@/lib/plan-edit";
import { indexFor, stopsOfDay, type StopMove } from "@/lib/stop-move";
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

/**
 * "Change the time of Louvre on day 2 to 6am", "put the Louvre on Thursday
 * morning", "swap day 2 and day 3": a change to the plan, typed instead of
 * tapped through.
 *
 * A plain time change is read here without a model (`stop-edit.ts`) and saved
 * straight away, as before. Anything else goes to Béa (`askPlanEdit`), whose
 * moves are shown first and only saved on Apply — a wrong stop moved quietly
 * is worse than a question.
 */
export function TimeChangeBox({
  stops,
  days,
  onChangeTime,
  onApply,
  onDone,
}: {
  stops: readonly Stop[];
  /** The trip's days in order: "day 2" is the second. */
  days: readonly string[];
  onChangeTime: (id: string, time: string | null) => Promise<void>;
  /** Save Béa's moves, with its own Undo. */
  onApply: (moves: StopMove[], summary: string) => Promise<void>;
  onDone?: () => void;
}) {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<{ moves: StopMove[]; reply: string } | null>(null);
  const ask = useServerFn(askPlanEdit);

  const askBea = async () => {
    if (stops.length > PLAN_EDIT_MAX_STOPS) {
      setProblem("This trip is too long for Béa to rearrange in one go. Move stops one by one.");
      return;
    }
    const answer = await ask({
      data: {
        request: text.trim().slice(0, PLAN_EDIT_MAX_REQUEST),
        days: [...days],
        stops: stops.map((stop) => ({
          id: stop.id,
          title: stop.title.slice(0, 200),
          day_date: stop.day_date,
          time_label: stop.time_label,
          kind: stop.kind ?? null,
        })),
      },
    });
    if (answer.moves.length === 0) {
      setProblem(answer.reply || "Béa didn't find anything to move for that.");
      return;
    }
    setProposal(answer);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    setProposal(null);
    const change = readTimeChange(text);
    const found = change ? findStopForChange(change, stops, days) : null;
    if (!change || !found || "problem" in found) {
      // Not a plain time change Béa can be sure of here: ask the model.
      setBusy(true);
      try {
        await askBea();
      } catch (err) {
        setProblem(readableError(err) ?? "Béa couldn't answer just now. Try again in a moment.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const { stop } = found;
    const before = stop.time_label;
    setBusy(true);
    try {
      await onChangeTime(stop.id, change.time);
      setText("");
      onDone?.();
      toast.success(`${stop.title} now at ${change.time}`, {
        description: "Other stops keep their times — Optimize can re-plan the rest of the day.",
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () =>
            void onChangeTime(stop.id, before).catch(() =>
              toast.error("Couldn't undo that. Check your connection."),
            ),
        },
      });
    } catch {
      setProblem("Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      await onApply(proposal.moves, proposal.reply);
      setProposal(null);
      setText("");
      onDone?.();
    } catch {
      setProblem("Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const dayName = (day: string | null) => {
    if (!day) return "No date";
    const index = days.indexOf(day);
    return index < 0 ? formatTimelineDayLabel(day) : `Day ${index + 1}`;
  };
  /** "Day 3, after Orsay, 16:00" — where a move puts its stop. */
  const describe = (move: StopMove) => {
    const stop = stops.find((s) => s.id === move.id);
    const list = stopsOfDay(stops, move.day_date, move.id);
    const index = indexFor(list, move.at);
    const where =
      index === 0 ? "first" : index >= list.length ? "last" : `after ${list[index - 1]!.title}`;
    const time = move.time_label !== undefined ? move.time_label : stop?.time_label;
    return `${dayName(move.day_date)}, ${where}${time ? `, ${time}` : ""}`;
  };

  return (
    <form onSubmit={(e) => void submit(e)}>
      <label
        htmlFor="time-change"
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        Ask Béa to change the plan
      </label>
      <div className="flex gap-2">
        <input
          id="time-change"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Put the Louvre on day 3 morning"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-[16px]"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="min-h-11 shrink-0 rounded-xl bg-primary px-3 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Ask"}
        </button>
      </div>
      {problem && <p className="mt-1.5 text-[13px] text-destructive">{problem}</p>}
      {proposal && (
        <div className="mt-2 rounded-xl border border-primary/30 bg-primary-soft p-2.5">
          {proposal.reply && <p className="text-[13.5px] text-foreground">{proposal.reply}</p>}
          <ul className="mt-1.5 space-y-1 text-[13px]">
            {proposal.moves.map((move) => {
              const stop = stops.find((s) => s.id === move.id);
              return (
                <li key={move.id}>
                  <span className="font-semibold">{stop?.title ?? "A stop"}</span>
                  <span className="text-muted-foreground"> → {describe(move)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply()}
              className="min-h-10 rounded-xl bg-primary px-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="min-h-10 rounded-xl border border-border bg-card px-3 text-[14px] font-semibold text-muted-foreground"
            >
              Not this
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
