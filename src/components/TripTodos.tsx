import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
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
 */
export function TripTodos({
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
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState("");

  const today = toLocalISODate(new Date());
  const sorted = sortTodos(t.todos);
  const visible = showDone ? sorted : sorted.filter((todo) => !todo.done);

  const add = async () => {
    const name = title.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      await t.addTodo({ title: name, ...(due ? { due_on: due } : {}) });
      setTitle("");
      // The due date usually repeats down a list ("all before we fly"), so it stays.
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

  if (t.unavailable) {
    return (
      <div className="mb-3 rounded-2xl bg-elevated p-3.5">
        <p className="label-caps text-foreground">Things to do</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Not switched on for this database yet — the <code>trip_todos</code> migration still needs
          to be run.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-2xl bg-elevated p-3.5">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${
              open ? "" : "-rotate-90"
            }`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="label-caps text-foreground">Things to do</p>
            <p className="text-[12.5px] text-muted-foreground">{todoProgressLine(t.todos)}</p>
          </div>
        </button>
        {t.done.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="shrink-0 rounded-xl border border-border px-3 py-2 text-[13.5px] font-semibold"
          >
            {showDone ? "Hide done" : `Done (${t.done.length})`}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {visible.length > 0 && (
            <ul className="space-y-1.5">
              {visible.map((todo) => {
                const state = dueState(todo.due_on, today);
                const label = dueLabel(todo.due_on, today);
                return (
                  <li
                    key={todo.id}
                    className="flex items-start gap-2.5 rounded-xl bg-elevated px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={todo.done}
                      aria-label={todo.done ? `Undo ${todo.title}` : `Mark ${todo.title} done`}
                      onChange={(e) => void t.toggleTodo(todo.id, e.target.checked)}
                      className="mt-0.5 size-5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[15px] ${
                          todo.done ? "text-muted-foreground line-through" : "font-medium"
                        }`}
                      >
                        {todo.title}
                      </p>
                      {todo.notes && (
                        <p className="text-[12.5px] text-muted-foreground">{todo.notes}</p>
                      )}
                    </div>
                    {label && !todo.done && (
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${DUE_TONE[state]}`}
                      >
                        {label}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void t.removeTodo(todo.id)}
                      className="shrink-0 text-[12.5px] text-muted-foreground underline"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {t.todos.length === 0 && !t.loading && (
            <div className="rounded-2xl bg-elevated p-3.5">
              <p className="text-[15px]">
                Nothing here yet. The passport, the transfer, the thing you always remember at the
                airport.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void addStarters()}
                className="mt-2 rounded-xl border border-border px-3 py-2 text-[13.5px] font-semibold disabled:opacity-50"
              >
                Start me off
              </button>
            </div>
          )}

          <div className="flex gap-2">
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
              className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[15px]"
            />
            <input
              type="date"
              value={due}
              aria-label="Due date"
              {...(tripStart ? { max: tripStart } : {})}
              onChange={(e) => setDue(e.target.value)}
              className="w-[8.5rem] shrink-0 rounded-xl border border-border bg-card px-2 py-2 text-[13.5px]"
            />
          </div>
          {tripStart && (
            <p className="px-1 text-[12.5px] text-muted-foreground">
              Due dates are for before you go — most of these want doing ahead of time.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!title.trim() || busy}
              onClick={() => void add()}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setPasting((v) => !v)}
              className="rounded-xl border border-border px-3 py-2.5 text-[13.5px] font-semibold"
            >
              <ListChecks className="mr-1 inline size-3.5" aria-hidden />
              {pasting ? "Cancel" : "Paste a list"}
            </button>
          </div>

          {pasting && (
            <div className="space-y-2 rounded-2xl bg-elevated p-3.5">
              <p className="text-[13.5px] text-muted-foreground">
                One per line. Bullets and numbers get trimmed off.
              </p>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={4}
                aria-label="Paste a list of things to do"
                placeholder={"Renew passport\nBook airport transfer\nTell the bank"}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[15px]"
              />
              <button
                type="button"
                disabled={busy || todosFromPaste(paste).length === 0}
                onClick={() => void addPasted()}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                Add {todosFromPaste(paste).length || ""} to-dos
              </button>
            </div>
          )}

          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
