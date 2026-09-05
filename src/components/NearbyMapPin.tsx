import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pinColorClass, pinLabel, type Pin, type PinType } from "@/data/atlas";
import { useRecommendations } from "@/hooks/useRecommendations";

const TILE = 256;
const ZOOM = 15;

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const xToLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const yToLat = (y: number, z: number) => {
  const n = Math.PI - 2 * Math.PI * (y / 2 ** z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

function metres(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type Place = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string;
};

const pinTypes: { type: PinType; label: string }[] = [
  { type: "wishlist", label: "Wishlist" },
  { type: "nexttime", label: "Next time" },
  { type: "visited", label: "Visited" },
  { type: "reco", label: "Recommendation" },
];

/**
 * Opens a live map around the person's current location so they can drop a pin
 * on anything nearby — either a real place suggested by OpenStreetMap or a spot
 * they tap themselves. Saved pins land in the recommendation vault.
 */
export function NearbyMapPin({ existing = [] }: { existing?: Pin[] }) {
  const vault = useRecommendations();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(340);
  const [open, setOpen] = useState(false);
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [state, setState] = useState<"idle" | "locating" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [draft, setDraft] = useState<{ name: string; lat: number; lon: number; category: string } | null>(
    null,
  );
  const [draftType, setDraftType] = useState<PinType>("wishlist");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const height = 300;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 340));
    ro.observe(el);
    setWidth(el.clientWidth || 340);
    return () => ro.disconnect();
  }, [open]);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState("error");
      setError("This device can't share its location.");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setHere(p);
        setCenter(p);
        setState("ok");
      },
      (err) => {
        setState("error");
        const framed = typeof window !== "undefined" && window.self !== window.top;
        if (err.code === 1 && framed) {
          setError(
            "This little preview window isn't allowed to use location. Open Béa in its own tab and it will work.",
          );
        } else if (err.code === 1) {
          setError("Your browser is blocking location for this site. Allow it, then try again.");
        } else {
          setError(err.message || "Location unavailable");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  // Ask OpenStreetMap what's around the middle of the map.
  useEffect(() => {
    if (!open || !center) return;
    let cancelled = false;
    const run = async () => {
      setLoadingPlaces(true);
      const q = `[out:json][timeout:20];(node(around:800,${center.lat},${center.lon})["name"]["amenity"~"restaurant|cafe|bar|museum|pub|ice_cream|marketplace"];node(around:800,${center.lat},${center.lon})["name"]["tourism"];node(around:800,${center.lat},${center.lon})["name"]["shop"~"bakery|books|clothes"];);out body 60;`;
      try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: q,
        });
        const json = (await res.json()) as {
          elements?: { id: number; lat: number; lon: number; tags?: Record<string, string> }[];
        };
        if (cancelled) return;
        const list: Place[] = (json.elements ?? [])
          .filter((e) => e.tags?.["name"])
          .map((e) => ({
            id: String(e.id),
            name: e.tags!["name:en"] || e.tags!["name"]!,
            lat: e.lat,
            lon: e.lon,
            category: e.tags!["amenity"] ?? e.tags!["tourism"] ?? e.tags!["shop"] ?? "place",
          }));
        setPlaces(list);
      } catch {
        if (!cancelled) setPlaces([]);
      } finally {
        if (!cancelled) setLoadingPlaces(false);
      }
    };
    const t = setTimeout(() => void run(), 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, center?.lat, center?.lon]);

  const tiles = useMemo(() => {
    if (!center) return [];
    const cx = lonToX(center.lon, ZOOM);
    const cy = latToY(center.lat, ZOOM);
    const cols = Math.ceil(width / TILE) + 2;
    const rows = Math.ceil(height / TILE) + 2;
    const out: { key: string; url: string; left: number; top: number }[] = [];
    for (let i = -Math.ceil(cols / 2); i <= Math.ceil(cols / 2); i++) {
      for (let j = -Math.ceil(rows / 2); j <= Math.ceil(rows / 2); j++) {
        const tx = Math.floor(cx) + i;
        const ty = Math.floor(cy) + j;
        if (ty < 0 || ty >= 2 ** ZOOM) continue;
        const wrapped = ((tx % 2 ** ZOOM) + 2 ** ZOOM) % 2 ** ZOOM;
        out.push({
          key: `${tx}-${ty}`,
          url: `https://tile.openstreetmap.org/${ZOOM}/${wrapped}/${ty}.png`,
          left: (tx - cx) * TILE + width / 2,
          top: (ty - cy) * TILE + height / 2,
        });
      }
    }
    return out;
  }, [center?.lat, center?.lon, width]);

  const project = useCallback(
    (lat: number, lon: number) => {
      if (!center) return { x: -999, y: -999 };
      const cx = lonToX(center.lon, ZOOM);
      const cy = latToY(center.lat, ZOOM);
      return {
        x: (lonToX(lon, ZOOM) - cx) * TILE + width / 2,
        y: (latToY(lat, ZOOM) - cy) * TILE + height / 2,
      };
    },
    [center?.lat, center?.lon, width],
  );

  const unproject = useCallback(
    (x: number, y: number) => {
      if (!center) return null;
      const cx = lonToX(center.lon, ZOOM) + (x - width / 2) / TILE;
      const cy = latToY(center.lat, ZOOM) + (y - height / 2) / TILE;
      return { lat: yToLat(cy, ZOOM), lon: xToLon(cx, ZOOM) };
    },
    [center?.lat, center?.lon, width],
  );

  const nearbyList = useMemo(() => {
    if (!here) return [];
    return places
      .map((p) => ({ ...p, d: metres(here.lat, here.lon, p.lat, p.lon) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12);
  }, [places, here]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await vault.add({
        name: draft.name.trim() || "Pinned spot",
        category: draft.category,
        lat: draft.lat,
        lon: draft.lon,
        pin_type: draftType,
        source: "Pinned from the live map",
      });
      setSaved(`${draft.name.trim() || "Pinned spot"} is on your map.`);
      setDraft(null);
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "Could not save that pin.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        data-guide="pin-nearby"
        onClick={() => {
          setOpen(true);
          if (!here) locate();
        }}
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left"
      >
        <p className="font-display text-[17px]">Pin somewhere nearby</p>
        <p className="text-[12px] text-muted-foreground">
          Open a map of where you are and drop a pin on anything around you.
        </p>
      </button>
    );
  }

  return (
    <section className="card-soft space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-caps text-foreground">Pin nearby places</p>
          <p className="text-[12px] text-muted-foreground">
            Tap a suggested place, or tap anywhere on the map to pin that exact spot.
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          Close
        </button>
      </div>

      {state === "error" && (
        <div className="rounded-xl border border-border bg-elevated p-3 text-[12px] text-muted-foreground">
          {error}
          <button onClick={locate} className="ml-2 text-primary">
            Try again
          </button>
        </div>
      )}
      {state === "locating" && (
        <p className="text-[12px] text-muted-foreground">Finding where you are…</p>
      )}
      {state === "idle" && (
        <button
          onClick={locate}
          className="rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"
        >
          Use my location
        </button>
      )}

      {center && (
        <div
          ref={boxRef}
          className="relative touch-none overflow-hidden rounded-2xl border border-border bg-elevated"
          style={{ height }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, moved: false };
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
            d.x = e.clientX;
            d.y = e.clientY;
            setCenter((c) => {
              if (!c) return c;
              const cx = lonToX(c.lon, ZOOM) - dx / TILE;
              const cy = Math.min(
                2 ** ZOOM - 0.01,
                Math.max(0.01, latToY(c.lat, ZOOM) - dy / TILE),
              );
              return { lat: yToLat(cy, ZOOM), lon: xToLon(cx, ZOOM) };
            });
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (!d || d.moved) return;
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const pos = unproject(e.clientX - rect.left, e.clientY - rect.top);
            if (!pos) return;
            setDraft({ name: "", lat: pos.lat, lon: pos.lon, category: "place" });
            setSaved("");
          }}
        >
          {tiles.map((t) => (
            <img
              key={t.key}
              src={t.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{ left: t.left, top: t.top, width: TILE, height: TILE }}
            />
          ))}

          {existing.map((p) => {
            const { x, y } = project(p.lat, p.lon);
            if (x < -20 || y < -20 || x > width + 20 || y > height + 20) return null;
            return (
              <span
                key={p.id}
                title={p.name}
                className={`pointer-events-none absolute size-2.5 rounded-full ring-2 ring-white ${pinColorClass[p.type]}`}
                style={{ left: x - 5, top: y - 5 }}
              />
            );
          })}

          {places.map((p) => {
            const { x, y } = project(p.lat, p.lon);
            if (x < -20 || y < -20 || x > width + 20 || y > height + 20) return null;
            return (
              <button
                key={p.id}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft({ name: p.name, lat: p.lat, lon: p.lon, category: p.category });
                  setSaved("");
                }}
                className="absolute rounded-full border border-white bg-foreground/80 px-1.5 py-0.5 text-[9px] font-medium text-background"
                style={{ left: x - 8, top: y - 8, maxWidth: 120 }}
              >
                <span className="block truncate">{p.name}</span>
              </button>
            );
          })}

          {here && (
            <span
              className="pointer-events-none absolute size-3.5 rounded-full bg-primary ring-4 ring-primary/30"
              style={{ left: project(here.lat, here.lon).x - 7, top: project(here.lat, here.lon).y - 7 }}
            />
          )}
        </div>
      )}

      {center && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{loadingPlaces ? "Looking around you…" : `${places.length} places around here`}</span>
          {here && (
            <button onClick={() => setCenter(here)} className="text-primary">
              Back to me
            </button>
          )}
        </div>
      )}

      {draft && (
        <div className="rounded-2xl border border-border bg-elevated p-3">
          <label className="label-caps text-foreground" htmlFor="nearby-pin-name">
            Name this pin
          </label>
          <input
            id="nearby-pin-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Little bakery on the corner"
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-[14px]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {pinTypes.map((t) => (
              <button
                key={t.type}
                onClick={() => setDraftType(t.type)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] ${
                  draftType === t.type
                    ? "border-border bg-card"
                    : "border-border/60 text-muted-foreground"
                }`}
              >
                <span className={`size-2 rounded-full ${pinColorClass[t.type]}`} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : `Save as ${pinLabel[draftType].toLowerCase()}`}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-xl border border-border px-3 py-2 text-[12px] text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {saved && <p className="text-[12px] text-primary">{saved}</p>}

      {nearbyList.length > 0 && (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {nearbyList.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setDraft({ name: p.name, lat: p.lat, lon: p.lon, category: p.category });
                setCenter({ lat: p.lat, lon: p.lon });
                setSaved("");
              }}
              className="flex w-full items-center justify-between gap-3 p-3 text-left"
            >
              <span>
                <span className="block font-display text-[15px]">{p.name}</span>
                <span className="block text-[11px] text-muted-foreground">{p.category}</span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {p.d < 1000 ? `${Math.round(p.d)} m` : `${(p.d / 1000).toFixed(1)} km`}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
