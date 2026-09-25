/**
 * Reading an itinerary from a link.
 *
 * Tour pages, blog itineraries and shared plans are mostly links, and the
 * only way in used to be copying the page's text by hand. A link pasted on
 * its own is opened on the server (through the same guarded fetch place links
 * use) and read like pasted text — or, when it turns out to be a calendar
 * feed, read like a calendar file, with no AI call.
 */
import { htmlToPlainText } from "./html-text.ts";
import { looksLikeIcs } from "./itinerary-ics.ts";

/** As much page text as a pasted plan may hold. */
export const LINK_TEXT_MAX = 20_000;

/**
 * The link, when what was pasted is a single link and nothing else.
 *
 * A plan with a link inside it is still a plan: only a lone link is opened.
 * `webcal://` is how calendar apps share a feed, and is https underneath.
 * Plain http is asked for over https.
 */
export function pastedLink(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const href = trimmed.replace(/^webcal:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname.includes(".")) return null;
  // Béa only opens https pages; nearly every site that serves http serves both.
  url.protocol = "https:";
  return url.toString();
}

export type FetchedPage = {
  html: string;
  failure?: "blocked-host" | "unreachable" | "http-error" | "bad-url";
};

export type LinkContent =
  | { kind: "calendar"; text: string }
  | { kind: "page"; text: string }
  | { kind: "failed"; message: string };

/** What a fetched link turned out to hold, or what to tell the traveller. */
export function readFetchedLink(fetched: FetchedPage, host: string): LinkContent {
  const site = host.replace(/^www\./, "") || "that site";
  switch (fetched.failure) {
    case "unreachable":
    case "bad-url":
      return {
        kind: "failed",
        message: `Béa couldn't reach ${site} just now. Try again, or copy the plan from the page and paste it here.`,
      };
    case "blocked-host":
      return {
        kind: "failed",
        message: "Use a normal https link — not a private or local address.",
      };
    case "http-error":
      return {
        kind: "failed",
        message: `${site} didn't open for Béa — it may need a login. Copy the plan from the page and paste it here instead.`,
      };
  }
  const body = fetched.html;
  if (looksLikeIcs(body)) return { kind: "calendar", text: body };
  if (body.startsWith("%PDF-")) {
    return {
      kind: "failed",
      message: "That link is a PDF. Download it, then add it with “Add a PDF”.",
    };
  }
  const text = htmlToPlainText(body, LINK_TEXT_MAX);
  if (text.length < 40) {
    return {
      kind: "failed",
      message: `${site} didn't send any readable text — it may build the page in the browser. Copy the plan from the page and paste it here instead.`,
    };
  }
  return { kind: "page", text };
}
