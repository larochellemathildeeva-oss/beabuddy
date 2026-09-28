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
/** Wikivoyage banners are about 7:1, so they are asked wider still to stay sharp when cropped. */
export const WIKIVOYAGE_BANNER_WIDTH = 2048;

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

/**
 * Where a place's photo may be: a file a mapper named, its Wikidata item, or
 * both — the item is where to look when the named file is not a good photo.
 */
export type CommonsRef =
  { file: string; wikidata?: string } | { file?: undefined; wikidata: string };

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
  // Only the place's own item: `brand:wikidata` is the chain, not this branch.
  const wikidata = wikidataId(tags["wikidata"]);
  if (file) return wikidata ? { file, wikidata } : { file };
  return wikidata ? { wikidata } : null;
}

/** Asks Commons for a file's thumbnail, page and credit. */
export function commonsImageInfoUrl(file: string, width = COMMONS_THUMB_WIDTH): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    ...IMAGE_INFO,
    iiurlwidth: String(width),
    titles: `File:${file}`,
  });
  return `${COMMONS_API}?${params.toString()}`;
}

const IMAGE_INFO = {
  prop: "imageinfo",
  iiprop: "url|size|mime|extmetadata",
  iiextmetadatafilter: "Artist|LicenseShortName|Restrictions|Assessments",
};

/**
 * Asks Commons for the files in a category with their credit and ratings, so
 * the best-rated photo of a place can be picked when its own image is poor.
 */
export function commonsCategoryFilesUrl(
  category: string,
  width = COMMONS_THUMB_WIDTH,
  from: Record<string, string> = {},
): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "categorymembers",
    gcmtitle: `Category:${category.replace(/^category:/i, "").trim()}`,
    gcmtype: "file",
    gcmlimit: "50",
    ...IMAGE_INFO,
    iiurlwidth: String(width),
    ...from,
  });
  return `${COMMONS_API}?${params.toString()}`;
}

/** Where the next page of an answer starts (its `continue`), or null on the last page. */
export function readContinue(json: unknown): Record<string, string> | null {
  const cont = (json as { continue?: unknown })?.continue;
  if (!cont || typeof cont !== "object") return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cont)) if (typeof v === "string") out[k] = v;
  return Object.keys(out).length ? out : null;
}

/**
 * The Wikidata statements Béa reads for a picture: "image" (P18), the
 * Wikivoyage banner (P948) and the item's Commons category (P373).
 */
export type WikidataPictureProperty = "P18" | "P948" | "P373";

/** Asks Wikidata for one of an item's picture statements. */
export function wikidataImageUrl(id: string, property: WikidataPictureProperty = "P18"): string {
  const params = new URLSearchParams({
    action: "wbgetclaims",
    format: "json",
    entity: id,
    property,
  });
  return `${WIKIDATA_API}?${params.toString()}`;
}

/** The value of an item's preferred (else first non-deprecated) statement. */
function readClaimValue(json: unknown, property: WikidataPictureProperty): unknown {
  const claims = (json as { claims?: Record<string, unknown> })?.claims?.[property];
  if (!Array.isArray(claims)) return null;
  const pick =
    claims.find((c) => (c as { rank?: string })?.rank === "preferred") ??
    claims.find((c) => (c as { rank?: string })?.rank !== "deprecated");
  return (pick as { mainsnak?: { datavalue?: { value?: unknown } } })?.mainsnak?.datavalue?.value;
}

/** The file named by a Wikidata item's image (P18) or banner (P948), or null. */
export function readWikidataImage(json: unknown, property: "P18" | "P948" = "P18"): string | null {
  return commonsFileName(readClaimValue(json, property));
}

/** The Commons category (P373) of a Wikidata item, or null. */
export function readWikidataCategory(json: unknown): string | null {
  const value = readClaimValue(json, "P373");
  if (typeof value !== "string") return null;
  const name = value.replace(/^category:/i, "").trim();
  return name && name.length <= 250 ? name : null;
}

const COMMONS_IMAGE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

