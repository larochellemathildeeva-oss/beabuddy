/**
 * "What should Béa prioritize?" — the tiles shared by Build, Optimize and
 * Compare in Plan with Béa.
 *
 * Optimize sends the chosen ids as its goals (the first seven are its own
 * goal ids). Build and Compare have no goal list on the server, so what was
 * picked travels as words: a line Béa reads with the traveller's request.
 */

export type PlanPriorityId =
  "closest" | "hours" | "rainy" | "easy-morning" | "rest" | "even" | "food" | "budget" | "unique";

export const PLAN_PRIORITIES: ReadonlyArray<{
  id: PlanPriorityId;
  label: string;
  /** How Béa reads the choice, in the traveller's voice. */
  ask: string;
}> = [
  { id: "closest", label: "Closest together", ask: "places close together, little backtracking" },
  { id: "hours", label: "Open at visit time", ask: "each place open when I get there" },
  { id: "rainy", label: "Rainy-day indoor", ask: "indoor things grouped for a wet day" },
  { id: "easy-morning", label: "Easy mornings", ask: "later starts and lighter mornings" },
  { id: "rest", label: "Leave a rest day", ask: "one clearly quieter day" },
  { id: "even", label: "Even pace", ask: "no day overloaded" },
  { id: "food", label: "Meals first", ask: "days arranged around good meals" },
  { id: "budget", label: "On a budget", ask: "easy on the budget" },
  {
    id: "unique",
    label: "Unique / off the beaten path",
    ask: "less touristy, off the beaten path",
  },
];

/** "What matters most to me: places close together …; easy on the budget." — "" for none. */
export function prioritiesLine(ids: readonly PlanPriorityId[]): string {
  const asks = PLAN_PRIORITIES.filter((p) => ids.includes(p.id)).map((p) => p.ask);
  return asks.length ? `What matters most to me: ${asks.join("; ")}.` : "";
}

/** The traveller's words with the priorities after them, for Build. */
export function withPriorities(text: string, ids: readonly PlanPriorityId[]): string {
  const line = prioritiesLine(ids);
  const words = text.trim();
  if (!line) return words;
  return words ? `${words}\n\n${line}` : line;
}

/** The pace a Build asks for: slower when the picks say so, else the saved preferences decide. */
export function paceFor(ids: readonly PlanPriorityId[]): "relaxed" | null {
  return ids.includes("easy-morning") || ids.includes("rest") ? "relaxed" : null;
}

/** The budget style a Build asks for: value on a budget, else the saved preferences decide. */
export function budgetFor(ids: readonly PlanPriorityId[]): "value" | null {
  return ids.includes("budget") ? "value" : null;
}

/**
 * Compare's "what matters": the picks as a short list, then anything typed,
 * in at most `max` characters. The typed words always arrive whole; a pick
 * that no longer fits is the one left out.
 */
export function comparePriorities(
  ids: readonly PlanPriorityId[],
  typed: string,
  max = 400,
): string {
  const extra = typed.trim().slice(0, max);
  const parts: string[] = [];
  let room = max - (extra ? extra.length + 2 : 0);
  for (const p of PLAN_PRIORITIES) {
    if (!ids.includes(p.id)) continue;
    const cost = p.ask.length + (parts.length ? 2 : 0);
    if (cost > room) break;
    parts.push(p.ask);
    room -= cost;
  }
  return [...parts, ...(extra ? [extra] : [])].join("; ");
}
