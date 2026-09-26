/**
 * Béa's three looks, picked on the You page and kept on this device.
 *
 *   calm     — white, cream and light beige (the default)
 *   colorful — soft pastels with a coral accent
 *   dark     — near-black with off-white and beige
 *
 * The choice lands on `<html>` twice: as `data-theme`, which selects the
 * palette in styles.css, and as the `dark` class for Dark, which Tailwind's
 * `dark:` variant and the browser's `color-scheme` already key off.
 */
export const THEMES = ["calm", "colorful", "dark"] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_KEY = "bea-theme";
/** The old Light/Dark switch. Read once so a Dark user stays dark. */
export const DARK_KEY = "bea-dark";
export const DEFAULT_THEME: ThemeName = "calm";

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Runs in `<head>` so the saved theme is on before first paint. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="calm"&&t!=="colorful"&&t!=="dark")t=localStorage.getItem("${DARK_KEY}")==="yes"?"dark":"${DEFAULT_THEME}";var d=document.documentElement;d.setAttribute("data-theme",t);if(t==="dark")d.classList.add("dark")}catch(e){}`;

export function readTheme(): ThemeName {
  if (typeof document !== "undefined") {
    const live = document.documentElement.getAttribute("data-theme");
    if (isThemeName(live)) return live;
  }
  try {
    const saved = globalThis.localStorage?.getItem(THEME_KEY);
    if (isThemeName(saved)) return saved;
    if (globalThis.localStorage?.getItem(DARK_KEY) === "yes") return "dark";
  } catch {
    /* private mode */
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeName): void {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", theme === "dark");
  }
  try {
    globalThis.localStorage?.setItem(THEME_KEY, theme);
    globalThis.localStorage?.removeItem(DARK_KEY);
  } catch {
    /* private mode */
  }
}
