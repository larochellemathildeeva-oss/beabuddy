/**
 * Right-to-left labels on the day map. Browser-only, and kept apart from
 * `offline-map.ts` because the `?url` import below is Vite's, which Node's
 * test runner cannot load.
 */
import type * as MapLibre from "maplibre-gl";
// Served from Béa's own build, not a CDN: no third party sees the map load.
// By file path because the package only exports its source; MapLibre needs
// the built script it loads into its workers.
import rtlTextPluginUrl from "../../node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js?url";

let rtlRequested = false;

/**
 * Arabic and Hebrew labels are drawn backwards and unjoined without this.
 * Lazy: the plugin (about 130 kB) is fetched only when a label needs it.
 */
export function enableRtlText(mod: typeof MapLibre | { default: typeof MapLibre }): void {
  if (rtlRequested) return;
  rtlRequested = true;
  const maplibregl = "default" in mod && mod.default ? mod.default : (mod as typeof MapLibre);
  if (maplibregl.getRTLTextPluginStatus() !== "unavailable") return;
  maplibregl.setRTLTextPlugin(rtlTextPluginUrl, true).catch((error: unknown) => {
    // Right-to-left labels read wrong; the rest of the map is fine.
    console.error(error);
  });
}
