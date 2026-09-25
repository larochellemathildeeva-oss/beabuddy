import {
  PUBLIC_PROVIDER,
  geoapifyProvider,
  locationIqProvider,
  type GeoProvider,
} from "./geo-endpoints.ts";

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
let announced = false;

export function geoProvider(): GeoProvider {
  // Geoapify first when both are set: its terms allow keeping what it finds,
  // and it routes walks, which LocationIQ's hosted router may not.
  const geoapifyKey = (process.env["GEOAPIFY_API_KEY"] ?? "").trim();
  const token = geoapifyKey || (process.env["LOCATIONIQ_TOKEN"] ?? "").trim();
  const provider = geoapifyKey
    ? geoapifyProvider(geoapifyKey)
    : token
      ? locationIqProvider(token)
      : PUBLIC_PROVIDER;

  /**
   * Say once, in the server log, which service is answering.
   *
   * Setting the token is a deploy-time change with no visible effect beyond
   * "things feel quicker", which is not something anyone should have to judge
   * by feel. One line at first use answers it. The token itself is never
   * logged — only its length, which is enough to tell a real token from an
   * empty string or a stray pair of quotes.
   */
  if (!announced) {
    announced = true;
    console.info(
      geoapifyKey
        ? `[geo] Geoapify (key ${geoapifyKey.length} chars, ${provider.gapMs}ms between lookups)`
        : token
          ? `[geo] LocationIQ (token ${token.length} chars, ${provider.gapMs}ms between lookups)`
          : "[geo] OpenStreetMap public endpoints — no GEOAPIFY_API_KEY or LOCATIONIQ_TOKEN set, 1.1s between lookups",
    );
  }
  return provider;
}

/** Whether a paid provider is configured, for the pace a batch can keep. */
export function geoIsKeyed(): boolean {
  return geoProvider().token.length > 0;
}
