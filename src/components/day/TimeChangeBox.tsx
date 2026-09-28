import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { findStopForChange, readTimeChange } from "@/lib/stop-edit";

type Stop = { id: string; title: string; day_date: string | null; time_label: string | null };

/**
 * "Change the time of Louvre on day 2 to 6am", typed instead of tapped
 * through. Read without a model (`stop-edit.ts`); when the words or the stop
 * are unclear it says so rather than moving the wrong one.
 */
export function TimeChangeBox({
  stops,
  days,
  onChangeTime,
  onDone,
}: {
  stops: readonly Stop[];
  /** The trip's dated days in order: "day 2" is the second. */
  days: readonly string[];
  onChangeTime: (id: string, time: string | null) => Promise<void>;
  onDone?: () => void;
}) {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem("");
    const change = readTimeChange(text);
    if (!change) {
      setProblem('Béa didn\'t follow that. Try "Change the time of Louvre on day 2 to 6am".');
      return;
    }
    const found = findStopForChange(change, stops, days);
    if ("problem" in found) {
      setProblem(
        found.problem === "no-day"
          ? `This trip has no day ${change.day}.`
          : found.problem === "ambiguous"
            ? `More than one stop is called that${
                change.day == null ? " — add the day, like “on day 2”" : ""
              }.`
            : `Béa couldn't find “${change.stop}”${change.day ? ` on day ${change.day}` : ""}.`,
      );
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

  return (
    <form onSubmit={(e) => void submit(e)}>
      <label
        htmlFor="time-change"
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        Change a time
      </label>
      <div className="flex gap-2">
        <input
          id="time-change"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Change the time of Louvre on day 2 to 6am"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-[16px]"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="min-h-11 shrink-0 rounded-xl bg-primary px-3 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Change"}
        </button>
      </div>
      {problem && <p className="mt-1.5 text-[13px] text-destructive">{problem}</p>}
    </form>
  );
}
