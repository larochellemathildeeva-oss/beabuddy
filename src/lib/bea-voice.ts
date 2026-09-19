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

export type BeaMode = "companion" | "archivist" | "scout" | "planner" | "honest" | "curator";

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
  | "plan.locating"
  | "photos.working"
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
      body: "Béa has done her part. The rest involves walking.",
      mode: "scout",
    },
    {
      title: "Remember this?",
      body: "You told Béa to keep this one.",
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
      title: "Béa is mapping out an adventure…",
      body: "Built from the ideas you already saved.",
      mode: "planner",
    },
    {
      title: "Béa is plotting a route…",
      body: "She is turning your saved ideas into actual plans.",
      mode: "planner",
    },
    {
      title: "Béa is choosing the scenic path…",
      body: "The short way is rarely the good way.",
      mode: "planner",
    },
    {
      title: "Béa is organizing the journey…",
      body: "Assembling a trip from what you already care about.",
      mode: "planner",
    },
    {
      title: "Béa is looking for the best fit…",
      body: "Your pace, your budget, your kind of day.",
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
      title: "Béa has drafted a plan.",
      body: "Feel free to take full credit.",
      mode: "planner",
    },
    {
      title: "Done.",
      body: "Béa connected the dots. You can take the credit.",
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
  /**
   * The wait while Béa places a planned trip on the map.
   *
   * Long enough to read a sentence twice, so the pool is deep and starts at a
   * random line: the point is that you meet a new one occasionally rather than
   * the same apology every time. The short-legs joke does real work — it gives
   * the wait a reason you can picture, which a spinner cannot.
   *
   * Several of these are literally true here. She is checking side streets and
   * asking the locals, one lookup a second, because that is what placing a
   * stop actually is.
   */
  "plan.locating": [
    {
      title: "Please be patient.",
      body: "Béa is running as fast as she can. She has little legs.",
      mode: "companion",
    },
    { title: "Tiny legs.", body: "Big thoughts.", mode: "companion" },
    {
      title: "Béa is taking the scenic route to an answer.",
      body: "She will get there. She always does.",
      mode: "companion",
    },
    { title: "Béa is thinking.", body: "This is her cardio.", mode: "honest" },
    {
      title: "Béa is scouting ahead for you…",
      body: "One street at a time.",
      mode: "scout",
    },
    {
      title: "Béa is carrying a lot of recommendations right now.",
      body: "All of them, in fact.",
      mode: "companion",
    },
    {
      title: "Béa is connecting the dots.",
      body: "There are a lot of dots.",
      mode: "honest",
    },
    {
      title: "Béa is checking one more side street…",
      body: "This one looks promising.",
      mode: "scout",
    },
    {
      title: "Béa is asking the locals.",
      body: "They are being very thorough.",
      mode: "scout",
    },
    {
      title: "Béa is unfolding a very large map.",
      body: "It never folds back the same way.",
      mode: "companion",
    },
    {
      title: "Béa is hustling.",
      body: "Her legs disagree.",
      mode: "honest",
    },
    {
      title: "Béa has entered turbo mode.",
      body: "It is still not very turbo.",
      mode: "honest",
    },
    {
      title: "Béa got distracted by a cute café.",
      body: "She is back now.",
      mode: "companion",
    },
    {
      title: "Béa is doing her best ✨",
      body: "Pinning every stop properly rather than guessing.",
      mode: "companion",
    },
    {
      title: "Béa is sniffing out hidden gems…",
      body: "The good ones are never on the main road.",
      mode: "scout",
    },
    {
      title: "Béa is following the scent…",
      body: "This one smells like a find.",
      mode: "scout",
    },
    {
      title: "Béa is looking around one more corner…",
      body: "There is always one more corner.",
      mode: "scout",
    },
    {
      title: "Béa is on the trail of something good…",
      body: "Nose down, tail up.",
      mode: "scout",
    },
    {
      title: "Béa is checking every lead.",
      body: "Thorough is slower. Thorough is also correct.",
      mode: "honest",
    },
  ],
  /**
   * Reading locations out of photographs. The dog vocabulary does the work
   * here without being twee: she is genuinely retracing where you have been.
   */
  "photos.working": [
    {
      title: "Béa is revisiting old adventures…",
      body: "Reading where each photo was taken, nothing else.",
      mode: "archivist",
    },
    {
      title: "Béa is putting memories on the map.",
      body: "One pin per place you have already been.",
      mode: "archivist",
    },
    {
      title: "Béa is finding where you have been.",
      body: "She recognises more of these than you would think.",
      mode: "archivist",
    },
    {
      title: "Béa is looking through your travel memories…",
      body: "Only the locations. The photographs stay yours.",
      mode: "archivist",
    },
  ],
  "choose.working": [
    {
      title: "Béa has opinions.",
      body: "Give Béa a moment.",
      mode: "honest",
    },
    {
      title: "Béa is weighing the options…",
      body: "Extremely biased toward your preferences, as requested.",
      mode: "honest",
    },
    {
      title: "Béa is deciding between good and better.",
      body: BEA_SIGNATURE.choose,
      mode: "honest",
    },
    {
      title: "Béa is comparing paths…",
      body: "Consulting your vault, not the internet.",
      mode: "honest",
    },
    {
      title: "Béa is thinking this through.",
      body: "So you do not have to.",
      mode: "honest",
    },
  ],
  "choose.ready": [
    {
      title: "After consulting your saved places…",
      body: "Her official recommendation is ready.",
      mode: "honest",
    },
    {
      title: "Béa has an opinion.",
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
