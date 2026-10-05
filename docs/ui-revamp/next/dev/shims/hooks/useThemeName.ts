import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, isThemeName, type ThemeName } from "@/lib/theme";

function subscribe(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function current(): ThemeName {
  const value = document.documentElement.getAttribute("data-theme");
  return isThemeName(value) ? value : DEFAULT_THEME;
}

/**
 * The theme on `<html>` right now, for the few things drawn in colours that
 * CSS variables cannot reach (the painted banner's SVG gradients). Follows a
 * change made on the You page without a reload.
 */
export function useThemeName(): ThemeName {
  return useSyncExternalStore(subscribe, current, () => DEFAULT_THEME);
}
