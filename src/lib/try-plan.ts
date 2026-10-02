/**
 * "Try it" on the landing page: a visitor picks a preset plan and sees it read into
 * days before making an account. It uses the plain-list reader alone
 * (`plan-lines.ts`): in the browser, no AI, no request. The text waits on the
 * phone through sign-up, so the new trip's import opens with it.
 */
import { readPlainPlan } from "./plan-lines.ts";
import { kindChoiceLabel, normaliseKind } from "./timeline-kind.ts";
import type { ParsedItinerary, ParsedItineraryItem } from "./itinerary.functions.ts";

/**
 * The plans a visitor can try. Preset, not pasted: each is read cleanly by the
 * list reader (tested) and every stop is named the way the map finds it in its
 * own city — checked against OpenStreetMap's plain search, Béa's last fallback,
 * when they were written. A first look at Béa never starts from a messy plan
 * and a bad result. Change a stop only after checking it the same way.
 */
export type TryPreset = { id: string; label: string; blurb: string; text: string };

export const TRY_PLAN_PRESETS: readonly TryPreset[] = [
  {
    id: "paris",
    label: "Paris",
    blurb: "Two days, museums and cafés",
    text: `Day 1 — Paris
09:30 Louvre Museum
12:30 Lunch at Café Marly
14:30 Tuileries Garden
16:00 Musée de l'Orangerie
19:30 Dinner at Le Train Bleu

Day 2 — Paris
10:00 Sainte-Chapelle
11:30 Notre-Dame Cathedral
13:00 Lunch at Le Procope
15:00 Jardin du Luxembourg
18:00 Eiffel Tower`,
  },
  {
    id: "tokyo",
    label: "Tokyo",
    blurb: "Two days, shrines and markets",
    text: `Day 1 — Tokyo
09:00 Senso-ji Temple
11:00 Tokyo Skytree
13:00 Lunch at Tsukiji Outer Market
15:30 Hama-rikyu Gardens
19:00 Dinner in Shinjuku Omoide Yokocho

Day 2 — Tokyo
09:30 Meiji Jingu
11:30 Takeshita Street
13:00 Lunch at Maisen Aoyama
15:00 Shibuya Sky
18:30 Shinjuku Gyoen`,
  },
  {
    id: "rome",
    label: "Rome",
    blurb: "Two days, ruins and piazzas",
    text: `Day 1 — Rome
09:00 Colosseum
11:00 Roman Forum
13:00 Lunch at Roscioli
15:00 Pantheon
16:30 Trevi Fountain
19:30 Dinner at Da Enzo al 29

Day 2 — Rome
09:30 Piazza Navona
11:00 Campo de' Fiori
13:00 Lunch at Armando al Pantheon
15:30 Galleria Borghese
17:30 Villa Borghese
19:00 Spanish Steps`,
  },
];

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
