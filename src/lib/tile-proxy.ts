/**
 * Serving the Near map's tiles through Béa, so the token stays hers.
 *
 * A tile is fetched by the browser with an `img` tag, so anything in its URL
 * is public — and LocationIQ's free tier grants exactly one access token, the
 * same one the server geocodes with. Putting it in a tile URL would publish
 * it. So the browser asks Béa for a tile and Béa asks the provider, which is
 * the only arrangement where the map can move off OpenStreetMap's own servers
 * without the key going with it.
 *
 * A proxy that will fetch a URL on request is also the kind of thing people
 * point at other things, so the path is parsed rather than trusted: three
 * integers, in range for their zoom, and nothing else reaches a fetch.
 */

/** The zoom the Near map draws at; anything else has no business here. */
export const TILE_ZOOM_MIN = 1;
export const TILE_ZOOM_MAX = 19;

export type TileCoords = { z: number; x: number; y: number };

/**
 * Read `/api/tile/14/4695/6053.png` into numbers, or refuse.
 *
 * Refusing covers the ordinary cases — a truncated path, a decimal, a
 * negative — and the pointed ones: `..`, a full URL, anything that is not
 * simply digits. Nothing here is interpolated into a fetch until it has
 * come back through Number and been range-checked.
 */
export function parseTilePath(pathname: string): TileCoords | null {
  const match = /^\/api\/tile\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.png$/.exec(pathname);
  if (!match) return null;

  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (!Number.isInteger(z) || z < TILE_ZOOM_MIN || z > TILE_ZOOM_MAX) return null;

  // At zoom z the world is 2^z tiles across. Outside that is not a place.
  const span = 2 ** z;
  if (!Number.isInteger(x) || x < 0 || x >= span) return null;
  if (!Number.isInteger(y) || y < 0 || y >= span) return null;
  return { z, x, y };
}

/** The path the map asks Béa for. */
export function tilePath({ z, x, y }: TileCoords): string {
  return `/api/tile/${z}/${x}/${y}.png`;
}

/**
 * The same path as a Leaflet URL template, for a map that asks for its own
 * tiles. It has to stay the shape `parseTilePath` accepts, or every tile the
 * day map requests is refused — the test holds the two together.
 */
export const TILE_URL_TEMPLATE = "/api/tile/{z}/{x}/{y}.png";

/**
 * Where Béa fetches it from.
 *
 * Geoapify when its key is set, LocationIQ when there is a token,
 * OpenStreetMap when there is neither — the same order as every other
 * lookup, so an app with no key still draws a map.
 */
export function tileSourceUrl(coords: TileCoords, token: string, geoapifyKey = ""): string {
  const { z, x, y } = coords;
  // Geoapify first when its key is set, like every other lookup.
  if (geoapifyKey) {
    return `https://maps.geoapify.com/v1/tile/osm-bright/${z}/${x}/${y}.png?apiKey=${encodeURIComponent(geoapifyKey)}`;
  }
  return token
    ? `https://tiles.locationiq.com/v3/streets/r/${z}/${x}/${y}.png?key=${encodeURIComponent(token)}`
    : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/**
 * A day in the browser, a week in any shared cache.
 *
 * Map tiles for a fixed zoom barely change, and every cached one is a request
 * neither Béa nor the provider pays for. `immutable` is honest here: the tile
 * at a given z/x/y is the same picture tomorrow.
 */
export const TILE_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, immutable";
