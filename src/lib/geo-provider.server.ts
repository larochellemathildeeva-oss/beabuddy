import { PUBLIC_PROVIDER, locationIqProvider, type GeoProvider } from "./geo-endpoints.ts";

/**
 * The geocoding token, on the server and nowhere else.
 *
 * `src/lib/*.functions.ts` ship to the client bundle — that is written down in
 * AGENTS.md and it is the reason this file exists separately. A key read in a
 * functions file would be compiled into JavaScript a browser downloads. Every
 * caller imports this lazily, inside its handler, the same way the Gemini key
 * is reached.
 *
 * Absent token, absent change: the public Nominatim and OSRM endpoints stay
 * exactly as they were, at the same one-a-second pace. Nothing breaks by not
 * configuring this, which is what makes the switch safe to make and safe to
 * undo.
 */
export function geoProvider(): GeoProvider {
  const token = (process.env["LOCATIONIQ_TOKEN"] ?? "").trim();
  return token ? locationIqProvider(token) : PUBLIC_PROVIDER;
}

/** Whether a paid provider is configured, for the pace a batch can keep. */
export function geoIsKeyed(): boolean {
  return geoProvider().token.length > 0;
}
