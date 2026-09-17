/**
 * Where the demo video lives, if there is one.
 *
 * The app ships without a video. Set VITE_DEMO_VIDEO_URL and the replay tour
 * offers it in place of the written walk; leave it unset and the walk stays,
 * so an unconfigured deploy is never a broken button.
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

/** The configured source, or null when this deploy has no video. */
export function configuredDemoVideo(): DemoVideoSource | null {
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string | undefined> }).env?.["VITE_DEMO_VIDEO_URL"]
      : undefined;
  return demoVideoSource(fromVite ?? null);
}
