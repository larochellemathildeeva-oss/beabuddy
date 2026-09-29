import { BEA_CHARACTER } from "./bea-character-data.ts";

/**
 * Béa's personality: eight traits the traveller mixes, and the rules for what
 * she says with that mix.
 *
 * The mix changes only her optional voice — loading lines, empty states,
 * success reactions, Companion asides. Facts, directions, prices, warnings and
 * errors never go through here, and a serious context always gets the plain
 * line whatever the mix. Pure and seeded, so it is tested without a screen.
 */

export const BEA_TRAITS = [
  "helpful",
  "funny",
  "sassy",
  "encouraging",
  "curious",
  "adventurous",
  "dramatic",
  "chill",
] as const;
export type BeaTrait = (typeof BEA_TRAITS)[number];
export type BeaMix = Record<BeaTrait, number>;

export const BEA_PRESETS = ["balanced", "helpful", "funny", "sassy", "minimal"] as const;
export type BeaPreset = (typeof BEA_PRESETS)[number];

export const TRAIT_INFO = BEA_CHARACTER.traits as Record<
  BeaTrait,
  { name: string; description: string; examples: readonly string[] }
>;
export const PRESET_INFO = BEA_CHARACTER.presets as Record<
  BeaPreset,
  { name: string; description: string; mix: BeaMix }
>;

export const BALANCED: BeaMix = { ...PRESET_INFO.balanced.mix };

/** What the traveller keeps: the mix, and which optional extras are on. */
export type BeaSettings = {
  mix: BeaMix;
  /** Companion "Béa says" asides. */
  says: boolean;
  /** Rare Easter eggs: ball, bone, the credentials jokes. */
  surprises: boolean;
  /** Success lines and reactions to notable results. */
  reactions: boolean;
};

export const DEFAULT_SETTINGS: BeaSettings = {
  mix: BALANCED,
  says: true,
  surprises: true,
  reactions: true,
};

const clamp = (n: unknown) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
};

/** Any stored value, made safe: unknown traits dropped, numbers clamped to 0–100. */
export function cleanSettings(value: unknown): BeaSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<
    Record<keyof BeaSettings, unknown>
  >;
  const mixIn = (raw.mix && typeof raw.mix === "object" ? raw.mix : null) as Record<
    string,
    unknown
  > | null;
  const mix = Object.fromEntries(
    BEA_TRAITS.map((t) => [t, mixIn ? clamp(mixIn[t]) : BALANCED[t]]),
  ) as BeaMix;
  const flag = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  return {
    mix,
    says: flag(raw.says, true),
    surprises: flag(raw.surprises, true),
    reactions: flag(raw.reactions, true),
  };
}

/**
 * The sliders are intensities and need not add up to 100; this turns them
 * into shares that do. All zero means Helpful.
 */
export function normalizeMix(mix: BeaMix): BeaMix {
  const total = BEA_TRAITS.reduce((sum, t) => sum + Math.max(0, mix[t]), 0);
  if (total <= 0) return { ...zeroMix(), helpful: 1 };
  return Object.fromEntries(BEA_TRAITS.map((t) => [t, Math.max(0, mix[t]) / total])) as BeaMix;
}

function zeroMix(): BeaMix {
  return Object.fromEntries(BEA_TRAITS.map((t) => [t, 0])) as BeaMix;
}

/** Whole-number percentages that add up to exactly 100, for the settings screen. */
export function mixPercents(mix: BeaMix): BeaMix {
  const shares = normalizeMix(mix);
  const exact = BEA_TRAITS.map((t) => ({ t, v: shares[t] * 100 }));
  const out = Object.fromEntries(exact.map(({ t, v }) => [t, Math.floor(v)])) as BeaMix;
  let left = 100 - BEA_TRAITS.reduce((s, t) => s + out[t], 0);
  for (const { t } of [...exact].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left <= 0) break;
    out[t] += 1;
    left -= 1;
  }
  return out;
}

/** The preset whose shares this mix has, if any. */
export function presetOf(mix: BeaMix): BeaPreset | null {
  const shares = normalizeMix(mix);
  return (
    BEA_PRESETS.find((p) => {
      const target = normalizeMix(PRESET_INFO[p].mix);
      return BEA_TRAITS.every((t) => Math.abs(target[t] - shares[t]) < 0.005);
    }) ?? null
  );
}

/**
 * The name shown for a mix: its preset, else what it leans towards —
 * "Mostly Funny", "Funny & Sassy" — else "Custom".
 */
export function modeName(mix: BeaMix): string {
  const preset = presetOf(mix);
  if (preset) return PRESET_INFO[preset].name;
  const shares = normalizeMix(mix);
  const ranked = [...BEA_TRAITS].sort((a, b) => shares[b] - shares[a]);
  const [first, second] = ranked as [BeaTrait, BeaTrait];
  if (shares[first] >= 0.5) return `Mostly ${TRAIT_INFO[first].name}`;
  if (shares[first] + shares[second] >= 0.7 && shares[second] >= 0.2) {
    return `${TRAIT_INFO[first].name} & ${TRAIT_INFO[second].name}`;
  }
  return "Custom";
}

