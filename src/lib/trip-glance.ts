/**
 * What the trip banners and Home say about a trip at a glance: the pill over
 * the picture, the painted scene behind a trip with no photograph yet, how
 * much of the plan is confirmed, and the one thing worth doing next. Pure, so
 * each rule is tested on its own.
 */

import { countdownLabel, isUnderway } from "./trip-card.ts";

/** Parse a stored YYYY-MM-DD as a local date, never as UTC midnight. */
function localDate(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysFrom = (a: Date, b: Date) =>
  Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / 86_400_000);

/**
 * The small pill in the corner of a trip card: "Next week", "In 2 days",
 * "Underway", "Tentative". Empty when there is nothing worth saying.
 */
export function bannerPill(
  start: string | null | undefined,
  end: string | null | undefined,
  tentative = false,
  now = new Date(),
): string {
  if (isUnderway(start, end, now)) return "Underway";
  const soon = countdownLabel(start, now);
  if (soon) return soon.charAt(0).toUpperCase() + soon.slice(1);
  return tentative ? "Tentative" : "";
}

/**
 * The pill on Home's hero, which has room for both halves: "Upcoming · 12
 * days", "Underway · Day 3 of 7", "Leaving today".
 */
export function heroPill(
  start: string | null | undefined,
  end: string | null | undefined,
  tentative = false,
  now = new Date(),
): string {
  const from = localDate(start);
  if (!from) return tentative ? "Tentative" : "Planning";
  const to = localDate(end) ?? from;
  const until = daysFrom(now, from);
  if (until > 1) return `Upcoming · ${until} days`;
  if (until === 1) return "Leaving tomorrow";
  if (until === 0) return "Leaving today";
  const day = daysFrom(from, now) + 1;
  const length = daysFrom(from, to) + 1;
  if (day <= length) return length > 1 ? `Underway · Day ${day} of ${length}` : "Underway";
  return "Just back";
}

/** "3D": the trip's length in days, for the corner of a banner. */
export function daysShort(start: string | null | undefined, end: string | null | undefined) {
  const from = localDate(start);
  const to = localDate(end);
  if (!from || !to) return "";
  const days = daysFrom(from, to) + 1;
  return days >= 1 ? `${days}D` : "";
}

/** "Tokyo to Kyoto": where the trip starts and ends, when those differ. */
export function routeLine(cities: readonly string[]): string {
  const names = cities.map((c) => (c.split(",")[0] ?? "").trim()).filter(Boolean);
  const first = names[0];
  if (!first) return "";
  const last = names[names.length - 1]!;
  return last.toLowerCase() === first.toLowerCase() ? first : `${first} to ${last}`;
}

/** Morning, afternoon or evening, by the clock on the phone. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Kinds that are a booking first: the things "plans confirmed" counts.
 * A sight you mean to wander past is not a plan waiting on a confirmation.
 */
const BOOKABLE = new Set(["flight", "hotel", "lodging", "reservation", "transport"]);

/** "6 of 10 plans confirmed", or null when nothing on the plan needs booking. */
export function plansConfirmed(
  items: readonly { kind: string; booked?: boolean | null }[],
): { confirmed: number; total: number } | null {
  const plans = items.filter((i) => BOOKABLE.has(i.kind) || i.booked === true);
  if (plans.length === 0) return null;
  return { confirmed: plans.filter((i) => i.booked === true).length, total: plans.length };
}

/** The first thing on the plan you would go and see, past the travel and the bed. */
export function firstStop<T extends { kind: string; title: string }>(
  items: readonly T[],
): T | null {
  return items.find((i) => !BOOKABLE.has(i.kind) && i.kind !== "note" && i.title.trim()) ?? null;
}

/**
 * The next thing on the timeline from today: the first dated entry on or after
 * today, in plan order. Before a trip starts that is simply its first entry.
 */
export function nextOnPlan<T extends { day_date: string | null }>(
  items: readonly T[],
  today: string,
): T | null {
  return items.find((i) => i.day_date && i.day_date >= today) ?? null;
}

