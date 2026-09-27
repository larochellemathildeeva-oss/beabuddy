/**
 * Where Béa's videos live, if there are any.
 *
 * The app ships without video. Each film is switched on by its own
 * environment variable (see DEMO_VIDEOS below and docs/DEMO_VIDEOS.md); leave
 * one unset and whatever sits in its place stays exactly as it was, so an
 * unconfigured deploy is never a broken button.
 */

export type DemoVideoSource =
  /** Something a <video> tag can play directly. */
  | { kind: "file"; src: string }
  /** A player page that has to go in an iframe. */
  | { kind: "embed"; src: string };

const FILE_EXTENSIONS = /\.(mp4|webm|ogv|mov)(\?.*)?$/i;

function youTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v) return v;
    const embedded = /^\/(?:embed|shorts|v)\/([^/?#]+)/.exec(url.pathname);
    return embedded?.[1] ?? null;
  }
  return null;
}

function vimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const m = /(\d{6,})/.exec(url.pathname);
  return m?.[1] ?? null;
}

/**
 * Work out how to play whatever was configured.
 *
 * Returns null for anything unrecognised rather than dropping an arbitrary URL
 * into an iframe — a mis-set env var should mean "no video", not "embed a
 * stranger's page inside the app".
 */
export function demoVideoSource(raw: string | null | undefined): DemoVideoSource | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  // A path served by the app itself, e.g. /demo.mp4 in public/.
  if (value.startsWith("/") && !value.startsWith("//")) {
    return FILE_EXTENSIONS.test(value) ? { kind: "file", src: value } : null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const yt = youTubeId(url);
  if (yt) {
    return {
      kind: "embed",
      // -nocookie so a viewer who never presses play is not tracked for it.
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?rel=0&modestbranding=1`,
    };
  }

  const vimeo = vimeoId(url);
  if (vimeo) {
    return { kind: "embed", src: `https://player.vimeo.com/video/${encodeURIComponent(vimeo)}` };
  }

  if (FILE_EXTENSIONS.test(url.pathname)) return { kind: "file", src: url.toString() };

  return null;
}

export type DemoVideoId =
  | "welcome"
  | "walkthrough"
  | "save"
  | "world"
  | "plan"
  | "day"
  | "optimize"
  | "companion"
  | "near"
  | "prep"
  | "memories";

export type DemoVideo = {
  id: DemoVideoId;
  /** The build-time variable holding its URL. */
  envKey: string;
  /** What the button or row says. */
  title: string;
  /** One line under the title: what you will know afterwards. */
  blurb: string;
  /** Roughly how long, as a person would say it. */
  length: string;
};

/**
 * Every film Béa knows how to show, in the order Help lists them.
 *
 * The welcome film keeps the original variable, so a deploy that already set
 * VITE_DEMO_VIDEO_URL keeps its film where it was. The clips each teach one
 * thing and are listed in the order a trip happens — save, plan, go, look
 * back — so that playing them top to bottom is the walkthrough.
 */
export const DEMO_VIDEOS: readonly DemoVideo[] = [
  {
    id: "welcome",
    envKey: "VITE_DEMO_VIDEO_URL",
    title: "Watch how Béa works",
    blurb: "Remember → choose → plan → opportunity → story.",
    length: "About forty seconds",
  },
  {
    id: "walkthrough",
    envKey: "VITE_WALKTHROUGH_VIDEO_URL",
    title: "Béa in five minutes",
    blurb: "The whole app in order, one chapter per feature.",
    length: "About five minutes",
  },
  {
    id: "save",
    envKey: "VITE_CLIP_SAVE_URL",
    title: "Save a place",
    blurb: "Type a name or paste a link, keep who told you, send a few to a friend.",
    length: "About a minute",
  },
  {
    id: "world",
    envKey: "VITE_CLIP_WORLD_URL",
    title: "Your globe",
    blurb: "Where you have been, the four kinds of pin, and Help me choose.",
    length: "About a minute",
  },
  {
    id: "plan",
    envKey: "VITE_CLIP_PLAN_URL",
    title: "Start a trip",
    blurb: "Create one, invite a friend, and let Béa build or import the plan.",
    length: "About a minute",
  },
  {
    id: "day",
    envKey: "VITE_CLIP_DAY_URL",
    title: "The timeline and the map",
    blurb: "Add stops from your saves, bookings, directions, and a map kept for offline.",
    length: "About a minute",
  },
  {
    id: "optimize",
    envKey: "VITE_CLIP_OPTIMIZE_URL",
    title: "Optimize and Compare",
    blurb: "Tighten the route you already have, or weigh two plans side by side.",
    length: "About forty-five seconds",
  },
  {
    id: "companion",
    envKey: "VITE_CLIP_COMPANION_URL",
    title: "On the day",
    blurb: "I'm here, Leaving, and when to set off for the next stop.",
    length: "About forty-five seconds",
  },
  {
    id: "near",
    envKey: "VITE_CLIP_NEAR_URL",
    title: "Near you",
    blurb: "The places you saved, sorted by how close you are, and a day trip from them.",
    length: "About forty-five seconds",
  },
  {
    id: "prep",
    envKey: "VITE_CLIP_PREP_URL",
    title: "To do, packing and documents",
    blurb: "Errands, packing lists, the locked vault, and the budget.",
    length: "About a minute",
  },
  {
    id: "memories",
    envKey: "VITE_CLIP_MEMORIES_URL",
    title: "Photos and memories",
    blurb: "Photos onto the map, a page per city, Future Me notes, and Playback.",
    length: "About a minute",
  },
];

export type ConfiguredVideo = DemoVideo & { source: DemoVideoSource };

type Env = Record<string, string | undefined>;

function viteEnv(): Env {
  if (typeof import.meta === "undefined") return {};
  return (import.meta as { env?: Env }).env ?? {};
}

/**
 * The films this deploy actually has, in catalogue order. Anything unset or
 * unplayable is left out rather than shown as a button that goes nowhere.
 */
export function configuredVideos(env: Env = viteEnv()): ConfiguredVideo[] {
  const out: ConfiguredVideo[] = [];
  for (const video of DEMO_VIDEOS) {
    const source = demoVideoSource(env[video.envKey] ?? null);
    if (source) out.push({ ...video, source });
  }
  return out;
}

/** One film by id, or null when this deploy does not have it. */
export function configuredVideo(id: DemoVideoId, env: Env = viteEnv()): ConfiguredVideo | null {
  return configuredVideos(env).find((v) => v.id === id) ?? null;
}

/** The welcome film's source, or null when this deploy has none. */
export function configuredDemoVideo(env: Env = viteEnv()): DemoVideoSource | null {
  return configuredVideo("welcome", env)?.source ?? null;
}

/** The films Help lists: everything but the welcome film, which has its own homes. */
export function helpVideos(env: Env = viteEnv()): ConfiguredVideo[] {
  return configuredVideos(env).filter((v) => v.id !== "welcome");
}
