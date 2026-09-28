/**
 * Trip to-do list logic: the errands a trip creates that are neither timeline
 * stops nor packing items — renew the passport, book the transfer, tell the
 * bank, print the tickets.
 */

import { parseLocalDate, toLocalISODate } from "./trip-dates.ts";

export type TodoLike = {
  id: string;
  title: string;
  due_on: string | null;
  done: boolean;
};

/** The migration ships separately from the deploy — say so rather than erroring. */
export function isMissingTodosTable(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  const text = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  if (!text.includes("trip_todos")) return false;
  return (
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("could not find")
  );
}

export type DueState = "overdue" | "today" | "soon" | "later" | "none";

/** How urgent a to-do is, relative to a reference day (default: today). */
export function dueState(dueOn: string | null, today: string): DueState {
  if (!dueOn) return "none";
  if (dueOn < today) return "overdue";
  if (dueOn === today) return "today";
  const from = parseLocalDate(today);
  const to = parseLocalDate(dueOn);
  if (!from || !to) return "none";
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  return days <= 7 ? "soon" : "later";
}

/** Short human label for a due date, e.g. "Overdue", "Today", "In 3 days". */
export function dueLabel(dueOn: string | null, today: string): string {
  const state = dueState(dueOn, today);
  if (state === "none" || !dueOn) return "";
  if (state === "today") return "Today";
  const from = parseLocalDate(today);
  const to = parseLocalDate(dueOn);
  if (!from || !to) return "";
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (state === "overdue") {
    const late = Math.abs(days);
    return late === 1 ? "1 day late" : `${late} days late`;
  }
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/**
 * Open items first, soonest due first, undated last; done items at the end in
 * the order they were ticked off.
 */
export function sortTodos<T extends TodoLike>(todos: T[]): T[] {
  const rank = (t: T) => (t.done ? 1 : 0);
  return [...todos].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.done) return 0;
    if (a.due_on && b.due_on) return a.due_on < b.due_on ? -1 : a.due_on > b.due_on ? 1 : 0;
    if (a.due_on) return -1;
    if (b.due_on) return 1;
    return 0;
  });
}

/** "3 of 7 done" — the one line the card header needs. */
export function todoProgressLine(todos: TodoLike[]): string {
  if (todos.length === 0) return "Passports, transfers, the things that are not packing.";
  const done = todos.filter((t) => t.done).length;
  if (done === todos.length) return `All ${todos.length} done. Future You is impressed.`;
  const overdueCount = todos.filter(
    (t) => !t.done && t.due_on && t.due_on < toLocalISODate(new Date()),
  ).length;
  const base = `${done} of ${todos.length} done`;
  return overdueCount > 0 ? `${base} · ${overdueCount} overdue` : base;
}

/**
 * Starter to-dos worth offering on an empty list. Kept deliberately short and
 * boring: these are the ones people actually forget, not a generated checklist.
 */
export function starterTodos(input: {
  international: boolean;
  hasLodging: boolean;
  hasFlights: boolean;
}): string[] {
  const out: string[] = [];
  if (input.international) {
    out.push("Check passport expiry date");
    out.push("Check visa or entry requirements");
    out.push("Tell the bank you're travelling");
  }
  if (!input.hasLodging) out.push("Book somewhere to stay");
  if (!input.hasFlights) out.push("Book the way there");
  out.push("Arrange airport transfer");
  out.push("Travel insurance");
  out.push("Download offline maps");
  return out;
}

/** Split one paste into several to-dos — one per line, dashes and bullets trimmed. */
export function todosFromPaste(text: string, max = 25): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*••]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0 && line.length <= 200)
    .slice(0, max);
}

export type TodoPhase = "before" | "during" | "after" | "anytime";

/**
 * When a to-do belongs, from its due date and the trip's dates: before the
 * trip, during it, after it, or anytime when it has no date. A trip with no
 * dates yet puts every dated to-do before it.
 */
export function todoPhase(
  dueOn: string | null,
  tripStart: string | null | undefined,
  tripEnd: string | null | undefined,
): TodoPhase {
  if (!dueOn) return "anytime";
  const start = tripStart || tripEnd;
  const end = tripEnd || tripStart;
  if (!start || !end) return "before";
  if (dueOn < start) return "before";
  if (dueOn > end) return "after";
  return "during";
}

export type TodoIcon =
  | "passport"
  | "visa"
  | "money"
  | "transfer"
  | "stay"
  | "flight"
  | "insurance"
  | "map"
  | "health"
  | "ticket"
  | "phone"
  | "todo";

/** Words that say what a to-do is about, checked in order. Lower case, whole words or stems. */
const TODO_ICON_WORDS: [TodoIcon, RegExp][] = [
  ["passport", /\bpassports?\b/],
  ["visa", /\b(visas?|entry requirements?|esta|eta)\b/],
  ["health", /\b(vaccin\w*|jabs?|medic\w*|prescription|pharmacy)\b/],
  ["insurance", /\binsurance\b/],
  ["money", /\b(bank|cards?|cash|currency|money|exchange)\b/],
  ["transfer", /\b(transfers?|taxi|car hire|rental car|shuttle|parking)\b/],
  ["flight", /\b(flights?|check[- ]?in|boarding|the way there)\b/],
  ["stay", /\b(hotel|stay|lodging|accommodation|airbnb|hostel)\b/],
  ["ticket", /\b(tickets?|reservations?|book (a )?table|tour)\b/],
  ["map", /\b(maps?|directions|offline)\b/],
  ["phone", /\b(sim|esim|roaming|phone|charger|adapter)\b/],
];

/** The icon a to-do gets, guessed from its words; a plain check otherwise. */
export function todoIcon(title: string): TodoIcon {
  const text = title.toLowerCase();
  return TODO_ICON_WORDS.find(([, words]) => words.test(text))?.[0] ?? "todo";
}
