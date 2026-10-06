import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  BedDouble,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  FileText,
  House,
  Lightbulb,
  ListChecks,
  Map as MapIcon,
  MapPin,
  Plane,
  PlaneTakeoff,
  Plus,
  ShieldCheck,
  Smartphone,
  Stamp,
  Syringe,
  Ticket,
  Trash2,
  Wallet,
  type LucideProps,
} from "@/components/icons";
import type { PrepMenuItem } from "@/components/TripPrep";
import { prepTint } from "@/components/prep-tint";
import { useTripTodos, type TodoRow } from "@/hooks/useTripTodos";
import { toLocalISODate } from "@/lib/trip-dates";
import type { PrepFact, PrepFactId } from "@/lib/trip-prep";
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

const FACT_ICONS: Record<PrepFactId, ComponentType<LucideProps>> = {
  days: CalendarDays,
  stops: MapPin,
  flights: Plane,
  stay: BedDouble,
};

const PHASES: { id: TodoPhase; title: string; icon: ComponentType<LucideProps> }[] = [
  { id: "before", title: "Before you go", icon: PlaneTakeoff },
  { id: "during", title: "During the trip", icon: MapPin },
  { id: "after", title: "After the trip", icon: House },
  { id: "anytime", title: "Anytime", icon: CircleDashed },
];

const count = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

