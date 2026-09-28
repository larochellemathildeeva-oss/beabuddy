import { htmlToPlainText } from "./html-text.ts";

/**
 * A photograph of a place from Wikimedia Commons, found through the tags
 * OpenStreetMap already carries: `wikimedia_commons` (a file), `image` (a
 * link to one) or `wikidata` (whose "image" statement, P18, names one).
 *
 * Commons files are free to show with their author and licence beside them,
 * which is what `photoCredit` is for — the picture is never shown without it.
 * Pure URL building and reading, tested; the fetching is in
 * wikimedia.server.ts.
 */

export const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
export const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
export const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
/** Wide enough for a card on a phone at 2x, small enough to load on a trip. */
export const COMMONS_THUMB_WIDTH = 640;
/** A trip banner spans the screen, so its photo is asked for wider. */
export const COMMONS_BANNER_WIDTH = 1024;

export type PlacePhoto = {
  /** The thumbnail, on thumb.wikimedia.org or upload.wikimedia.org. */
  url: string;
  width?: number;
  height?: number;
  /** The file's page on Commons, where its full credit and licence live. */
  page: string;
  author: string;
  license: string;
};

export type CommonsRef = { file: string } | { wikidata: string };

/** "File:Foo.jpg", "Foo.jpg" or a Commons link to it → "Foo.jpg". Categories are not files. */
export function commonsFileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) {
    let url: URL;
    try {
      url = new URL(v);
    } catch {
      return null;
    }
    if (!/(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/i.test(url.hostname)) return null;
    // The file's page, Special:FilePath, or the image itself on upload.wikimedia.org
    // (/wikipedia/commons/a/ab/Name.jpg, or its /thumb/…/640px-Name.jpg).
    const m =
      /\/wiki\/(?:File|Image|Special:FilePath)[:/](.+)$/i.exec(url.pathname) ??
      (url.hostname === "upload.wikimedia.org"
        ? /^\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i.exec(url.pathname)
        : null);
    if (!m?.[1]) return null;
    try {
      v = decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  } else {
    if (/^category:/i.test(v)) return null;
    v = v.replace(/^(file|image):/i, "");
  }
  v = v.replace(/_/g, " ").trim();
  // A file has an extension Commons can thumbnail; anything else is a guess.
  return /\.(jpe?g|png|webp|gif|tiff?)$/i.test(v) ? v : null;
}

export function wikidataId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^\s*(Q[1-9]\d{0,9})\s*$/i.exec(value);
  return m?.[1] ? m[1].toUpperCase() : null;
}

/**
 * Where to look for a place's photo in its OpenStreetMap tags, a named file
 * first — it is the picture a mapper chose — then its Wikidata item.
 */
export function commonsRefFromTags(tags: Record<string, unknown>): CommonsRef | null {
  const file = commonsFileName(tags["wikimedia_commons"]) ?? commonsFileName(tags["image"]);
  if (file) return { file };
  // Only the place's own item: `brand:wikidata` is the chain, not this branch.
  const wikidata = wikidataId(tags["wikidata"]);
  return wikidata ? { wikidata } : null;
}

/** Asks Commons for a file's thumbnail, page and credit. */
export function commonsImageInfoUrl(file: string, width = COMMONS_THUMB_WIDTH): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(width),
    iiextmetadatafilter: "Artist|LicenseShortName|Restrictions",
    titles: `File:${file}`,
  });
  return `${COMMONS_API}?${params.toString()}`;
}

/** Asks Wikidata for an item's "image" (P18) statement. */
export function wikidataImageUrl(id: string): string {
  const params = new URLSearchParams({
    action: "wbgetclaims",
    format: "json",
    entity: id,
    property: "P18",
  });
  return `${WIKIDATA_API}?${params.toString()}`;
}

/** The first file named by a Wikidata item's P18 statements, or null. */
export function readWikidataImage(json: unknown): string | null {
  const claims = (json as { claims?: { P18?: unknown } })?.claims?.P18;
  if (!Array.isArray(claims)) return null;
  const pick =
    claims.find((c) => (c as { rank?: string })?.rank === "preferred") ??
    claims.find((c) => (c as { rank?: string })?.rank !== "deprecated");
  const value = (pick as { mainsnak?: { datavalue?: { value?: unknown } } })?.mainsnak?.datavalue
    ?.value;
  return commonsFileName(value);
}

const COMMONS_IMAGE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

type ExtMeta = Record<string, { value?: unknown } | undefined>;
type ImageInfo = {
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  descriptionurl?: string;
  extmetadata?: ExtMeta;
};

