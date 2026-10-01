import { BEA_HELPS, BEA_MISSION, BEA_SIGNATURE, BEA_TAGLINES } from "./bea-voice.ts";

/**
 * The story Béa tells someone who has not signed up yet.
 *
 * Same arc as the launch film in docs/LAUNCH_VIDEO.md — Past You captures,
 * Present You decides, Future You benefits — so the page and the video say the
 * same thing rather than drifting apart. Signature lines come from bea-voice
 * rather than being retyped here, because a tagline that only half matches the
 * app is worse than one the reader has never seen.
 */

/** Which drawing sits beside a scene. Kept as a name so the data stays pure. */
export type SceneFigure =
  "scatter" | "capture" | "vault" | "assemble" | "nearby" | "compare" | "map";

export type Scene = {
  id: string;
  /** Small label above the heading. */
  eyebrow: string;
  heading: string;
  body: string;
  /** Béa's own line for this surface — the one worth remembering. */
  signature: string;
  figure: SceneFigure;
};

export const HOW_SCENES: readonly Scene[] = [
  {
    id: "scatter",
    eyebrow: "The problem",
    heading: "You already found the good places.",
    body: "A friend's voice note. A screenshot of a restaurant. A link someone dropped in a group chat at midnight. Every one of them was a good idea, and every one of them went somewhere different.",
    signature: "You just can't find them again.",
    figure: "scatter",
  },
  {
    id: "assemble",
    eyebrow: "Planning",
    heading: "Béa plans the trip with you.",
    body: "Start a trip and Béa drafts the days from the places you saved, checking for events, strikes and closures on your dates — or reads a plan you already have. She puts each day in a sensible order and gives directions the way you like to get around, which you can keep offline for when there is no signal. Nothing changes until you say so.",
    signature: BEA_SIGNATURE.planning,
    figure: "assemble",
  },
  {
    id: "capture",
    eyebrow: "Capture",
    heading: "Paste a link. Keep the parts you want.",
    body: "Give Béa an article, a map link, a post. It reads the places out of it and shows you what it found — you tick the ones worth keeping. Béa does the filing. The taste stays yours.",
    signature: BEA_TAGLINES.recommendations,
    figure: "capture",
  },
  {
    id: "vault",
    eyebrow: "Your vault",
    heading: "Four kinds of wanting.",
    body: "Visited, Next time, Wishlist, Recommendation. Every place you save carries who told you about it and where it is on the map. Send a handful to a friend and they keep the ones they want, with your name on them.",
    signature: BEA_SIGNATURE.recs,
    figure: "vault",
  },
  {
    id: "nearby",
    eyebrow: "Out in the world",
    heading: "The café you saved eleven months ago is two streets away.",
    body: "Béa notices when you are near something you meant to try, and says so once. No feed, no badge, no streak. Just the thing you would have walked past.",
    signature: BEA_SIGNATURE.near,
    figure: "nearby",
  },
  {
    id: "compare",
    eyebrow: "Deciding",
    heading: "Two plans, one honest answer.",
    body: "Paste both — a friend's plan and one from an AI — and Béa reads each, then says what actually differs day by day and which it would pick. It refuses to invent travel times it cannot measure, and it commits to an answer.",
    signature: BEA_SIGNATURE.choose,
    figure: "compare",
  },
  {
    id: "map",
    eyebrow: "Looking back",
    heading: "The map fills itself in.",
    body: "Connect your photos and Béa reads where they were taken. Years of travel assemble onto one globe, and a trip you plan to a city you have been to shows your own photograph of it.",
    signature: BEA_SIGNATURE.memories,
    figure: "map",
  },
] as const;

export const HOW_CLOSING = {
  /** What she does for you — the page's title and its last word. */
  helps: BEA_HELPS,
  mission: BEA_MISSION,
  tagline: BEA_TAGLINES.strongest,
} as const;

/** What the play button says when a deploy has a film to show. */
export const WATCH_LABEL = "Watch how Béa works";
