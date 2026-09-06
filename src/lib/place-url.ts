const PLACE_UA = "Mozilla/5.0 (compatible; BeaBot/1.0)";
const MAX_HTML_BYTES = 300_000;
const MAX_REDIRECTS = 3;
const FETCH_MS = 5_000;

/** Hosts we will actually GET. Short-link hosts are here so we can follow them hop by hop. */
function isPlaceHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "goo.gl" ||
    host === "maps.app.goo.gl" ||
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "openstreetmap.org" ||
    host.endsWith(".openstreetmap.org") ||
    host === "yelp.com" ||
    host.endsWith(".yelp.com") ||
    host === "tripadvisor.com" ||
    host.endsWith(".tripadvisor.com")
  ) {
    return true;
  }
  return false;
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
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "metadata.google.internal" || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  const ipv4 = ipv4Octets(host);
  if (ipv4) return isBlockedIpv4(ipv4);
  if (host.includes(":")) {
    const h = host.toLowerCase();
    if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
    if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(h);
    if (mapped) {
      const octets = ipv4Octets(mapped[1]!);
      if (octets && isBlockedIpv4(octets)) return true;
    }
  }
  return false;
}

export class UnsupportedPlaceUrlError extends Error {
  readonly code = "UNSUPPORTED_PLACE_URL" as const;
  constructor() {
    super("Only web links are supported");
    this.name = "UnsupportedPlaceUrlError";
  }
}

/** https, no credentials, not a private or local host. */
export function isPublicHttpsUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (isBlockedHost(url.hostname)) return false;
  return true;
}

/** Full hop check: public https, and on the place allowlist. */
export function isFetchablePlaceUrl(url: URL): boolean {
  return isPublicHttpsUrl(url) && isPlaceHost(url.hostname);
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
): Promise<{ html: string; finalUrl: string }> {
  const start = parseHref(href);
  if (!start) return { html: "", finalUrl: href };
  if (!isPublicHttpsUrl(start)) {
    throw new UnsupportedPlaceUrlError();
  }
  if (!canFollow(start)) {
    return { html: "", finalUrl: start.toString() };
  }

  let current = start;
  for (let hops = 0; hops <= MAX_REDIRECTS; hops++) {
    const res = await fetch(current.toString(), {
      redirect: "manual",
      headers: { "user-agent": PLACE_UA },
      signal: AbortSignal.timeout(FETCH_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location || hops === MAX_REDIRECTS) {
        return { html: "", finalUrl: current.toString() };
      }
      const next = parseHref(location, current);
      if (!next || !canFollow(next)) {
        return { html: "", finalUrl: current.toString() };
      }
      current = next;
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel();
      return { html: "", finalUrl: current.toString() };
    }
    const html = await readCappedText(res);
    return { html, finalUrl: current.toString() };
  }

  return { html: "", finalUrl: current.toString() };
}

/**
 * GET a pasted place link without `redirect: "follow"`.
 * Each Location is run through the same allowlist + IP rules before the next hop is requested.
 */
export async function fetchPlaceHtml(href: string): Promise<{ html: string; finalUrl: string }> {
  return fetchHtmlWithPolicy(href, isFetchablePlaceUrl);
}

/** GET a public https page (articles, listicles) with the same SSRF guards, no host allowlist. */
export async function fetchPublicHtml(href: string): Promise<{ html: string; finalUrl: string }> {
  return fetchHtmlWithPolicy(href, isPublicHttpsUrl);
}