/** A small, fast, seedable random number source (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a trait by weight from the traits that have something to say here. */
function pickTrait(shares: BeaMix, allowed: readonly BeaTrait[], rand: () => number): BeaTrait {
  const pool = allowed.filter((t) => shares[t] > 0);
  const list = pool.length ? pool : allowed.includes("helpful") ? ["helpful" as const] : allowed;
  const total = list.reduce((s, t) => s + (pool.length ? shares[t] : 1), 0);
  let r = rand() * total;
  for (const t of list) {
    r -= pool.length ? shares[t] : 1;
    if (r <= 0) return t;
  }
  return list[list.length - 1]!;
}

/** A line not said in the last five, or "" when every one was. */
function unseen(lines: readonly string[], recent: readonly string[], rand: () => number): string {
  const left = lines.filter((l) => !recent.slice(-5).includes(l));
  return left[Math.floor(rand() * left.length)] ?? "";
}

/** A line not said in the last few, when there is one. */
function fresh(lines: readonly string[], recent: readonly string[], rand: () => number): string {
  const unseen = lines.filter((l) => !recent.slice(-5).includes(l));
  const from = unseen.length ? unseen : lines;
  return from[Math.floor(rand() * from.length)] ?? "";
}

export type BeaAction = "run" | "dig" | "think" | "ball" | "bone";
/** The work Béa is doing, and the animation that goes with it. */
export type BeaWork = "run" | "dig" | "think";

/** The plain line for each kind of work, used whenever jokes are off. */
export const PLAIN_WORKING: Record<BeaWork, string> = {
  run: "Béa is building the route.",
  dig: "Béa is looking for the strongest recommendations.",
  think: "Béa is comparing the options.",
};

/**
 * What Béa is drawn doing next while she waits. Her own work comes up most,
 * the other two kinds of work for variety, and — with surprises on and some
 * play in the mix — chasing the ball or digging up a bone. Never the same
 * side trip twice in a row. `jokes: false` keeps to the three kinds of work.
 */
export function nextPose(input: {
  work: BeaWork;
  previous: BeaAction;
  settings: BeaSettings;
  jokes?: boolean;
  rand?: () => number;
}): BeaAction {
  const { work, previous, settings, jokes = true, rand = Math.random } = input;
  const shares = normalizeMix(settings.mix);
  const weights: [BeaAction, number][] = [
    [work, 3],
    ...(["run", "dig", "think"] as const)
      .filter((w) => w !== work)
      .map((w): [BeaAction, number] => [w, 1.5]),
  ];
  if (jokes && settings.surprises && shares.helpful < 0.8) {
    weights.push(["ball", 1.5], ["bone", work === "dig" ? 1.5 : 0.75]);
  }
  const pool = weights.filter(([pose]) => pose === work || pose !== previous);
  let r = rand() * pool.reduce((s, [, w]) => s + w, 0);
  for (const [pose, w] of pool) {
    r -= w;
    if (r <= 0) return pose;
  }
  return work;
}

type Bank = Partial<Record<"generic" | BeaAction, readonly string[]>>;
const LOADING = BEA_CHARACTER.loading as Record<BeaTrait, Bank>;

/**
 * The line under "Béa is working on it…" for one kind of work.
 *
 * The action decides what she is talking about; the mix decides how. The
 * five lines said most recently are skipped. `serious` returns the plain
 * line — the mix never reaches a serious wait.
 */
export function loadingLine(input: {
  action: BeaAction;
  settings: BeaSettings;
  recent?: readonly string[];
  rand?: () => number;
  serious?: boolean;
}): string {
  const { action, settings, recent = [], rand = Math.random, serious = false } = input;
  if (serious)
    return action === "ball" || action === "bone" ? PLAIN_WORKING.think : PLAIN_WORKING[action];
  const shares = normalizeMix(settings.mix);
  const withAction = BEA_TRAITS.filter((t) => (LOADING[t]?.[action]?.length ?? 0) > 0);
  // Ball and bone are jokes by nature: only the traits that tell them.
  if (action === "ball" || action === "bone") {
    const trait = pickTrait(shares, withAction, rand);
    return fresh(LOADING[trait]?.[action] ?? [], recent, rand);
  }
  // A trait whose lines were all said just now gives way to another.
  let line = "";
  for (let tries = 0; tries < 6 && !line; tries++) {
    const trait = pickTrait(shares, BEA_TRAITS, rand);
    const bank = LOADING[trait] ?? {};
    // Mostly the action's own lines, else the trait's general ones.
    const own = bank[action] ?? [];
    const lines =
      own.length && (rand() < 0.6 || !bank.generic?.length) ? own : (bank.generic ?? own);
    line = unseen(lines, recent, rand);
  }
  if (!line) line = fresh(LOADING.helpful?.[action] ?? [], recent, rand);
  // An occasional credentials joke, only with surprises on and some humour in the mix.
  const playful = shares.funny + shares.sassy + shares.dramatic;
  if (settings.surprises && playful > 0.2 && rand() < 0.08) {
    return fresh(BEA_CHARACTER.lore, recent, rand) || line;
  }
  return line || PLAIN_WORKING[action];
}

