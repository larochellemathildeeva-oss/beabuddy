import { DIRECTIONS_WALK_M } from "./route-optimize.ts";

/** How one journey between two stops is made. */
export type LegMode = "walking" | "driving" | "transit";

/**
 * How the traveller gets around, asked before directions are worked out.
 *
 * "auto" is what Béa did before it asked: walk what is close, drive the
 * rest. Someone without a car was told "Drive 12 min" for a stretch they
 * would take the metro for, and every "Leave by" after it was wrong.
 */
export type TravelPreset = "auto" | "walk" | "drive" | "transit";

/**
 * The traveller's own distance rules, kept as one short string
 * ("rules:2:transit:50:driving") so it is stored, sent and compared like a
 * preset: walk under 2 km, transit up to 50 km, drive beyond.
 */
export type TravelRulesKey = `rules:${string}`;

export type TravelChoice = TravelPreset | TravelRulesKey;

/** Walk under `walkKm`; `mid` up to `farKm`; `far` beyond. */
export type TravelRules = {
  walkKm: number;
  mid: LegMode;
  farKm: number;
  far: Exclude<LegMode, "walking">;
};

/** Where "Your own rules" starts the first time it is picked. */
export const DEFAULT_TRAVEL_RULES: TravelRules = {
  walkKm: 2,
  mid: "transit",
  farKm: 50,
  far: "driving",
};

/** The furthest a rule can reach; past this every journey is "beyond". */
export const RULES_MAX_KM = 1_000;

export const TRAVEL_CHOICES: { id: TravelPreset; label: string; detail: string }[] = [
  { id: "auto", label: "Walk what's close", detail: "Walk under 3 km, drive the rest." },
  {
    id: "transit",
    label: "Public transit",
    detail: "Bus, metro and train, walking the short hops.",
  },
  { id: "walk", label: "Walk everywhere", detail: "On foot up to 15 km; longer is driven." },
  { id: "drive", label: "Car", detail: "Every stretch by road." },
];

/**
 * On transit, a journey shorter than this is walked: by the time you reach
 * the stop and wait, you would have been there.
 */
export const TRANSIT_WALK_M = 1_000;

/**
 * Walking everywhere still stops somewhere: past this, the journey is to
 * another town (a city route's legs go through here too), and is driven.
 */
export const WALK_MAX_M = 15_000;

const RULES_RE =
  /^rules:(\d{1,4}(?:\.\d)?):(walking|transit|driving):(\d{1,4}(?:\.\d)?):(transit|driving)$/;

function isPreset(value: unknown): value is TravelPreset {
  return value === "auto" || value === "walk" || value === "drive" || value === "transit";
}

export function isTravelChoice(value: unknown): value is TravelChoice {
  return isPreset(value) || (typeof value === "string" && parseTravelRules(value) != null);
}

/** A rules choice read back; null for a preset or anything malformed. */
export function parseTravelRules(choice: string | null | undefined): TravelRules | null {
  const m = choice ? RULES_RE.exec(choice) : null;
  if (!m) return null;
  const walkKm = Number(m[1]);
  const farKm = Number(m[3]);
  const mid = m[2] as LegMode;
  if (walkKm > WALK_MAX_M / 1000 || farKm > RULES_MAX_KM || farKm < walkKm) return null;
  if (mid === "walking" && farKm > WALK_MAX_M / 1000) return null;
  return { walkKm, mid, farKm, far: m[4] as TravelRules["far"] };
}

function tenth(km: number): number {
  return Number.isFinite(km) ? Math.round(km * 10) / 10 : 0;
}

/**
 * Rules as a choice, tidied so any numbers typed make a valid one: walking
 * stops at `WALK_MAX_M` like "Walk everywhere", and the far edge never
 * comes before the walking one.
 */
export function travelRulesKey(rules: TravelRules): TravelRulesKey {
  const walkKm = Math.min(Math.max(tenth(rules.walkKm), 0), WALK_MAX_M / 1000);
  // A walking middle band stops where walking does, so the summary and the
  // planning prompt never promise a walk that is driven.
  const farMax = rules.mid === "walking" ? WALK_MAX_M / 1000 : RULES_MAX_KM;
  const farKm = Math.min(Math.max(tenth(rules.farKm), walkKm), farMax);
  const far = rules.far === "transit" ? "transit" : "driving";
  return `rules:${walkKm}:${rules.mid}:${farKm}:${far}`;
}

const RULE_VERB: Record<LegMode, string> = {
  walking: "walk",
  transit: "take transit",
  driving: "drive",
};

/** "Walk under 2 km, take transit up to 50 km, drive beyond." */
export function travelRulesSummary(rules: TravelRules): string {
  const bands: { mode: LegMode; toKm: number | null }[] = [];
  const add = (mode: LegMode, toKm: number | null) => {
    const last = bands[bands.length - 1];
    if (last && last.mode === mode) last.toKm = toKm;
    else bands.push({ mode, toKm });
  };
  if (rules.walkKm > 0) add("walking", rules.walkKm);
  if (rules.farKm > rules.walkKm) add(rules.mid, rules.farKm);
  add(rules.far, null);
  const parts = bands.map((band, i) => {
    const verb = RULE_VERB[band.mode];
    if (band.toKm == null) return bands.length === 1 ? `${verb} everywhere` : `${verb} beyond`;
    return `${verb} ${i === 0 ? "under" : "up to"} ${band.toKm} km`;
  });
  const text = parts.join(", ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** The mode for one journey this far apart, as the crow flies. */
export function legModeFor(choice: TravelChoice, straightM: number): LegMode {
  const rules = parseTravelRules(choice);
  if (rules) {
    const mode =
      straightM < rules.walkKm * 1000
        ? "walking"
        : straightM < rules.farKm * 1000
          ? rules.mid
          : rules.far;
    // Like "Walk everywhere": a walk to another town is driven.
    return mode === "walking" && straightM > WALK_MAX_M ? "driving" : mode;
  }
  switch (choice) {
    case "walk":
      return straightM <= WALK_MAX_M ? "walking" : "driving";
    case "drive":
      return "driving";
    case "transit":
      return straightM < TRANSIT_WALK_M ? "walking" : "transit";
    default:
      return straightM < DIRECTIONS_WALK_M ? "walking" : "driving";
  }
}

/** "Walk", "Drive", "Transit": the word a saved row starts with. */
export function modeWord(mode: LegMode): "Walk" | "Drive" | "Transit" {
  return mode === "walking" ? "Walk" : mode === "transit" ? "Transit" : "Drive";
}

/** A saved row's first word read back as its mode; null when it is not one of Béa's. */
export function modeFromWord(word: string): LegMode | null {
  const w = word.trim().toLowerCase();
  if (w === "walk") return "walking";
  if (w === "drive") return "driving";
  if (w === "transit") return "transit";
  return null;
}

/**
 * For the planning prompts: how this traveller gets around, so a drafted or
 * rearranged day suits it. Nothing for "auto", which is Béa's own default
 * and not something the traveller said.
 */
export function travelPrompt(choice: TravelChoice | null | undefined): string {
  if (!choice || choice === "auto") return "";
  const rules = parseTravelRules(choice);
  const how = rules
    ? `by their own rules, by straight-line distance between stops: ${travelRulesSummary(rules)}`
    : choice === "transit"
      ? "by public transit, walking the short hops."
      : choice === "walk"
        ? "on foot wherever they can."
        : choice === "drive"
          ? "by car."
          : "";
  if (!how) return "";
  return `Getting around: the traveller travels ${how} Group each day's stops so the journeys between them suit this, and write any "Getting there" note in these terms.`;
}
