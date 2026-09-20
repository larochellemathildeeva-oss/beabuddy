import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

const PLACE_UA = "Mozilla/5.0 (compatible; BeaBot/1.0; +https://bea.travel)";
const MAX_HTML_BYTES = 300_000;
/**
 * A shared Maps link can chain: maps.app.goo.gl -> consent -> google.com/maps.
 * Three hops ran out part way down that chain and returned an empty page,
 * which the caller could not tell apart from a page with nothing in it.
 */
const MAX_REDIRECTS = 5;
/** Five seconds was tight for a cold server reaching a slow site. */
const FETCH_MS = 8_000;

/**
 * Why a fetch produced no HTML.
 *
 * The caller used to get `html: ""` for every one of these — a host we refuse,
 * a network failure, a 403, and a page that genuinely says nothing were all
 * the same empty string. That is why every failure ended up showing the same
 * "paste the long link" advice, including the cases where pasting the long
 * link cannot possibly help.
 */
export type FetchFailure = "blocked-host" | "unreachable" | "http-error" | "bad-url";

export type FetchedHtml = {
  html: string;
  finalUrl: string;
  failure?: FetchFailure;
};

/**
 * Map sites whose URLs carry structured place data in the path or query.
 *
 * This is no longer a fetch gate — see `fetchPlaceHtml` — it only marks the
 * hosts whose links are worth parsing as maps rather than as ordinary pages.
 */
export function isMapHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "goo.gl" ||
    host === "maps.app.goo.gl" ||
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "maps.apple.com" ||
    host.endsWith(".maps.apple.com") ||
    host === "openstreetmap.org" ||
    host.endsWith(".openstreetmap.org") ||
    host === "yelp.com" ||
    host.endsWith(".yelp.com") ||
    host === "tripadvisor.com" ||
    host.endsWith(".tripadvisor.com")
  );
}

function ipv4Octets(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return null;
  return octets;
}

function isBlockedIpv4(octets: number[]): boolean {
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 255 && b === 255) return true;
  // Multicast and the reserved top of the space are not places to fetch from.
  if (a >= 224) return true;
  return false;
}

/**
 * The eight groups of an IPv6 address, or null if it is not one.
 *
 * Needed because the checks below cannot be done on the spelling. `new URL()`
 * canonicalizes an IPv6 host to its shortest hex form, so `[::ffff:127.0.0.1]`
 * arrives here as `::ffff:7f00:1` — which is why the old dotted-quad match on
 * `::ffff:` never fired and loopback was allowed straight through.
 */
function ipv6Groups(host: string): number[] | null {
  if (!host.includes(":")) return null;
  const [head, tail] = host.split("::") as [string, string | undefined];
  const parse = (part: string): number[] | null => {
    if (!part) return [];
    const out: number[] = [];
    for (const piece of part.split(":")) {
      // A trailing dotted quad, as in `::ffff:127.0.0.1`, is two groups.
      const quad = ipv4Octets(piece);
      if (quad) {
        out.push((quad[0]! << 8) | quad[1]!, (quad[2]! << 8) | quad[3]!);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(piece)) return null;
      out.push(parseInt(piece, 16));
    }
    return out;
  };
  const left = parse(head);
  if (!left) return null;
  if (tail === undefined) return left.length === 8 ? left : null;
  const right = parse(tail);
  if (!right) return null;
  const fill = 8 - left.length - right.length;
  if (fill < 0) return null;
  return [...left, ...Array<number>(fill).fill(0), ...right];
}

/** The IPv4 address an IPv6 one carries, for `::ffff:a.b.c.d` and NAT64. */
function embeddedIpv4(groups: number[]): number[] | null {
  const v4 = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255];
  const zeroes = groups.slice(0, 5).every((g) => g === 0);
  if (zeroes && groups[5] === 0xffff) return v4(groups[6]!, groups[7]!);
  // 64:ff9b::/96, the well-known NAT64 prefix, embeds v4 the same way.
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0)) {
    return v4(groups[6]!, groups[7]!);
  }
  return null;
}

/**
 * Whether an address literal is one we refuse to connect to.
 *
 * This works on an address, never on a name, so it is equally valid for a
 * hostname the URL carried and for something DNS just handed back.
 */
function isBlockedAddress(address: string): boolean {
  const host = address
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  const ipv4 = ipv4Octets(host);
  if (ipv4) return isBlockedIpv4(ipv4);

  const groups = ipv6Groups(host);
  if (!groups) return false;

  const mapped = embeddedIpv4(groups);
  if (mapped) return isBlockedIpv4(mapped);

  // Unspecified (`::`, which routes to localhost) and loopback.
  if (groups.every((g) => g === 0)) return true;
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true;
  // fe80::/10 link-local and fc00::/7 unique-local.
  if ((groups[0]! & 0xffc0) === 0xfe80) return true;
  if ((groups[0]! & 0xfe00) === 0xfc00) return true;
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return true;
  if (
    host === "metadata.google.internal" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  return isBlockedAddress(host);
}

export class UnsupportedPlaceUrlError extends Error {
  readonly code = "UNSUPPORTED_PLACE_URL" as const;
  constructor() {
    super("Only web links are supported");
    this.name = "UnsupportedPlaceUrlError";
  }
}

/**
 * https, no credentials, not a private or local host *by name or literal*.
 *
 * This is the cheap first pass and it is not sufficient on its own: a name
 * like `intranet.example.com` says nothing about where it points. Anything
 * that is about to be fetched must also clear `resolvesToPublicAddress`.
 */
export function isPublicHttpsUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (isBlockedHost(url.hostname)) return false;
  return true;
}