/**
 * The to-do worth putting on Home: the open one due soonest, then the rest in
 * the order the trip keeps them.
 */
export function nextTodo<T extends { done: boolean; due_on: string | null; position: number }>(
  todos: readonly T[],
): T | null {
  const open = todos.filter((t) => !t.done);
  open.sort((a, b) => {
    if (a.due_on && b.due_on && a.due_on !== b.due_on) return a.due_on.localeCompare(b.due_on);
    if (a.due_on && !b.due_on) return -1;
    if (!a.due_on && b.due_on) return 1;
    return a.position - b.position;
  });
  return open[0] ?? null;
}

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Best done by 3 October", "Due today", "Was due 1 October". */
export function dueLine(due: string | null | undefined, now = new Date()): string {
  const d = localDate(due);
  if (!d) return "";
  const days = daysFrom(now, d);
  const date = `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
  if (days < 0) return `Was due ${date}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Best done by ${date}`;
}

/** Minutes on foot at an unhurried 4.8 km/h, never less than one. */
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 80));
}

/* ------------------------------------------------------------------------ */
/* The painted scene                                                          */
/* ------------------------------------------------------------------------ */

export type BannerScene = {
  sky: [string, string];
  sun: string;
  /** Far to near. */
  hills: [string, string, string];
  sunX: number;
  sunY: number;
  sunR: number;
  /** SVG path data for each hill, far to near, in a 400 × 160 box. */
  paths: [string, string, string];
  birds: boolean;
};

/**
 * Dusk palettes in Béa's warm band — plum, wine, umber, ink, olive. Dark on
 * purpose: the title is white and sits straight on top, and a painted
 * placeholder should read as evening light rather than a colour swatch.
 */
const PALETTES: { sky: [string, string]; sun: string; hills: [string, string, string] }[] = [
  { sky: ["#4d3d45", "#6d5a5e"], sun: "#c9a877", hills: ["#4a3a44", "#312935", "#1e1a24"] },
  { sky: ["#6e3a40", "#8f5b5a"], sun: "#d9ceb6", hills: ["#5c2e36", "#3f2229", "#27161b"] },
  { sky: ["#5e4232", "#8a6446"], sun: "#e3c48f", hills: ["#4f3627", "#36251b", "#221711"] },
  { sky: ["#2d3144", "#4a4659"], sun: "#e8dcc0", hills: ["#2c2d3c", "#1e202c", "#13141c"] },
  { sky: ["#4f4c3c", "#716a50"], sun: "#dcc58d", hills: ["#3f3d2f", "#2c2b21", "#1b1a14"] },
];

function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small, fast and the same on every device for the same seed. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A soft ridge across the box, closed along the bottom edge. */
function ridge(rand: () => number, base: number, amp: number, peaks: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i <= peaks; i++) {
    const x = (400 / peaks) * i;
    pts.push([x, base - amp * (0.25 + rand() * 0.75)]);
  }
  let d = `M0,160 L0,${r1(pts[0]![1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const mx = (x0 + x1) / 2;
    d += ` C${r1(mx)},${r1(y0)} ${r1(mx)},${r1(y1)} ${r1(x1)},${r1(y1)}`;
  }
  return `${d} L400,160 Z`;
}

/**
 * The evening scene behind a trip that has no photograph yet: sky, a low sun
 * and three ridges of hills. Chosen from the trip's name, so a trip keeps its
 * picture from visit to visit and two trips side by side do not match.
 */
export function bannerScene(seed: string): BannerScene {
  const h = hash(seed || "Béa");
  const rand = random(h);
  const palette = PALETTES[h % PALETTES.length]!;
  return {
    ...palette,
    sunX: r1(120 + rand() * 200),
    sunY: r1(58 + rand() * 40),
    sunR: r1(34 + rand() * 30),
    paths: [
      ridge(rand, 112, 42, 3 + Math.floor(rand() * 2)),
      ridge(rand, 132, 36, 4 + Math.floor(rand() * 2)),
      ridge(rand, 152, 26, 3 + Math.floor(rand() * 3)),
    ],
    birds: rand() > 0.45,
  };
}
