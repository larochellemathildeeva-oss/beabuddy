/**
 * The small map inside an open walk or drive card: the two stops, a dotted
 * line between them, on a few `/api/tile` image tiles. Pure, so the sums can
 * be tested; the card only draws what this returns.
 *
 * There is no route shape to draw (the router's steps are words, not a
 * line), so the line is straight — the steps under the map say the way.
 */

export type LatLon = { lat: number; lon: number };

export type MiniMapTile = { z: number; x: number; y: number; left: number; top: number };

export type MiniMapPlan = {
  zoom: number;
  tiles: MiniMapTile[];
  from: { x: number; y: number };
  to: { x: number; y: number };
};

const TILE = 256;

/** Web Mercator: a point to world pixels at zoom z. */
function project(p: LatLon, z: number): { x: number; y: number } {
  const scale = TILE * 2 ** z;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, p.lat));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((p.lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function valid(p: LatLon | null | undefined): p is LatLon {
  return (
    !!p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lon) <= 180
  );
}

/**
 * The tiles covering a `width` × `height` box that holds both points with
 * `pad` pixels to spare, at the closest zoom that fits (at most 17, so two
 * stops across the street still show the street). Null when either point is
 * missing, or the two are too far apart for a map this small to mean much.
 */
export function legMiniMap(
  a: LatLon | null | undefined,
  b: LatLon | null | undefined,
  width: number,
  height: number,
  pad = 28,
): MiniMapPlan | null {
  if (!valid(a) || !valid(b)) return null;
  let zoom = 17;
  for (; zoom >= 5; zoom--) {
    const pa = project(a, zoom);
    const pb = project(b, zoom);
    if (Math.abs(pa.x - pb.x) <= width - 2 * pad && Math.abs(pa.y - pb.y) <= height - 2 * pad) {
      break;
    }
  }
  if (zoom < 5) return null;
  const pa = project(a, zoom);
  const pb = project(b, zoom);
  const cx = (pa.x + pb.x) / 2;
  const cy = (pa.y + pb.y) / 2;
  const left = cx - width / 2;
  const top = cy - height / 2;
  const span = 2 ** zoom;
  const tiles: MiniMapTile[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height - 1) / TILE); ty++) {
    if (ty < 0 || ty >= span) continue;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width - 1) / TILE); tx++) {
      const x = ((tx % span) + span) % span;
      tiles.push({
        z: zoom,
        x,
        y: ty,
        left: Math.round(tx * TILE - left),
        top: Math.round(ty * TILE - top),
      });
    }
  }
  return {
    zoom,
    tiles,
    from: { x: Math.round(pa.x - left), y: Math.round(pa.y - top) },
    to: { x: Math.round(pb.x - left), y: Math.round(pb.y - top) },
  };
}

export type StepTurn = "straight" | "left" | "right" | "uturn" | "arrive";

/** Which arrow a step gets, read from the router's words. */
export function stepTurn(instruction: string): StepTurn {
  const text = instruction.toLowerCase();
  if (/\bu-?turn\b|make a u/.test(text)) return "uturn";
  if (/\barriv|destination\b|you have reached/.test(text)) return "arrive";
  if (/\bleft\b/.test(text)) return "left";
  if (/\bright\b/.test(text)) return "right";
  return "straight";
}
