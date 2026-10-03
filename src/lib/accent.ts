import { getStored, setStored } from "./settings-storage.ts";

/** The traveller's accent, independent of their Calm / Colorful / Dark theme. */
export const ACCENT_OPTIONS = [
  { name: "pink", label: "Pink" },
  { name: "periwinkle", label: "Periwinkle" },
] as const;
export type AccentName = (typeof ACCENT_OPTIONS)[number]["name"];
export const ACCENTS = ACCENT_OPTIONS.map(({ name }) => name);
export const ACCENT_KEY = "bea-accent";
export const DEFAULT_ACCENT: AccentName = "pink";

export function isAccentName(value: unknown): value is AccentName {
  return typeof value === "string" && (ACCENTS as readonly string[]).includes(value);
}

/** Runs in head before the stylesheet paints; blocked storage still gets Pink. */
export const ACCENT_BOOT_SCRIPT = `var a=${JSON.stringify(DEFAULT_ACCENT)};try{var s=localStorage.getItem(${JSON.stringify(ACCENT_KEY)});if(${JSON.stringify(ACCENTS)}.includes(s))a=s}catch(e){}document.documentElement.setAttribute("data-accent",a);`;

export function readAccent(): AccentName {
  if (typeof document !== "undefined") {
    const live = document.documentElement.getAttribute("data-accent");
    if (isAccentName(live)) return live;
  }
  const saved = getStored(ACCENT_KEY);
  return isAccentName(saved) ? saved : DEFAULT_ACCENT;
}

export function applyAccent(accent: AccentName, persist = true): void {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-accent", accent);
  if (persist) setStored(ACCENT_KEY, accent);
}
