/**
 * Béa's three looks, picked on the You page and kept with the account
 * (account-settings.ts), with a copy on each device for first paint.
 *
 *   calm     — white, cream and light beige
 *   colorful — cheerful pastels (lilac, sky, teal, cyan, pink) with a violet accent (the default)
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
export const DEFAULT_THEME: ThemeName = "colorful";

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

/**
 * Each theme's page colour, for the phone's status bar and the installed
 * app's frame (`<meta name="theme-color">`). Kept beside `--background` in
 * styles.css; a light bar over the dark theme looked like a stray strip.
 */
export const THEME_COLORS: Record<ThemeName, string> = {
  calm: "#f7f2e9",
  colorful: "#ffffff",
  dark: "#171513",
};

/** Points the theme-color meta at the theme now showing. */
export function syncThemeColor(theme: ThemeName): void {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme] ?? THEME_COLORS[DEFAULT_THEME]);
}

export function applyTheme(theme: ThemeName): void {
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", theme === "dark");
    syncThemeColor(theme);
  }
  try {
    globalThis.localStorage?.setItem(THEME_KEY, theme);
    globalThis.localStorage?.removeItem(DARK_KEY);
  } catch {
    /* private mode */
  }
}
