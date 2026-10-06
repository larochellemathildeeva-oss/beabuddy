import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { findStopForChange, readTimeChange } from "@/lib/stop-edit";
import { askPlanEdit } from "@/lib/plan-edit.functions";
import { PLAN_EDIT_MAX_EARLIER, PLAN_EDIT_MAX_REQUEST } from "@/lib/plan-edit";
import { rearrange, stopsOfDay, type StopMove } from "@/lib/stop-move";
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
 *
 * Asking again before Apply adds to what is shown ("and the market too"):
 * the moves not yet saved go back with the new words, Béa reads the plan with
 * them in place, and the answer holds both, so nothing asked earlier is lost.
 */
/** The plan as Béa read it, to tell whether it changed before Apply. */
const planKey = (stops: readonly Stop[]) =>
  stops.map((s) => `${s.id}|${s.day_date ?? ""}|${s.time_label ?? ""}|${s.position}`).join("\n");

export function TimeChangeBox({
  tripId,
  stops,
  days,
  onChangeTime,
  onApply,
  onDone,
}: {
  tripId: string;
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
  const [proposal, setProposal] = useState<{
    moves: StopMove[];
    reply: string;
    /** `planKey` of the stops Béa was asked about. */
    basis: string;
    /** What the traveller asked for so far, oldest first. */
    requests: string[];
  } | null>(null);
  const ask = useServerFn(askPlanEdit);

  const askBea = async (earlier: typeof proposal) => {
    // The server reads the trip itself; only which trip, the words and the
    // moves still waiting for Apply go.
    const basis = earlier?.basis ?? planKey(stops);
    const request = text.trim().slice(0, PLAN_EDIT_MAX_REQUEST);
    const answer = await ask({
      data: {
        tripId,
        request,
        ...(earlier
          ? {
              pending: {
                requests: earlier.requests.slice(-PLAN_EDIT_MAX_EARLIER),
                moves: earlier.moves,
              },
            }
          : {}),
      },
    });
    if (answer.moves.length === 0) {
      // What was already shown stays, ready to apply.
      setProblem(answer.reply || "Béa didn't find anything to move for that.");
      return;
    }
    setProposal({ ...answer, basis, requests: [...(earlier?.requests ?? []), request] });
    setText("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    // Moves shown but not applied are added to, unless the plan changed
    // under them: then they were worked out on the old one, so start over.
    const earlier = proposal && planKey(stops) === proposal.basis ? proposal : null;
    if (!earlier) setProposal(null);
    const change = earlier ? null : readTimeChange(text);
    const found = change ? findStopForChange(change, stops, days) : null;
    if (!change || !found || "problem" in found) {
      // Not a plain time change Béa can be sure of here: ask the model.
      setBusy(true);
      try {
        await askBea(earlier);
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
    // Someone changed the plan since Béa read it: her moves were worked out
    // on the old one, so ask again rather than apply them to the new.
    if (planKey(stops) !== proposal.basis) {
      setProposal(null);
      setProblem("The plan changed since Béa suggested this. Ask again.");
      return;
    }
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
  /**
   * "Day 3, after Orsay, 16:00": where each stop ends up once every move is
   * applied in order, the same way Apply saves them.
   */
  const landed = (() => {
    if (!proposal) return null;
    const updates = rearrange(stops, proposal.moves);
    return stops.map((stop) => ({ ...stop, ...updates.find((u) => u.id === stop.id) }));
  })();
  const describe = (move: StopMove) => {
    const stop = landed?.find((s) => s.id === move.id);
    if (!landed || !stop) return "";
    const list = stopsOfDay(landed, stop.day_date);
    const index = list.findIndex((s) => s.id === move.id);
    const where =
      index === 0
        ? "first"
        : index === list.length - 1
          ? "last"
          : `after ${list[index - 1]!.title}`;
    return `${dayName(stop.day_date)}, ${where}${stop.time_label ? `, ${stop.time_label}` : ""}`;
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
          placeholder={
            proposal ? "Anything else? Béa adds it to these" : "Put the Louvre on day 3 morning"
          }
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
              // While Béa answers a follow-up her answer would bring it back.
              disabled={busy}
              onClick={() => {
                setProposal(null);
                setProblem("");
              }}
              className="min-h-10 rounded-xl border border-border bg-card px-3 text-[14px] font-semibold text-muted-foreground disabled:opacity-50"
            >
              Not this
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