type ExtMeta = Record<string, { value?: unknown } | undefined>;
type ImageInfo = {
  width?: number;
  height?: number;
  mime?: string;
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
 * How a photo is judged before it is shown. A place picture must be a real
 * photograph (JPEG or WebP: drawings, maps, logos and scans are PNG, SVG, GIF
 * or TIFF), large enough to look sharp, and not a strip so tall that a wide
 * card crops it to a sliver. A Wikivoyage banner is chosen by people for exactly
 * this use, so it is only checked for size.
 */
export type PhotoUse = "place" | "banner";

const MIN_SHORT_SIDE = 600;
const MIN_BANNER_WIDTH = 1200;
/**
 * Towers and cathedrals are rightly photographed upright, so portrait is fine;
 * only a strip taller than 2:1 is refused, which a card's crop would lose.
 */
const MAX_PORTRAIT = 2;

/** Commons' own ratings, best first: featured, quality, valued. */
const ASSESSMENT_RANK: [RegExp, number][] = [
  [/featured/i, 3],
  [/quality/i, 2],
  [/valued/i, 1],
];

export type RatedPhoto = PlacePhoto & { rating: number; wide: boolean };

/** One file's imageinfo, as a photo fit for `use`, or null. */
function readImageInfo(
  page: { missing?: boolean; imageinfo?: ImageInfo[] } | undefined,
  use: PhotoUse,
): RatedPhoto | null {
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
  const width = typeof info.width === "number" ? info.width : 0;
  const height = typeof info.height === "number" ? info.height : 0;
  if (!width || !height) return null;
  if (use === "banner") {
    if (width < MIN_BANNER_WIDTH || height > width) return null;
  } else {
    if (info.mime !== "image/jpeg" && info.mime !== "image/webp") return null;
    if (Math.min(width, height) < MIN_SHORT_SIDE) return null;
    if (height > width * MAX_PORTRAIT) return null;
  }
  const meta = info.extmetadata ?? {};
  if (plain(meta["Restrictions"]?.value, 200)) return null;
  const author = plain(meta["Artist"]?.value, 120);
  const license = plain(meta["LicenseShortName"]?.value, 60);
  if (!author || !license) return null;
  const assessed = plain(meta["Assessments"]?.value, 200) ?? "";
  const rating = ASSESSMENT_RANK.find(([re]) => re.test(assessed))?.[1] ?? 0;
  return {
    url: thumb.toString(),
    ...(typeof info.thumbwidth === "number" ? { width: info.thumbwidth } : {}),
    ...(typeof info.thumbheight === "number" ? { height: info.thumbheight } : {}),
    page: described.toString(),
    author,
    license,
    rating,
    wide: width >= height,
  };
}

function asPhoto(rated: RatedPhoto | null): PlacePhoto | null {
  if (!rated) return null;
  const { rating: _rating, wide: _wide, ...photo } = rated;
  return photo;
}

/**
 * The photo in a Commons imageinfo answer for one file, or null when the file
 * is missing, is not a good enough photo for `use`, is not on Wikimedia's own
 * servers, has no author or licence to credit, or carries restrictions beyond
 * its licence (trademarks, personality rights) that Béa cannot honour by
 * crediting it.
 */
export function readCommonsImage(json: unknown, use: PhotoUse = "place"): PlacePhoto | null {
  const pages = (json as { query?: { pages?: unknown } })?.query?.pages;
  if (!Array.isArray(pages)) return null;
  return asPhoto(readImageInfo(pages[0] as Parameters<typeof readImageInfo>[0], use));
}

/**
 * The best photo in a category's files: only ones Commons' reviewers rated
 * (featured, quality or valued), so an unrated snapshot is never picked just
 * for being there; the highest rating first, then landscape, then the first
 * listed. Takes one answer or several pages of one.
 */
export function readBestCategoryImage(json: unknown | unknown[]): PlacePhoto | null {
  const answers = Array.isArray(json) ? json : [json];
  const pages = answers.flatMap((a) => {
    const p = (a as { query?: { pages?: unknown } })?.query?.pages;
    return Array.isArray(p) ? p : [];
  });
  let best: RatedPhoto | null = null;
  for (const page of pages) {
    const photo = readImageInfo(page as Parameters<typeof readImageInfo>[0], "place");
    if (!photo || photo.rating === 0) continue;
    if (
      !best ||
      photo.rating > best.rating ||
      (photo.rating === best.rating && photo.wide && !best.wide)
    ) {
      best = photo;
    }
  }
  return asPhoto(best);
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
