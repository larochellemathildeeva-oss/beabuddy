import { useState, type ComponentType } from "react";
import {
  BedDouble,
  CalendarDays,
  Car,
  ChevronDown,
  CircleDashed,
  ClipboardList,
  House,
  Lightbulb,
  ListChecks,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  Plane,
  PlaneTakeoff,
  Plus,
  ShieldCheck,
  Smartphone,
  Stamp,
  Syringe,
  Ticket,
  Wallet,
  type LucideProps,
} from "@/components/icons";
import { useTripTodos } from "@/hooks/useTripTodos";
import { toLocalISODate } from "@/lib/trip-dates";
import { tripDateLine } from "@/lib/trip-card";
import {
  dueLabel,
  dueState,
  sortTodos,
  starterTodos,
  todoIcon,
  todoPhase,
  todoProgressLine,
  todosFromPaste,
  type DueState,
  type TodoIcon,
  type TodoPhase,
} from "@/lib/trip-todos";

const DUE_TONE: Record<DueState, string> = {
  overdue: "font-semibold text-destructive",
  today: "font-semibold text-primary",
  soon: "text-foreground",
  later: "text-muted-foreground",
  none: "text-muted-foreground",
};

const ICONS: Record<TodoIcon, ComponentType<LucideProps>> = {
  passport: Stamp,
  visa: Stamp,
  money: Wallet,
  transfer: Car,
  stay: BedDouble,
  flight: Plane,
  insurance: ShieldCheck,
  map: MapIcon,
  health: Syringe,
  ticket: Ticket,
  phone: Smartphone,
  todo: ListChecks,
};

const PHASES: { id: TodoPhase; title: string; chip: string; icon: ComponentType<LucideProps> }[] = [
  { id: "before", title: "Before the trip", chip: "Before", icon: PlaneTakeoff },
  { id: "during", title: "During the trip", chip: "During", icon: MapPin },
  { id: "after", title: "After the trip", chip: "After", icon: House },
  { id: "anytime", title: "Anytime", chip: "Anytime", icon: CircleDashed },
];

/** "Due before Oct 1", "Oct 1 – 3", "After Oct 3", "No date yet". */
function phaseLine(phase: TodoPhase, start?: string | null, end?: string | null): string {
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const from = start || end;
  const to = end || start;
  if (phase === "anytime") return "No date yet";
  if (!from || !to) return phase === "before" ? "Has a date" : "";
  if (phase === "before") return `Due before ${day(from)}`;
  if (phase === "after") return `After ${day(to)}`;
  return tripDateLine(from, to);
}