/**
 * The trip's errands — the things that are not timeline stops and not packing
 * items. Renew the passport, book the transfer, tell the bank, print tickets.
 *
 * Laid out as the master's "To do" page: the trip's facts in one strip, chips
 * for when, then one card per group — before the trip, during it, after it,
 * or anytime — worked out from each one's due date and the trip's dates, so
 * nothing extra is stored. Adding and pasting sit on a bar at the foot.
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
  facts = [],
  onMenu,
}: {
  tripId: string;
  uid: string | null;
  international: boolean;
  hasLodging: boolean;
  hasFlights: boolean;
  tripStart?: string | null | undefined;
  tripEnd?: string | null | undefined;
  /** The trip's facts for the strip at the top; empty hides it. */
  facts?: PrepFact[];
  /** Lines this view adds to the sheet's ⋯ menu. */
  onMenu?: ((items: PrepMenuItem[]) => void) | undefined;
}) {
  const t = useTripTodos(tripId, uid);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState("");
  /** Which row is open for editing. One at a time. */
  const [menuId, setMenuId] = useState("");
  /** One group only, from the chips; null shows them all. */
  const [only, setOnly] = useState<TodoPhase | null>(null);
  /** Groups folded shut by hand. */
  const [folded, setFolded] = useState<Set<TodoPhase>>(new Set());
  const addRef = useRef<HTMLInputElement>(null);

  const today = toLocalISODate(new Date());
  const sorted = sortTodos(t.todos);
  const visible = showDone ? sorted : sorted.filter((todo) => !todo.done);
  const phaseOf = (due: string | null) => todoPhase(due, tripStart, tripEnd);
  const groups = PHASES.map((phase) => ({
    ...phase,
    todos: visible.filter((todo) => phaseOf(todo.due_on) === phase.id),
  })).filter((group) => group.todos.length > 0);
  const shown = only ? groups.filter((group) => group.id === only) : groups;

  // A chip whose group has emptied (all ticked off) lets go of the filter.
  useEffect(() => {
    if (only && !groups.some((g) => g.id === only)) setOnly(null);
  }, [only, groups]);

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

  const update = async (
    id: string,
    patch: Partial<Pick<TodoRow, "title" | "notes" | "due_on">>,
    failed: string,
  ) => {
    setError("");
    try {
      await t.updateTodo(id, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : failed);
    }
  };

  // The ⋯ menu's lines for this view. Handlers go through a ref so the list
  // is only handed up when what it says changes.
  const starters = useRef(addStarters);
  starters.current = addStarters;
  const empty = t.todos.length === 0;
  useEffect(() => {
    if (!onMenu) return;
    onMenu([
      {
        id: "add",
        label: "Add a to-do",
        icon: Plus,
        onSelect: () => addRef.current?.focus(),
      },
      { id: "paste", label: "Paste a list", icon: FileText, onSelect: () => setPasting(true) },
      ...(empty
        ? [
            {
              id: "start",
              label: "Start me off",
              icon: Lightbulb,
              onSelect: () => void starters.current(),
            },
          ]
        : []),
    ]);
  }, [onMenu, empty]);

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
      {facts.length > 0 && (
        <div className="plain-card flex divide-x divide-border py-3">
          {facts.map((fact) => {
            const Icon = FACT_ICONS[fact.id];
            return (
              <div key={fact.id} className="min-w-0 flex-1 px-1 text-center leading-tight">
                <Icon className="mx-auto mb-1.5 size-6 text-foreground" aria-hidden />
                <p className="truncate text-[14px]">{fact.value}</p>
                <p className="truncate text-[12px] text-muted-foreground">{fact.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {groups.length > 0 && (
        <div
          role="group"
          aria-label="When"
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 text-[13.5px]"
        >
          {[
            { id: null, chip: "All", n: visible.length },
            ...groups.map((g) => ({ id: g.id, chip: g.title, n: g.todos.length })),
          ].map((chip, i) => (
            <button
              key={chip.id ?? "all"}
              type="button"
              aria-pressed={only === chip.id}
              onClick={() => setOnly(chip.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 ${
                only === chip.id
                  ? "bg-foreground font-semibold text-background"
                  : `border border-border text-foreground ${prepTint(i)}`
              }`}
            >
              {chip.chip} ({chip.n})
            </button>
          ))}
        </div>
      )}

      {!empty && (
        <div className="flex items-center justify-between gap-2 px-1 text-[12.5px] text-muted-foreground">
          <p>{todoProgressLine(t.todos)}</p>
          {t.done.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="shrink-0 font-semibold text-foreground underline underline-offset-2"
            >
              {showDone ? "Hide done" : `Show done (${t.done.length})`}
            </button>
          )}
        </div>
      )}

      {shown.map((group, g) => {
        const Icon = group.icon;
        const open = !folded.has(group.id);
        return (
          <section key={group.id}>
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
              className="mb-2 flex min-h-11 w-full items-center gap-2.5 px-0.5 text-left"
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${prepTint(g)}`}
              >
                <Icon className="size-[18px] text-foreground" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-[22px] leading-none">
                {group.title}
              </span>
              <span className="shrink-0 text-[14px] text-muted-foreground">
                {group.todos.filter((todo) => !todo.done).length} open
              </span>
              <ChevronDown
                className={`size-[18px] shrink-0 text-foreground transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            {open && (
              <ul className="plain-card divide-y divide-border px-3.5">
                {group.todos.map((todo, i) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    today={today}
                    tint={g + i + 1}
                    open={menuId === todo.id}
                    onOpen={() => setMenuId(menuId === todo.id ? "" : todo.id)}
                    onToggle={(done) => void t.toggleTodo(todo.id, done)}
                    onSave={(patch) => void update(todo.id, patch, "Couldn't save that")}
                    onDue={(value) =>
                      void update(todo.id, { due_on: value }, "Couldn't set that date")
                    }
                    onRemove={() => {
                      setMenuId("");
                      void t.removeTodo(todo.id);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {empty && !t.loading && (
        <div className="plain-card flex flex-col items-center gap-3 px-5 py-6 text-center">
          <img src="/bea/bea-think-static.png" alt="" className="size-20 object-contain" />
          <p className="text-[14.5px] text-muted-foreground">
            Passports, transfers, the things that are not packing. The thing you always remember at
            the airport.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addStarters()}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-[14px] font-semibold disabled:opacity-50"
          >
            <Lightbulb className="size-4" aria-hidden />
            Start me off
          </button>
        </div>
      )}

      {pasting && (
        <div className="plain-card space-y-2 p-3">
          <textarea
            autoFocus
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            aria-label="Paste a list of things to do"
            placeholder={"Renew passport\nBook airport transfer\nTell the bank"}
            className="w-full rounded-2xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px]"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy || todosFromPaste(paste).length === 0}
              onClick={() => void addPasted()}
              className="btn-primary px-4 py-2 text-[14.5px] disabled:opacity-40 disabled:shadow-none"
            >
              Add {todosFromPaste(paste).length || ""} to-dos
            </button>
            <button
              type="button"
              onClick={() => setPasting(false)}
              className="text-[13.5px] text-muted-foreground underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="px-1 text-[12px] text-destructive">{error}</p>}

      {/* The ways in, on one bar at the foot, as in the master. */}
      <div className="sticky -bottom-6 -mx-4 flex items-center gap-4 border-t border-border bg-background px-4 pb-6 pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card pl-4 pr-1.5">
          <Plus className="size-[18px] shrink-0 text-foreground" aria-hidden />
          <input
            ref={addRef}
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
            className="min-w-0 flex-1 bg-transparent py-3 text-[15px] outline-none placeholder:text-foreground"
          />
          {title.trim() && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void add()}
              aria-label="Add this to-do"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPasting((v) => !v)}
          aria-expanded={pasting}
          className="flex shrink-0 items-center gap-1.5 text-[15px] underline underline-offset-2"
        >
          <FileText className="size-5" aria-hidden />
          Paste list
        </button>
      </div>
    </div>
  );
}

/** One to-do: tick, kind, title, note; the chevron opens its details to edit. */
function TodoItem({
  todo,
  today,
  tint,
  open,
  onOpen,
  onToggle,
  onSave,
  onDue,
  onRemove,
}: {
  todo: TodoRow;
  today: string;
  tint: number;
  open: boolean;
  onOpen: () => void;
  onToggle: (done: boolean) => void;
  onSave: (patch: { title?: string; notes?: string }) => void;
  onDue: (value: string) => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes ?? "");
  useEffect(() => {
    if (open) {
      setTitle(todo.title);
      setNotes(todo.notes ?? "");
    }
  }, [open, todo.title, todo.notes]);

  const state = dueState(todo.due_on, today);
  const label = dueLabel(todo.due_on, today);
  const Mark = ICONS[todoIcon(todo.title)];
  const changed = title.trim() !== todo.title || notes.trim() !== (todo.notes ?? "");

  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={todo.done}
          aria-label={todo.done ? `Undo ${todo.title}` : `Mark ${todo.title} done`}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-5 shrink-0 accent-foreground"
        />
        <span
          aria-hidden
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${prepTint(tint)}`}
        >
          <Mark className="size-5 text-foreground" />
        </span>
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          aria-label={`Details for ${todo.title}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1 leading-snug">
            <span
              className={`block text-[15px] ${
                todo.done ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {todo.title}
            </span>
            {todo.notes && (
              <span className="block text-[13px] text-muted-foreground">{todo.notes}</span>
            )}
            {label && !todo.done && (
              <span className={`flex items-center gap-1 text-[12.5px] ${DUE_TONE[state]}`}>
                <CalendarDays className="size-3" aria-hidden />
                {label}
              </span>
            )}
          </span>
          <ChevronRight
            className={`size-[18px] shrink-0 text-foreground transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      {open && (
        <div className="mt-2.5 space-y-2 rounded-2xl bg-elevated p-3 sm:ml-[5.5rem]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="To-do"
            className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px]"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note"
            aria-label={`Note for ${todo.title}`}
            className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[13.5px]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              Due
              <input
                type="date"
                value={todo.due_on ?? ""}
                aria-label={`Due date for ${todo.title}`}
                onChange={(e) => onDue(e.target.value)}
                className="rounded-lg border border-[var(--field-border)] bg-card px-2 py-1 text-[12.5px] text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={onRemove}
              className="ml-auto flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-[12.5px] font-semibold text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remove
            </button>
            {changed && title.trim() && (
              <button
                type="button"
                onClick={() => onSave({ title: title.trim(), notes: notes.trim() })}
                className="rounded-lg bg-primary px-3 py-1 text-[12.5px] font-semibold text-primary-foreground"
              >
                Save
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
