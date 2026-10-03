import { getStored, setStored } from "./settings-storage.ts";

/** The traveller's accent, independent of their Calm / Colorful / Dark theme. */
export const ACCENTS = ["pink", "periwinkle"] as const;
export type AccentName = (typeof ACCENTS)[number];
export const ACCENT_KEY = "bea-accent";
export const DEFAULT_ACCENT: AccentName = "pink";

export function isAccentName(value: unknown): value is AccentName {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}

/** Runs in head before the stylesheet paints; blocked storage still gets Pink. */
export const ACCENT_BOOT_SCRIPT = `var a="${DEFAULT_ACCENT}";try{var s=localStorage.getItem("${ACCENT_KEY}");if(s==="pink"||s==="periwinkle")a=s}catch(e){}document.documentElement.setAttribute("data-accent",a);`;

export function readAccent(): AccentName {
  if (typeof document !== "undefined") {
    const live = document.documentElement.getAttribute("data-accent");
    if (isAccentName(live)) return live;
  }
  const saved = getStored(ACCENT_KEY);
  return isAccentName(saved) ? saved : DEFAULT_ACCENT;
}

export function applyAccent(accent: AccentName): void {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-accent", accent);
  setStored(ACCENT_KEY, accent);
}
