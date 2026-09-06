export const DARK_KEY = "bea-dark";

/** Runs in `<head>` so a saved dark preference is on before first paint. */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem("${DARK_KEY}")==="yes")document.documentElement.classList.add("dark")}catch(e){}`;

export function readDark(): boolean {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return true;
  }
  try {
    return globalThis.localStorage?.getItem(DARK_KEY) === "yes";
  } catch {
    return false;
  }
}

export function applyDark(on: boolean): void {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", on);
  }
  try {
    if (on) globalThis.localStorage?.setItem(DARK_KEY, "yes");
    else globalThis.localStorage?.removeItem(DARK_KEY);
  } catch {
    /* private mode */
  }
}