/**
 * The trip's errands — the things that are not timeline stops and not packing
 * items. Renew the passport, book the transfer, tell the bank, print tickets.
 *
 * Grouped by when they belong: before the trip, during it, after it, or
 * anytime — worked out from each one's due date and the trip's dates, so
 * nothing extra is stored.
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
  tripEnd,
}: {
  tripId: string;
  uid: string | null;
  international: boolean;
  hasLodging: boolean;
  hasFlights: boolean;
  tripStart?: string | null | undefined;
  tripEnd?: string | null | undefined;
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
  /** One group only, from the chips; null shows them all. */
  const [only, setOnly] = useState<TodoPhase | null>(null);
  /** Groups folded shut by hand. */
  const [folded, setFolded] = useState<Set<TodoPhase>>(new Set());

  const today = toLocalISODate(new Date());
  const sorted = sortTodos(t.todos);
  const visible = showDone ? sorted : sorted.filter((todo) => !todo.done);
  const phaseOf = (due: string | null) => todoPhase(due, tripStart, tripEnd);
  const groups = PHASES.map((phase) => ({
    ...phase,
    todos: visible.filter((todo) => phaseOf(todo.due_on) === phase.id),
  })).filter((group) => group.todos.length > 0);
  const shown = only ? groups.filter((group) => group.id === only) : groups;

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[13px] text-muted-foreground">
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

      {groups.length > 1 && (
        <div
          role="group"
          aria-label="When"
          className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 text-[13px] font-semibold"
        >
          {[
            { id: null, chip: "All", count: visible.length },
            ...groups.map((g) => ({ id: g.id, chip: g.chip, count: g.todos.length })),
          ].map((chip) => (
            <button
              key={chip.id ?? "all"}
              type="button"
              aria-pressed={only === chip.id}
              onClick={() => setOnly(chip.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 ${
                only === chip.id
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {chip.chip} · {chip.count}
            </button>
          ))}
        </div>
      )}

      {shown.map((group, g) => {
        const Icon = group.icon;
        const open = !folded.has(group.id);
        return (
          <section key={group.id} className={`tile-card-${(g % 5) + 1} px-3.5 py-3`}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() =>
                setFolded((f) => {
                  const next = new Set(f);
                  if (!next.delete(group.id)) next.add(group.id);
                  return next;
                })
              }
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated">
                <Icon className="size-[18px] text-primary" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-display text-[21px]">{group.title}</span>
                <span className="text-[12.5px] text-muted-foreground">
                  {phaseLine(group.id, tripStart, tripEnd)}
                </span>
              </span>
              <span className="shrink-0 text-[13px] text-muted-foreground">
                {group.todos.length} {group.todos.length === 1 ? "item" : "items"}
              </span>
              <ChevronDown
                className={`size-[18px] shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            {open && (
              <ul className="mt-1 divide-y divide-border/60">
                {group.todos.map((todo) => {
                  const state = dueState(todo.due_on, today);
                  const label = dueLabel(todo.due_on, today);
                  const showing = menuId === todo.id;
                  const TodoMark = ICONS[todoIcon(todo.title)];
                  return (
                    <li key={todo.id} className="py-2.5">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={todo.done}
                          aria-label={todo.done ? `Undo ${todo.title}` : `Mark ${todo.title} done`}
                          onChange={(e) => void t.toggleTodo(todo.id, e.target.checked)}
                          className="size-5 shrink-0 accent-primary"
                        />
                        <span
                          aria-hidden
                          className="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated"
                        >
                          <TodoMark className="size-[18px] text-primary" />
                        </span>
                        <div className="min-w-0 flex-1 leading-tight">
                          <p
                            className={`text-[15px] ${
                              todo.done ? "text-muted-foreground line-through" : "font-semibold"
                            }`}
                          >
                            {todo.title}
                          </p>
                          {todo.notes && (
                            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                              {todo.notes}
                            </p>
                          )}
                          {label && !todo.done && (
                            <p
                              className={`mt-0.5 flex items-center gap-1 text-[12.5px] ${DUE_TONE[state]}`}
                            >
                              <CalendarDays className="size-3" aria-hidden />
                              {label}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Options for ${todo.title}`}
                          aria-expanded={showing}
                          onClick={() => setMenuId(showing ? "" : todo.id)}
                          className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground"
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </button>
                      </div>

                      {showing && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 pl-[5.5rem]">
                          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            Due
                            <input
                              type="date"
                              value={todo.due_on ?? ""}
                              aria-label={`Due date for ${todo.title}`}
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
          </section>
        );
      })}

      {t.todos.length === 0 && !t.loading && (
        <p className="px-1 text-[14.5px] text-muted-foreground">
          Nothing here yet. The passport, the transfer, the thing you always remember at the
          airport.
        </p>
      )}

      {pasting && (
        <div className="space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            aria-label="Paste a list of things to do"
            placeholder={"Renew passport\nBook airport transfer\nTell the bank"}
            className="w-full rounded-2xl border border-border bg-card px-3 py-2 text-[14.5px]"
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

      {error && <p className="px-1 text-[12px] text-destructive">{error}</p>}

      {/* The ways in, on one bar at the foot, as in the list itself. */}
      <div className="sticky bottom-0 -mx-1 flex items-center gap-2 border-t border-border bg-background px-1 pb-1 pt-3">
        {t.todos.length === 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void addStarters()}
            className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary disabled:opacity-50"
          >
            <Lightbulb className="size-4" aria-hidden />
            Start me off
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-border bg-card pl-3.5 pr-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            placeholder="Add a to-do"
            aria-label="Add something to do"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[14.5px] outline-none"
          />
          <button
            type="button"
            disabled={!title.trim() || busy}
            onClick={() => void add()}
            aria-label="Add this to-do"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setPasting((v) => !v)}
          className="flex shrink-0 items-center gap-1 text-[13px] font-semibold"
        >
          <ClipboardList className="size-4" aria-hidden />
          {pasting ? "Cancel" : "Paste"}
        </button>
      </div>
    </div>
  );
}
