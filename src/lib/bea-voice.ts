/**
 * Béa's voice — product architecture, not decoration.
 *
 * Philosophy (see docs/WHAT_BEA_BELIEVES.md + docs/BRANDING.md):
 *   Past You captures → Present You decides → Future You benefits.
 * Position: the place where your travel life lives — not an AI trip generator.
 *
 * Modes: Companion, Archivist, Scout, Planner, Honest AI, Curator.
 * Every line should explain, encourage, or reassure. Humor is optional.
 * Rotate sparsely — high-personality moments only.
 */

export type BeaMode =
  | "companion"
  | "archivist"
  | "scout"
  | "planner"
  | "honest"
  | "curator";

export type BeaLine = {
  title: string;
  body?: string;
  mode: BeaMode;
};

/** One line for site, store, deck, and onboarding. */
export const BEA_MISSION =
  "Béa remembers your travel life so Future You doesn't miss what matters.";

/** Position — use in landing and meta, never “AI travel planner”. */
export const BEA_POSITION = "Your travel life, all in one place.";

export const BEA_TAGLINES = {
  strongest: "Remember everywhere. Go anywhere.",
  personality: "Travel dreams, properly organized.",
  futureYou: "A gift from Present You to Future You.",
  travelLife: BEA_POSITION,
  recommendations: "Never lose a good recommendation again.",
  companion: "I remember travel things so you don't have to.",
} as const;

/** Hard-coded signature per major surface — the line testers should remember. */
export const BEA_SIGNATURE = {
  world: BEA_POSITION,
  recs: "Future You has excellent taste.",
  near: "Past You left a breadcrumb.",
  planning: "Professionally assembled from your own excellent ideas.",
  memories: "Some places become recurring characters.",
  playback: "Let's rewind the adventure.",
  choose: "Choosing is harder than dreaming.",
} as const;

export type BeaMoment =
  | "recs.saved"
  | "near.nearby"
  | "near.empty"
  | "empty.globe"
  | "empty.recs"
  | "empty.trips"
  | "empty.home"
  | "plan.working"
  | "plan.ready"
  | "plan.complete"
  | "choose.working"
  | "choose.ready";

const POOLS: Record<BeaMoment, readonly BeaLine[]> = {
  "recs.saved": [
    { title: "Saved.", body: BEA_SIGNATURE.recs, mode: "companion" },
    {
      title: "Recommendation secured.",
      body: "A gift from Present You to Future You.",
      mode: "companion",
    },
    {
      title: "Added to the vault.",
      body: "Another shiny travel idea for the collection.",
      mode: "archivist",
    },
    {
      title: "Tiny travel dream successfully archived.",
      body: BEA_SIGNATURE.recs,
      mode: "archivist",
    },
  ],
  "near.nearby": [
    { title: "Psst…", body: BEA_SIGNATURE.near, mode: "scout" },
    {
      title: "You're standing surprisingly close to a good idea.",
      body: "I've done my part. The rest involves walking.",
      mode: "scout",
    },
    {
      title: "Remember this?",
      body: "You made me save it.",
      mode: "scout",
    },
    {
      title: "Past You would like a word.",
      body: BEA_SIGNATURE.near,
      mode: "scout",
    },
  ],
  "near.empty": [
    {
      title: "Nothing nearby today.",
      body: "The adventure appears to be hiding.",
      mode: "scout",
    },
    {
      title: "No breadcrumbs in range.",
      body: "Widen the radius, or keep wandering.",
      mode: "scout",
    },
  ],
  "empty.globe": [
    {
      title: "A fresh globe.",
      body: "Dangerously full of possibilities.",
      mode: "companion",
    },
    {
      title: "Your globe looks wonderfully unexplored.",
      body: BEA_SIGNATURE.world,
      mode: "companion",
    },
  ],
  "empty.recs": [
    {
      title: "No recommendations yet.",
      body: "Either your friends never travel, or they keep texting you at 2 a.m.",
      mode: "companion",
    },
    {
      title: "Nothing saved.",
      body: "Either you're very decisive or very optimistic.",
      mode: "companion",
    },
  ],
  "empty.trips": [
    {
      title: "No trips planned.",
      body: "No pressure. Daydreaming counts too.",
      mode: "companion",
    },
    {
      title: "No trips planned.",
      body: "Daydreaming still counts.",
      mode: "companion",
    },
  ],
  "empty.home": [
    {
      title: "A fresh globe.",
      body: "Dangerously full of possibilities — let's add your first place.",
      mode: "companion",
    },
    {
      title: "Your vault looks wonderfully unexplored.",
      body: "Import photos, save a tip, or load sample data to try the walk.",
      mode: "companion",
    },
  ],
  "plan.working": [
    {
      title: "One moment…",
      body: "I'm turning your saved ideas into actual plans.",
      mode: "planner",
    },
    {
      title: "Working…",
      body: "Assembling a trip from what you already care about.",
      mode: "planner",
    },
  ],
  "plan.ready": [
    {
      title: "Done.",
      body: BEA_SIGNATURE.planning,
      mode: "planner",
    },
    {
      title: "I've drafted a plan.",
      body: "Feel free to take full credit.",
      mode: "planner",
    },
    {
      title: "Done.",
      body: "I have connected the dots. You can take the credit.",
      mode: "planner",
    },
  ],
  "plan.complete": [
    {
      title: "On the timeline.",
      body: BEA_SIGNATURE.planning,
      mode: "planner",
    },
    {
      title: "Saved to the trip.",
      body: "This should be easier on your future self.",
      mode: "planner",
    },
  ],
  "choose.working": [
    {
      title: "Time for a completely unbiased ranking.",
      body: "Extremely biased toward your preferences, actually.",
      mode: "honest",
    },
    {
      title: "Consulting your vault…",
      body: BEA_SIGNATURE.choose,
      mode: "honest",
    },
  ],
  "choose.ready": [
    {
      title: "After consulting your saved places…",
      body: "My official recommendation is ready.",
      mode: "honest",
    },
    {
      title: "I have an opinion.",
      body: "Confidence: grounded in what you already saved.",
      mode: "honest",
    },
  ],
};

function dayIndex(at: Date): number {
  return Math.floor(at.getTime() / 86_400_000);
}

/** Stable-ish rotation so the same day feels consistent, different days vary. */
export function beaLine(moment: BeaMoment, at = new Date()): BeaLine {
  const pool = POOLS[moment];
  const i = ((dayIndex(at) % pool.length) + pool.length) % pool.length;
  return pool[i]!;
}

/** Scout line for a Near card — prefer distance when we have metres. */
export function nearCardLine(metres: number, at = new Date()): BeaLine {
  if (Number.isFinite(metres) && metres < 800) {
    const rounded = metres < 100 ? Math.round(metres) : Math.round(metres / 10) * 10;
    return {
      title: BEA_SIGNATURE.near,
      body: `You're ${rounded} m from something Past You cared about.`,
      mode: "scout",
    };
  }
  return beaLine("near.nearby", at);
}

export function beaMomentPool(moment: BeaMoment): readonly BeaLine[] {
  return POOLS[moment];
}
