import { useEffect, useState } from "react";
import { Check } from "@/components/icons";
import {
  applyTheme,
  DEFAULT_THEME,
  isThemeName,
  readTheme,
  THEME_KEY,
  THEMES,
  type ThemeName,
} from "@/lib/theme";
import { saveAccountSetting } from "@/lib/account-settings-sync";

const LABELS: Record<ThemeName, { name: string; hint: string }> = {
  calm: { name: "Calm", hint: "White, cream and light beige" },
  colorful: { name: "Colorful", hint: "Mixed pastels: lilac, cyan, teal, pink" },
  dark: { name: "Dark", hint: "Black with white and beige" },
};

/**
 * Béa's three looks, each shown as a tiny page drawn in its own colors.
 *
 * The previews carry `data-theme` (and `dark` for Dark) themselves, so the
 * palette in styles.css paints each one no matter which theme is on — they
 * are the real tokens, not a copy of them that could drift.
 */
export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeName>("calm");

  useEffect(() => {
    setTheme(readTheme());
    const onStorage = (e: StorageEvent) => {
      // The new value itself: this page may not be repainted yet.
      if (e.key === THEME_KEY) setTheme(isThemeName(e.newValue) ? e.newValue : DEFAULT_THEME);
      else if (e.key === null) setTheme(readTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="rounded-xl bg-elevated p-3">
      <p className="text-[14.5px] font-medium">Theme</p>
      <p className="text-[12.5px] text-muted-foreground">
        Changes Béa’s colors on every device you sign in on.
      </p>
      <div role="radiogroup" aria-label="Theme" className="mt-3 grid grid-cols-3 gap-2">
        {THEMES.map((name) => {
          const on = name === theme;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${LABELS[name].name}: ${LABELS[name].hint}`}
              onClick={() => {
                applyTheme(name);
                saveAccountSetting("theme", name);
                setTheme(name);
              }}
              className={`rounded-2xl border-2 p-1.5 text-center transition-colors duration-(--t-tap) ease-(--ease-standard) ${
                on ? "border-primary" : "border-transparent"
              }`}
            >
              <span
                data-theme={name}
                className={`${name === "dark" ? "dark " : ""}block overflow-hidden rounded-xl border border-border bg-background p-1.5`}
                aria-hidden
              >
                <span className="block h-4 rounded-md bg-tile-1" />
                <span className="mt-1 grid grid-cols-2 gap-1">
                  <span className="block h-6 rounded-md border border-border/60 bg-tile-2" />
                  <span className="block h-6 rounded-md bg-tile-4" />
                </span>
                <span className="mt-1.5 block h-1.5 w-7 rounded-full bg-primary" />
              </span>
              <span className="mt-1.5 flex items-center justify-center gap-1 text-[13px] font-semibold">
                {on && <Check className="size-3.5 text-primary" aria-hidden />}
                {LABELS[name].name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
