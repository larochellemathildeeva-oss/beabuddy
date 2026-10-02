/**
 * "Try it" on the landing page: a visitor pastes a plan and sees it read into
 * days before making an account. It uses the plain-list reader alone
 * (`plan-lines.ts`): in the browser, no AI, no request. The text waits on the
 * phone through sign-up, so the new trip's import opens with it.
 */
import { readPlainPlan } from "./plan-lines.ts";
import { kindChoiceLabel, normaliseKind } from "./timeline-kind.ts";
import type { ParsedItinerary, ParsedItineraryItem } from "./itinerary.functions.ts";

export const TRY_PLAN_SAMPLE = `Day 1 — Lisbon
09:30 Pastéis de Belém
10:15 Jerónimos Monastery
12:30 Lunch at Time Out Market
15:00 Alfama wander
20:00 Dinner at Taberna da Rua das Flores

Day 2 — Sintra
09:00 Train to Sintra from Rossio
10:30 Pena Palace
13:00 Lunch at Tascantiga
15:00 Quinta da Regaleira`;

/** The trip planner's own cap on a plan handed over with `ask`. */
export const TRY_PLAN_MAX = 2000;
const KEY = "bea.tryPlan";
/** A plan left a week is not the one they meant to save. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export type TryDay = { day: number; items: ParsedItineraryItem[] };
export type TryRead = { plan: ParsedItinerary; days: TryDay[] };

/** The pasted plan as days, or null when it is not a tidy timed list. */
export function readTryPlan(text: string): TryRead | null {
  const trimmed = text.trim().slice(0, TRY_PLAN_MAX);
  if (!trimmed) return null;
  const plan = readPlainPlan(trimmed, { startDate: null, tripCity: null });
  if (!plan || plan.items.length === 0) return null;
  const byDay = new Map<number, ParsedItineraryItem[]>();
  for (const item of plan.items) {
    const day = item.day_number ?? 1;
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, items]) => ({ day, items }));
  return { plan, days };
}

/** A stop's kind as the trip timeline's chip names it. */
export function tryKindLabel(kind: string): string {
  return kindChoiceLabel(normaliseKind(kind));
}

type Storage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** Keep the plan for after sign-up; false when the browser would not keep it. */
export function savePendingTryPlan(storage: Storage, text: string, now = Date.now()): boolean {
  const trimmed = text.trim().slice(0, TRY_PLAN_MAX);
  if (!trimmed) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ text: trimmed, at: now }));
  } catch {
    return false;
  }
  // A private window or blocked storage can accept the write and keep nothing.
  return peekPendingTryPlan(storage, now) === trimmed;
}

/** The waiting plan, if any and still fresh, without using it up. */
export function peekPendingTryPlan(storage: Storage, now = Date.now()): string | null {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "text" in value &&
      "at" in value &&
      typeof value.text === "string" &&
      typeof value.at === "number" &&
      now - value.at < KEEP_MS &&
      value.text.trim()
    ) {
      return value.text.slice(0, TRY_PLAN_MAX);
    }
  } catch {
    // Not ours, or broken: dropped below.
  }
  storage.removeItem(KEY);
  return null;
}

export function clearPendingTryPlan(storage: Storage): void {
  storage.removeItem(KEY);
}
