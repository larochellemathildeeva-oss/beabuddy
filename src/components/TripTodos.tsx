import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { useTripTodos } from "@/hooks/useTripTodos";
import { toLocalISODate } from "@/lib/trip-dates";
import {
  dueLabel,
  dueState,
  sortTodos,
  starterTodos,
  todoProgressLine,
  todosFromPaste,
  type DueState,
} from "@/lib/trip-todos";

const DUE_TONE: Record<DueState, string> = {
  overdue: "border-destructive/50 text-destructive",
  today: "border-primary/50 text-primary",
  soon: "border-border text-foreground",
  later: "border-border text-muted-foreground",
  none: "border-border text-muted-foreground",
};

/**
 * The trip's errands — the things that are not timeline stops and not packing
 * items. Renew the passport, book the transfer, tell the bank, print tickets.
 *
 * This is the body only. It lives inside the "To do" sheet next to
 * packing, because both answer the same question: what is left to do before
 * you leave. See TripPrep for the sheet itself.
 */
export function TripTodosBody({
  tripId,
  uid,
  international,
  hasLodging,
  hasFlights,
  tripStart,
}: {
  tripId: string;
  uid: string | null;
  international: boolean;
  hasLodging: boolean;
  hasFlights: boolean;
  tripStart?: string | null | undefined;
}) {
  const t = useTripTodos(tripId, uid);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState("");
  /** Which row has its actions showing. One at a time. */
  const [menuId, setMenuId] = useState("");

  const today = toLocalISODate(new Date());
  const sorted = sortTodos(t.todos);
  const visible = showDone ? sorted : sorted.filter((todo) => !todo.done);

  const add = async () => {
    const name = title.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      await t.addTodo({ title: name });
      setTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that");
    } finally {
      setBusy(false);
    }
  };

  const addPasted = async () => {
    const lines = todosFromPaste(paste);
    if (lines.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await t.addMany(lines);
      setPaste("");
      setPasting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add those");
    } finally {
      setBusy(false);
    }
  };

  const addStarters = async () => {
    setBusy(true);
    setError("");
    try {
      await t.addMany(starterTodos({ international, hasLodging, hasFlights }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add those");
    } finally {
      setBusy(false);
    }
  };

  const setDue = async (id: string, value: string) => {
    setError("");
    try {
      await t.updateTodo(id, { due_on: value });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't set that date");
    }
  };

  if (t.unavailable) {
    return (
      <p className="p-6 text-center text-[14.5px] text-muted-foreground">
        Not switched on for this database yet — the <code>trip_todos</code> migration still needs to
        be run.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12.5px] text-muted-foreground">
          {t.todos.length === 0
            ? "Passports, transfers, the things that are not packing."
            : todoProgressLine(t.todos)}
        </p>
        {t.done.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="shrink-0 rounded-full border border-border px-3 py-1 text-[12.5px] font-semibold"
          >
            {showDone ? "Hide done" : `Done (${t.done.length})`}
          </button>
        )}
      </div>

      {visible.length > 0 && (
        <ul className="divide-y divide-border/60 border-b border-border/60">
          {visible.map((todo) => {
            const state = dueState(todo.due_on, today);
            const label = dueLabel(todo.due_on, today);
            const showing = menuId === todo.id;
            return (
              <li key={todo.id} className="py-2.5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={todo.done}
                    aria-label={todo.done ? `Undo ${todo.title}` : `Mark ${todo.title} done`}
                    onChange={(e) => void t.toggleTodo(todo.id, e.target.checked)}
                    className="mt-0.5 size-5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[14.5px] ${
                        todo.done ? "text-muted-foreground line-through" : "font-medium"
                      }`}
                    >
                      {todo.title}
                    </p>
                    {todo.notes && (
                      <p className="text-[12px] text-muted-foreground">{todo.notes}</p>
                    )}
                  </div>
                  {label && !todo.done && (
                    <span
                      className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${DUE_TONE[state]}`}
                    >
                      {label}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Options for ${todo.title}`}
                    aria-expanded={showing}
                    onClick={() => setMenuId(showing ? "" : todo.id)}
                    className="-mr-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </button>
                </div>

                {showing && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                    <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      Due
                      <input
                        type="date"
                        value={todo.due_on ?? ""}
                        aria-label={`Due date for ${todo.title}`}
                        {...(tripStart ? { max: tripStart } : {})}
                        onChange={(e) => void setDue(todo.id, e.target.value)}
                        className="rounded-lg border border-border bg-card px-2 py-1 text-[12.5px] text-foreground"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId("");
                        void t.removeTodo(todo.id);
                      }}
                      className="rounded-lg border border-destructive/40 px-2.5 py-1 text-[12.5px] font-semibold text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {t.todos.length === 0 && !t.loading && (
        <p className="text-[14.5px] text-muted-foreground">
          Nothing here yet. The passport, the transfer, the thing you always remember at the
          airport.
        </p>
      )}

      <div className="flex gap-2 pt-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="Add something to do"
          aria-label="Add something to do"
          className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
        />
        <button
          type="button"
          disabled={!title.trim() || busy}
          onClick={() => void add()}
          aria-label="Add this to-do"
          className="btn-primary grid size-[42px] shrink-0 place-items-center disabled:opacity-40 disabled:shadow-none"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      {/* The other ways in stay as text, so the one primary action keeps its weight. */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
        {t.todos.length === 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void addStarters()}
            className="font-semibold text-primary disabled:opacity-50"
          >
            Start me off
          </button>
        )}
        <button
          type="button"
          onClick={() => setPasting((v) => !v)}
          className="text-muted-foreground underline"
        >
          {pasting ? "Cancel" : "Paste a list"}
        </button>
      </div>

      {pasting && (
        <div className="mt-2 space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            aria-label="Paste a list of things to do"
            placeholder={"Renew passport\nBook airport transfer\nTell the bank"}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
          />
          <button
            type="button"
            disabled={busy || todosFromPaste(paste).length === 0}
            onClick={() => void addPasted()}
            className="btn-primary px-4 py-2 text-[14.5px] disabled:opacity-40 disabled:shadow-none"
          >
            Add {todosFromPaste(paste).length || ""} to-dos
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