export type EmptyKind = "noTrips" | "noSavedRecommendations" | "noResults";

/** A line for an empty screen, in the traveller's mix. */
export function emptyLine(input: {
  kind: EmptyKind;
  settings: BeaSettings;
  recent?: readonly string[];
  rand?: () => number;
}): string {
  const { kind, settings, recent = [], rand = Math.random } = input;
  const banks = BEA_CHARACTER.empty[kind] as Partial<Record<BeaTrait, readonly string[]>>;
  const has = BEA_TRAITS.filter((t) => (banks[t]?.length ?? 0) > 0);
  const trait = pickTrait(normalizeMix(settings.mix), has, rand);
  return fresh(banks[trait] ?? banks.helpful ?? [], recent, rand);
}

export type SuccessKind = "generic" | "itinerary" | "recommendations" | "route" | "compare";

/**
 * A short line after something finished, or null. Only sometimes, only with
 * reactions on, and never for a mix that is mostly plain.
 */
export function successLine(input: {
  kind: SuccessKind;
  settings: BeaSettings;
  recent?: readonly string[];
  rand?: () => number;
}): string | null {
  const { kind, settings, recent = [], rand = Math.random } = input;
  if (!settings.reactions) return null;
  const shares = normalizeMix(settings.mix);
  if (shares.helpful >= 0.8) return null;
  if (rand() >= 0.35) return null;
  const lines = BEA_CHARACTER.success[kind] ?? BEA_CHARACTER.success.generic;
  return fresh(lines, recent, rand) || null;
}

/** One rotating fictional qualification, for the Béa card on You. */
export function credentialLine(rand: () => number = Math.random): string {
  return fresh(BEA_CHARACTER.credentials, [], rand);
}

/** What a stop is, for Béa's aside about it. */
export type StopMood = "meal" | "sight" | "walk" | "lodging" | "transport" | "activity" | "note";

/**
 * Béa's asides on a stop, by what the stop is. Playful, third person, no emoji,
 * and never about the place's culture — only the kind of stop and the clock.
 */
const STOP_ASIDES: Record<StopMood | "early" | "late", readonly string[]> = {
  meal: [
    "Béa has pre-approved the snack budget.",
    "Béa would like it noted that she is available for crumbs.",
    "Eating counts as sightseeing. Béa checked.",
  ],
  sight: [
    "Béa recommends looking up. She cannot, but you can.",
    "A photo stop. Béa will pose if asked.",
    "Béa has sniffed out the good angle. Probably.",
  ],
  walk: [
    "Tiny legs, big ambitions. Béa is ready.",
    "A walk. Béa's favourite word, after snack.",
    "Béa has stretched. Mostly her ears.",
  ],
  lodging: [
    "Béa has already chosen her side of the bed.",
    "Nap potential: high. Béa approves.",
    "Béa will inspect the pillows. Professionally.",
  ],
  transport: [
    "Béa has her window seat face ready.",
    "Travel time. Béa suggests a snack for morale.",
    "Béa is counting the minutes. She is not good at counting.",
  ],
  activity: [
    "Béa is excited. Her tail is doing the paperwork.",
    "Something fun. Béa has cleared her schedule.",
    "Béa considers this a professional recommendation.",
  ],
  note: [],
  early: [
    "That is an aggressively early start.",
    "Béa recognizes that mornings exist. She still objects.",
  ],
  late: ["A late one. Béa has scheduled a nap in advance.", "Night owl plans. Béa is a day dog."],
};

/**
 * A short, playful aside after Béa's plain line on a stop — or null.
 *
 * Only with "Béa says" lines on, and only when the mix has some play in it:
 * a Helpful- or Minimal-leaning Béa sticks to the facts. The more playful the
 * mix, the more often she adds one. Never replaces the facts; only follows
 * them.
 */
export function stopAside(input: {
  mood: StopMood;
  hour?: number | null;
  settings: BeaSettings;
  recent?: readonly string[];
  rand?: () => number;
}): string | null {
  const { mood, hour, settings, recent = [], rand = Math.random } = input;
  if (!settings.says) return null;
  const shares = normalizeMix(settings.mix);
  const play = 1 - shares.helpful - shares.chill;
  if (play < 0.25) return null;
  if (rand() > Math.min(0.9, play + 0.2)) return null;
  const clock =
    hour != null && hour < 7
      ? STOP_ASIDES.early
      : hour != null && hour >= 21
        ? STOP_ASIDES.late
        : [];
  const pool = clock.length && rand() < 0.6 ? clock : STOP_ASIDES[mood];
  return fresh(pool, recent, rand) || null;
}