const plain = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const text = htmlToPlainText(v, max).replace(/\s+/g, " ").trim();
  return text || undefined;
};

/**
 * The photo in a Commons imageinfo answer, or null when the file is missing,
 * is not on upload.wikimedia.org, has no author or licence to credit, or
 * carries restrictions beyond its licence (trademarks, personality rights)
 * that Béa cannot honour by crediting it.
 */
export function readCommonsImage(json: unknown): PlacePhoto | null {
  const pages = (json as { query?: { pages?: unknown } })?.query?.pages;
  if (!Array.isArray(pages)) return null;
  const page = pages[0] as { missing?: boolean; imageinfo?: ImageInfo[] } | undefined;
  const info = page?.missing ? undefined : page?.imageinfo?.[0];
  if (!info?.thumburl || !info.descriptionurl) return null;
  let thumb: URL;
  let described: URL;
  try {
    thumb = new URL(info.thumburl);
    described = new URL(info.descriptionurl);
  } catch {
    return null;
  }
  // Commons serves thumbnails from thumb.wikimedia.org, older ones and
  // unscaled files from upload.wikimedia.org.
  if (thumb.protocol !== "https:" || !COMMONS_IMAGE_HOSTS.has(thumb.hostname)) return null;
  if (described.protocol !== "https:" || !described.hostname.endsWith("wikimedia.org")) return null;
  const meta = info.extmetadata ?? {};
  if (plain(meta["Restrictions"]?.value, 200)) return null;
  const author = plain(meta["Artist"]?.value, 120);
  const license = plain(meta["LicenseShortName"]?.value, 60);
  if (!author || !license) return null;
  return {
    url: thumb.toString(),
    ...(typeof info.thumbwidth === "number" ? { width: info.thumbwidth } : {}),
    ...(typeof info.thumbheight === "number" ? { height: info.thumbheight } : {}),
    page: described.toString(),
    author,
    license,
  };
}

/**
 * The Wikipedia articles that may be a trip's town, best first: "Kyoto,
 * Japan" before "Kyoto", so a town that shares its name with another lands
 * on the right one when Wikipedia has such a page. Only the town's own name
 * is used — "Kyoto, Kyoto Prefecture, Japan" is asked as "Kyoto".
 */
export function townTitles(city: string | null | undefined, country?: string | null): string[] {
  const town = (city ?? "").split(",")[0]?.trim().slice(0, 100) ?? "";
  if (!town) return [];
  const land = (country ?? "").trim().slice(0, 100);
  return land && land.toLowerCase() !== town.toLowerCase() ? [`${town}, ${land}`, town] : [town];
}

/** Asks Wikipedia which Wikidata item each title is, following redirects. */
export function wikipediaItemsUrl(titles: string[]): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "pageprops",
    ppprop: "wikibase_item|disambiguation",
    titles: titles.join("|"),
  });
  return `${WIKIPEDIA_API}?${params.toString()}`;
}

/**
 * The Wikidata item of the first title, in the order asked, that is a real
 * article — not missing, not a disambiguation page ("Portland" is one).
 */
export function readWikipediaItem(json: unknown, titles: string[]): string | null {
  const q = (json as { query?: Record<string, unknown> })?.query;
  if (!q) return null;
  // Wikipedia normalises and follows redirects; map each asked title to the page it became.
  const hop = new Map<string, string>();
  for (const key of ["normalized", "redirects"]) {
    const list = q[key];
    if (!Array.isArray(list)) continue;
    for (const r of list as { from?: unknown; to?: unknown }[]) {
      if (typeof r?.from === "string" && typeof r?.to === "string") hop.set(r.from, r.to);
    }
  }
  const pages = Array.isArray(q["pages"])
    ? (q["pages"] as {
        title?: string;
        missing?: boolean;
        pageprops?: { wikibase_item?: unknown; disambiguation?: unknown };
      }[])
    : [];
  for (const asked of titles) {
    let title = asked;
    for (let i = 0; i < 3 && hop.has(title); i++) title = hop.get(title)!;
    const page = pages.find((p) => p?.title === title);
    if (!page || page.missing || page.pageprops?.disambiguation !== undefined) continue;
    const id = wikidataId(page.pageprops?.wikibase_item);
    if (id) return id;
  }
  return null;
}

/** "Photo: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons" */
export function photoCredit(photo: Pick<PlacePhoto, "author" | "license">): string {
  return `Photo: ${photo.author} · ${photo.license} · Wikimedia Commons`;
}