/**
 * Resolve the host and refuse it if any answer is an address we will not visit.
 *
 * The spelling check above cannot see this case at all: a perfectly ordinary
 * public name is free to have an A record of 127.0.0.1, and several public
 * wildcard-DNS services exist precisely to provide one. So the name is
 * resolved and every answer inspected before anything is fetched.
 *
 * A caveat worth keeping in view: undici resolves the name again when it
 * connects, so a record that changes between these two lookups is still a
 * window (DNS rebinding). Closing it needs the connection pinned to the
 * address vetted here, via a dispatcher with a custom `lookup` — which means
 * taking undici as a direct dependency — or an egress proxy that enforces the
 * same rule. Both are worth doing; neither is this function.
 */
export async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isIP(host)) return !isBlockedAddress(host);
  try {
    const answers = await dnsLookup(host, { all: true, verbatim: true });
    if (!answers.length) return false;
    return !answers.some((answer) => isBlockedAddress(answer.address));
  } catch {
    // A name that will not resolve is not one we can fetch anyway.
    return false;
  }
}

/** True for a link from a map site, whose URL is worth parsing structurally. */
export function isMapPlaceUrl(url: URL): boolean {
  return isPublicHttpsUrl(url) && isMapHost(url.hostname);
}

function parseHref(href: string, base?: URL): URL | null {
  try {
    return base ? new URL(href, base) : new URL(href);
  } catch {
    return null;
  }
}

async function readCappedText(res: Response): Promise<string> {
  // Content-Length is optional and attacker-supplied. Use it only to skip
  // an already-huge body. The stream abort below is the real cap.
  const announced = Number(res.headers.get("content-length") ?? NaN);
  if (Number.isFinite(announced) && announced > MAX_HTML_BYTES) {
    await res.body?.cancel();
    return "";
  }
  if (!res.body) {
    const text = await res.text();
    return text.slice(0, MAX_HTML_BYTES);
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > MAX_HTML_BYTES) {
      chunks.push(value.subarray(0, value.byteLength - (size - MAX_HTML_BYTES)));
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(out);
}

async function fetchHtmlWithPolicy(
  href: string,
  canFollow: (url: URL) => boolean,
): Promise<FetchedHtml> {
  const start = parseHref(href);
  if (!start) return { html: "", finalUrl: href, failure: "bad-url" };
  if (!isPublicHttpsUrl(start)) {
    throw new UnsupportedPlaceUrlError();
  }
  if (!canFollow(start)) {
    return { html: "", finalUrl: start.toString(), failure: "blocked-host" };
  }

  let current = start;
  for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
    // Where the name actually points, checked on every hop rather than only on
    // the one the person pasted. A redirect is the easy way to reach an address
    // the first URL would never have been allowed to name.
    if (!(await resolvesToPublicAddress(current.hostname))) {
      return { html: "", finalUrl: current.toString(), failure: "blocked-host" };
    }

    let res: Response;
    try {
      res = await fetch(current.toString(), {
        redirect: "manual",
        headers: {
          "user-agent": PLACE_UA,
          // Some servers answer 406, or hand back JSON, without these. They
          // were simply missing, which is a plain bug rather than a policy.
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en;q=0.9,*;q=0.5",
        },
        signal: AbortSignal.timeout(FETCH_MS),
      });
    } catch {
      // DNS failure, TLS failure, timeout, or no egress from this server at
      // all. Worth telling apart from a page that answered and said nothing.
      return { html: "", finalUrl: current.toString(), failure: "unreachable" };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location || hops === MAX_REDIRECTS) {
        return { html: "", finalUrl: current.toString(), failure: "http-error" };
      }
      const next = parseHref(location, current);
      if (!next) {
        return { html: "", finalUrl: current.toString(), failure: "http-error" };
      }
      if (!canFollow(next)) {
        return { html: "", finalUrl: current.toString(), failure: "blocked-host" };
      }
      // The redirect target is where the link really points, so report it even
      // when the hop after it fails — a short link resolves to a Maps URL whose
      // path still carries the place name.
      current = next;
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel();
      return { html: "", finalUrl: current.toString(), failure: "http-error" };
    }
    const html = await readCappedText(res);
    return { html, finalUrl: current.toString() };
  }

  return { html: "", finalUrl: current.toString(), failure: "http-error" };
}

/**
 * GET a pasted place link without `redirect: "follow"`.
 * Each Location is re-checked against the same rules before the next hop.
 *
 * This used to additionally require the host to be one of six map sites. The
 * paste box accepts anything that looks like a link and the copy beside it
 * promises "Maps, Instagram, a blog — anywhere", so every other host was
 * accepted by the interface and then silently dropped here: no request, no
 * error, an empty string, and advice to paste a longer link that could never
 * help. Article imports already fetch arbitrary public https hosts through
 * `fetchPublicHtml` under exactly these guards, so this is the same accepted
 * exposure rather than a new one.
 *
 * Dropping the host list put the whole weight of the SSRF defence on the
 * address rules, and for a while they were carrying less than they looked:
 * the check ran on the hostname as written, so `[::ffff:127.0.0.1]` — which
 * `new URL()` rewrites to `::ffff:7f00:1` — missed the pattern meant to catch
 * it, and any public name with a private A record missed everything. The
 * defence is now the https requirement, an address check that parses IPv6
 * properly, a DNS resolution of the name before each hop, and the per-hop
 * re-check of both.
 */
export async function fetchPlaceHtml(href: string): Promise<FetchedHtml> {
  return fetchHtmlWithPolicy(href, isPublicHttpsUrl);
}

/** GET a public https page (articles, listicles) with the same SSRF guards. */
export async function fetchPublicHtml(href: string): Promise<FetchedHtml> {
  return fetchHtmlWithPolicy(href, isPublicHttpsUrl);
}
