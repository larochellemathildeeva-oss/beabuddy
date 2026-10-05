/**
 * Reading settings under You → Appearance: text size, font, headline font, reduced motion,
 * more contrast and bolder text. One choice for the whole app, kept with the
 * account like the theme (account-settings.ts) and on the device for first
 * paint.
 *
 * They land on `<html>`: the text size as `--text-scale`, which every pixel
 * font size in the CSS is multiplied by (`textScaleVisitor`, run on the CSS at
 * build time), and the rest as `data-*` attributes that styles.css keys off.
 * A font other than Béa's own is fetched from Google Fonts only once chosen.
 */
export const TEXT_SIZES = ["small", "default", "large", "larger", "largest"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.9,
  default: 1,
  large: 1.15,
  larger: 1.3,
  largest: 1.45,
};

export const READING_FONTS = ["bea", "easy", "lexend", "system"] as const;
export type ReadingFont = (typeof READING_FONTS)[number];

/** Google Fonts stylesheets for the fonts Béa does not load already. */
export const FONT_HREF: Partial<Record<ReadingFont, string>> = {
  easy: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;600;700;800&display=swap",
  lexend: "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap",
};

/** The serif for titles. Bodoni Moda is the default; Instrument Serif is the north star's. */
export const HEADLINE_FONTS = ["bodoni", "instrument"] as const;
export type HeadlineFont = (typeof HEADLINE_FONTS)[number];

export type Accessibility = {
  textSize: TextSize;
  font: ReadingFont;
  headline: HeadlineFont;
  reduceMotion: boolean;
  moreContrast: boolean;
  boldText: boolean;
};

export const DEFAULT_ACCESSIBILITY: Accessibility = {
  textSize: "default",
  font: "bea",
  headline: "bodoni",
  reduceMotion: false,
  moreContrast: false,
  boldText: false,
};

export const ACCESSIBILITY_KEY = "bea-accessibility";

function oneOf<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (list as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** The stored text, cleaned: anything unknown or broken is the default. */
export function parseAccessibility(raw: string | null | undefined): Accessibility {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    /* not ours */
  }
  return {
    textSize: oneOf(TEXT_SIZES, data["textSize"], "default"),
    font: oneOf(READING_FONTS, data["font"], "bea"),
    headline: oneOf(HEADLINE_FONTS, data["headline"], "bodoni"),
    reduceMotion: data["reduceMotion"] === true,
    moreContrast: data["moreContrast"] === true,
    boldText: data["boldText"] === true,
  };
}

/** The text to store, or null when everything is the default. */
export function serializeAccessibility(a: Accessibility): string | null {
  const out: Partial<Accessibility> = {};
  if (a.textSize !== "default") out.textSize = a.textSize;
  if (a.font !== "bea") out.font = a.font;
  if (a.headline !== "bodoni") out.headline = a.headline;
  if (a.reduceMotion) out.reduceMotion = true;
  if (a.moreContrast) out.moreContrast = true;
  if (a.boldText) out.boldText = true;
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

type Root = {
  dataset: DOMStringMap;
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): unknown };
};

function flag(root: Root, name: string, value: string | null) {
  if (value === null) delete root.dataset[name];
  else root.dataset[name] = value;
}

const FONT_LINK_ID = "bea-reading-font";

/** Adds the chosen font's stylesheet once; Béa's own fonts are always there. */
function loadFont(font: ReadingFont) {
  const href = FONT_HREF[font];
  if (!href || typeof document === "undefined" || !document.head) return;
  const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (existing?.getAttribute("href") === href) return;
  const link = existing ?? document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  if (!existing) document.head.appendChild(link);
}

export function applyAccessibility(a: Accessibility, root: Root): void {
  if (a.textSize === "default") root.style.removeProperty("--text-scale");
  else root.style.setProperty("--text-scale", String(TEXT_SCALE[a.textSize]));
  flag(root, "font", a.font === "bea" ? null : a.font);
  flag(root, "headline", a.headline === "bodoni" ? null : a.headline);
  flag(root, "motion", a.reduceMotion ? "reduce" : null);
  flag(root, "contrast", a.moreContrast ? "more" : null);
  flag(root, "bold", a.boldText ? "on" : null);
  loadFont(a.font);
}

/**
 * Runs in `<head>` so the reading settings are on before first paint. Kept in
 * step with `parseAccessibility` and `applyAccessibility` by the tests.
 */
export const ACCESSIBILITY_BOOT_SCRIPT = `try{var a=JSON.parse(localStorage.getItem("${ACCESSIBILITY_KEY}")||"null");if(a&&typeof a==="object"){var r=document.documentElement,s=${JSON.stringify(TEXT_SCALE)}[a.textSize];if(typeof s==="number"&&s!==1)r.style.setProperty("--text-scale",String(s));var h=${JSON.stringify(FONT_HREF)}[a.font];if(typeof h==="string"){r.dataset.font=a.font;var l=document.createElement("link");l.id="${FONT_LINK_ID}";l.rel="stylesheet";l.href=h;document.head.appendChild(l)}else if(a.font==="system")r.dataset.font="system";if(a.headline==="instrument")r.dataset.headline="instrument";if(a.reduceMotion===true)r.dataset.motion="reduce";if(a.moreContrast===true)r.dataset.contrast="more";if(a.boldText===true)r.dataset.bold="on"}}catch(e){}`;
