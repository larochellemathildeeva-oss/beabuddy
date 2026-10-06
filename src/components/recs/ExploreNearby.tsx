import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { friendlyError } from "@/lib/friendly-error";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Bookmark,
  Clock,
  List,
  Map as MapGlyph,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Settings2,
  X,
} from "@/components/icons";
import { PlaceFacts } from "@/components/PlaceFacts";
import { pinColorClass, pinLabel, type PinType } from "@/data/atlas";
import type { NewReco, RecoRowDB } from "@/hooks/useRecommendations";
import { findDuplicate } from "@/lib/captured-place";
import { GEOAPIFY_ATTRIBUTION, OSM_ATTRIBUTION } from "@/lib/geo-endpoints";
import { formatMetres, metresAway } from "@/lib/near";
import { lookupCoords, searchPlaces } from "@/lib/places.functions";
import { prettyPlaceCategory } from "@/lib/place-kind";
import {
  BROWSE_KINDS,
  browseKindOf,
  directionsUrl,
  inBrowseKind,
  prettyTag,
  walkMinutesAbout,
  type BrowseKind,
} from "@/lib/recs-browse";
import { tilePath } from "@/lib/tile-proxy";
import { KIND_ICON } from "./kind-icons";
import { PlaceArt, type RecsPlace } from "./RecsParts";

const TILE = 256;
const ZOOM = 15;
const MAP_HEIGHT = 320;

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

type Found = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** The map's own tag ("cafe", "museum") or a search hit's category. */
  tag: string;
};

type LatLon = { lat: number; lon: number };

const pinTypes: PinType[] = ["wishlist", "nexttime", "visited", "reco"];

/**
 * Explore nearby: a map of where you are with what is around it, as pins by
 * kind and as a list, and a sheet for the one you tap. Places come from
 * OpenStreetMap (Overpass, two mirrors) around the middle of the map, asked
 * again only when you say "Search this area". Tapping the map anywhere else
 * pins that exact spot, as the old "Pin somewhere nearby" did.
 */
export function ExploreNearby({
  initialKind = "All",
  saved,
  tripLine,
  savingName,
  onBack,
  onOpen,
  onSave,
  onAdd,
  onHere,
}: {
  initialKind?: BrowseKind | "All";
  saved: readonly RecoRowDB[];
  /** The dates of a trip under way, for the line under the title. */
  tripLine?: string | undefined;
  /** The name of a place being saved right now, for its button. */
  savingName?: string | null | undefined;
  onBack: () => void;
  onOpen: (place: RecsPlace) => void;
  /** Save a found place in one tap; the parent offers the rest afterwards. */
  onSave: (place: RecsPlace) => Promise<void>;
  /** Save a pinned spot as the traveller named it. */
  onAdd: (reco: NewReco) => Promise<string | undefined>;
  onHere: (at: LatLon) => void;
}) {
  const lookup = useServerFn(lookupCoords);
  const search = useServerFn(searchPlaces);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(340);
  const [here, setHere] = useState<LatLon | null>(null);
  const [center, setCenter] = useState<LatLon | null>(null);
  /** Where the places on screen were asked around. */
  const [askedAt, setAskedAt] = useState<LatLon | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [state, setState] = useState<"idle" | "locating" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const [places, setPlaces] = useState<Found[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState(false);
  const [placesRetryKey, setPlacesRetryKey] = useState(0);
  const [kind, setKind] = useState<BrowseKind | "All">(initialKind);
  const [view, setView] = useState<"map" | "list">("map");
  const [sort, setSort] = useState<"distance" | "name">("distance");
  const [showSaved, setShowSaved] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [draftType, setDraftType] = useState<PinType>("wishlist");
  const [pinning, setPinning] = useState(false);
  const [pinned, setPinned] = useState("");
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const hasCenter = center != null;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 340));
    ro.observe(el);
    setWidth(el.clientWidth || 340);
    return () => ro.disconnect();
  }, [hasCenter, view]);

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
        setAskedAt(p);
        setState("ok");
        onHere(p);
      },
      (err) => {
        setState("error");
        const framed = typeof window !== "undefined" && window.self !== window.top;
        if (err.code === 1 && framed) {
          setError(
            "This preview window isn't allowed to use location. Open Béa in its own tab and it will work.",
          );
        } else if (err.code === 1) {
          setError("Your browser is blocking location for this site. Allow it, then try again.");
        } else {
          setError(err.message || "Location unavailable");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
    // `onHere` is a setter from the parent; asking again on its identity would re-prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Asked on arrival: opening Explore nearby is the request for a location.
  useEffect(() => {
    locate();
  }, [locate]);

  // Which town this is, for the line under the title. Once per position.
  useEffect(() => {
    if (!here) return;
    let live = true;
    lookup({ data: here })
      .then((p) => {
        if (live) setPlaceName([p.city, p.country].filter(Boolean).join(", "));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here?.lat, here?.lon]);

  // Ask OpenStreetMap what is around the point the places were asked for.
  useEffect(() => {
    if (!askedAt) return;
    let cancelled = false;
    const { lat, lon } = askedAt;
    const q = `[out:json][timeout:20];(node(around:800,${lat},${lon})["name"]["amenity"~"restaurant|cafe|bar|museum|pub|ice_cream|marketplace|fast_food"];node(around:800,${lat},${lon})["name"]["tourism"];node(around:800,${lat},${lon})["name"]["shop"~"bakery|books|clothes"];);out body 80;`;

    // The public instance is shared by everyone and often slow; a silent
    // empty answer would read as "nothing near you". One mirror is worth one
    // retry before this counts as failed, and the network gets 12 seconds.
    async function ask(base: string): Promise<Found[]> {
      const res = await fetch(base, {
        method: "POST",
        body: q,
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as {
        elements?: { id: number; lat: number; lon: number; tags?: Record<string, string> }[];
      };
      return (json.elements ?? [])
        .filter((e) => e.tags?.["name"])
        .map((e) => ({
          id: String(e.id),
          name: e.tags!["name:en"] || e.tags!["name"]!,
          lat: e.lat,
          lon: e.lon,
          tag: e.tags!["amenity"] ?? e.tags!["tourism"] ?? e.tags!["shop"] ?? "place",
        }));
    }

    const run = async () => {
      setLoadingPlaces(true);
      setPlacesError(false);
      try {
        let list: Found[];
        try {
          list = await ask("https://overpass-api.de/api/interpreter");
        } catch (primary) {
          if (cancelled) throw primary;
          list = await ask("https://overpass.kumi.systems/api/interpreter");
        }
        if (!cancelled) setPlaces(list);
      } catch {
        if (!cancelled) {
          setPlaces([]);
          setPlacesError(true);
        }
      } finally {
        if (!cancelled) setLoadingPlaces(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [askedAt, placesRetryKey]);

  const from = here ?? askedAt;

  const project = useCallback(
    (lat: number, lon: number) => {
      if (!center) return { x: -999, y: -999 };
      return {
        x: (lonToX(lon, ZOOM) - lonToX(center.lon, ZOOM)) * TILE + width / 2,
        y: (latToY(lat, ZOOM) - latToY(center.lat, ZOOM)) * TILE + MAP_HEIGHT / 2,
      };
    },
    [center, width],
  );

  const unproject = useCallback(
    (x: number, y: number) => {
      if (!center) return null;
      const cx = lonToX(center.lon, ZOOM) + (x - width / 2) / TILE;
      const cy = latToY(center.lat, ZOOM) + (y - MAP_HEIGHT / 2) / TILE;
      return { lat: yToLat(cy, ZOOM), lon: xToLon(cx, ZOOM) };
    },
    [center, width],
  );

  const tiles = useMemo(() => {
    if (!center) return [];
    const cx = lonToX(center.lon, ZOOM);
    const cy = latToY(center.lat, ZOOM);
    const cols = Math.ceil(width / TILE) + 2;
    const rows = Math.ceil(MAP_HEIGHT / TILE) + 2;
    const out: { key: string; url: string; left: number; top: number }[] = [];
    for (let i = -Math.ceil(cols / 2); i <= Math.ceil(cols / 2); i++) {
      for (let j = -Math.ceil(rows / 2); j <= Math.ceil(rows / 2); j++) {
        const tx = Math.floor(cx) + i;
        const ty = Math.floor(cy) + j;
        if (ty < 0 || ty >= 2 ** ZOOM) continue;
        const wrapped = ((tx % 2 ** ZOOM) + 2 ** ZOOM) % 2 ** ZOOM;
        out.push({
          key: `${tx}-${ty}`,
          // Through Béa, never straight to a tile server: the key stays on the server.
          url: tilePath({ z: ZOOM, x: wrapped, y: ty }),
          left: (tx - cx) * TILE + width / 2,
          top: (ty - cy) * TILE + MAP_HEIGHT / 2,
        });
      }
    }
    return out;
  }, [center, width]);

  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = places
      .filter((p) => inBrowseKind(p.tag, kind))
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .map((p) => ({ ...p, d: from ? metresAway(from, p) : 0 }));
    return list.sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : a.d - b.d));
  }, [places, kind, needle, from, sort]);

  const selected =
    shown.find((p) => p.id === selectedId) ?? places.find((p) => p.id === selectedId);
  const selectedMetres = selected && from ? metresAway(from, selected) : null;

  const asPlace = (p: Found): RecsPlace => ({
    name: p.name,
    category: prettyTag(p.tag),
    lat: p.lat,
    lon: p.lon,
    source: "Pinned from the live map",
  });

  const savedMatch = (p: Found) =>
    findDuplicate(
      saved.map((r) => ({ id: r.id, name: r.name, city: r.city, lat: r.lat, lon: r.lon })),
      { name: p.name, lat: p.lat, lon: p.lon },
    );

  const moved = center && askedAt ? metresAway(center, askedAt) > 250 : false;

  /** A name typed in: what is on screen first, then the map around here. */
  const runSearch = async () => {
    const q = query.trim();
    setSearchNote("");
    if (q.length < 2 || !center) return;
    if (places.some((p) => p.name.toLowerCase().includes(q.toLowerCase()))) return;
    setSearching(true);
    try {
      const hits = await search({ data: { query: q, at: center } });
      const found: Found[] = hits
        .filter((h) => h.lat != null && h.lon != null)
        .map((h, i) => ({
          id: `search-${i}-${h.name}`,
          name: h.name,
          lat: h.lat!,
          lon: h.lon!,
          tag: prettyPlaceCategory(h) || h.category || "place",
        }));
      if (found.length === 0) {
        setSearchNote("Nothing by that name around here.");
        return;
      }
      setPlaces((cur) => [...found, ...cur.filter((p) => !p.id.startsWith("search-"))]);
      setKind("All");
      setSelectedId(found[0]!.id);
      setCenter({ lat: found[0]!.lat, lon: found[0]!.lon });
    } catch {
      setSearchNote("Couldn't search the map just now.");
    } finally {
      setSearching(false);
    }
  };

  const savePin = async () => {
    if (!draft) return;
    setPinning(true);
    try {
      await onAdd({
        name: draft.name.trim() || "Pinned spot",
        category: "place",
        lat: draft.lat,
        lon: draft.lon,
        pin_type: draftType,
        source: "Pinned from the live map",
      });
      setPinned(`${draft.name.trim() || "Pinned spot"} is on your map.`);
      setDraft(null);
    } catch (e) {
      setPinned(friendlyError(e, "Could not save that pin."));
    } finally {
      setPinning(false);
    }
  };

  const subline = [placeName, tripLine].filter(Boolean).join(" · ");

  const bookmarkButton = (p: Found) => {
    const match = savedMatch(p);
    const busy = savingName === p.name;
    return (
      <button
        type="button"
        aria-label={match ? `${p.name} is saved` : `Save ${p.name}`}
        aria-pressed={Boolean(match)}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          if (match) {
            onOpen({ ...asPlace(p), savedId: match.id });
            return;
          }
          void onSave(asPlace(p));
        }}
        className="grid size-10 shrink-0 place-items-center rounded-full disabled:opacity-50"
      >
        <Bookmark
          className={`size-5 ${match ? "text-primary" : ""}`}
          weight={match ? "fill" : "regular"}
          aria-hidden
        />
      </button>
    );
  };

  return (
    <div className="rise space-y-4" data-guide="pin-nearby">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Recommendations"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[30px] leading-none">Explore nearby</h2>
          <p className="mt-1 truncate text-[14px] text-muted-foreground">
            {subline || (state === "locating" ? "Finding where you are…" : "Around you")}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchNote("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder="Search this area…"
            aria-label="Search this area"
            className="h-12 w-full rounded-full border border-border bg-card pl-12 pr-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-label="Sort and show"
          className={`grid size-12 shrink-0 place-items-center rounded-full border ${
            filtersOpen ? "border-primary bg-primary-soft" : "border-border bg-card"
          }`}
        >
          <Settings2 className="size-5" aria-hidden />
        </button>
      </div>
      {searching && <p className="text-[13px] text-muted-foreground">Searching the map…</p>}
      {searchNote && <p className="text-[13px] text-muted-foreground">{searchNote}</p>}

      {filtersOpen && (
        <div className="recs-box space-y-3 p-4">
          <label className="flex items-center justify-between gap-3 text-[15px]">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "distance" | "name")}
              className="rounded-xl border border-border bg-card px-3 py-2"
            >
              <option value="distance">Distance</option>
              <option value="name">Name</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-[15px]">
            <span>Show my saved places on the map</span>
            <input
              type="checkbox"
              checked={showSaved}
              onChange={(e) => setShowSaved(e.target.checked)}
              className="size-5 accent-[var(--color-primary)]"
            />
          </label>
        </div>
      )}

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        role="tablist"
        aria-label="What kind of place"
      >
        {(["All", ...BROWSE_KINDS] as const).map((k, i) => {
          const on = kind === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setKind(k);
                setSelectedId(null);
              }}
              className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] font-semibold transition-colors ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : `tile-fill-${(i % 5) + 1} border-border`
              }`}
            >
              {k}
            </button>
          );
        })}
      </div>

      {state === "error" && (
        <div className="recs-box p-4 text-[14px] text-muted-foreground">
          {error}
          <button type="button" onClick={locate} className="ml-2 font-semibold text-primary">
            Try again
          </button>
        </div>
      )}
      {state === "locating" && !center && (
        <div className="recs-box grid h-40 place-items-center text-[14px] text-muted-foreground">
          Finding where you are…
        </div>
      )}

      {center && view === "list" && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-elevated p-1" role="tablist">
          {(["map", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`h-10 rounded-full text-[15px] font-semibold ${
                view === v ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {v === "map" ? "Map" : "List"}
            </button>
          ))}
        </div>
      )}

      {center && view === "map" && (
        <div>
          <div
            ref={boxRef}
            className="relative -mx-4 touch-none overflow-hidden border-y border-border bg-elevated sm:mx-0 sm:rounded-[var(--r-card)] sm:border"
            style={{ height: MAP_HEIGHT }}
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
              setSelectedId(null);
              setDraft({ name: "", lat: pos.lat, lon: pos.lon });
              setPinned("");
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

            {showSaved &&
              saved.map((r) => {
                if (r.lat == null || r.lon == null) return null;
                const { x, y } = project(r.lat, r.lon);
                if (x < -20 || y < -20 || x > width + 20 || y > MAP_HEIGHT + 20) return null;
                return (
                  <span
                    key={r.id}
                    title={r.name}
                    className={`pointer-events-none absolute size-2.5 rounded-full ring-2 ring-white ${pinColorClass[(r.pin_type ?? "reco") as PinType]}`}
                    style={{ left: x - 5, top: y - 5 }}
                  />
                );
              })}

            {shown.map((p) => {
              const { x, y } = project(p.lat, p.lon);
              if (x < -20 || y < -20 || x > width + 20 || y > MAP_HEIGHT + 20) return null;
              const Icon = KIND_ICON[browseKindOf(p.tag)];
              const on = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={p.name}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(p.id);
                    setDraft(null);
                  }}
                  className="absolute flex flex-col items-center"
                  style={{ left: x - 17, top: y - 40, zIndex: on ? 2 : 1 }}
                >
                  <span
                    className={`grid size-[34px] place-items-center rounded-full border-2 border-white shadow-md ${
                      on ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span
                    className={`-mt-0.5 size-2 rotate-45 ${on ? "bg-primary" : "bg-card"}`}
                    aria-hidden
                  />
                </button>
              );
            })}

            {draft && (
              <span
                className="pointer-events-none absolute text-primary"
                style={{
                  left: project(draft.lat, draft.lon).x - 12,
                  top: project(draft.lat, draft.lon).y - 24,
                }}
              >
                <MapPin className="size-6" weight="fill" aria-hidden />
              </span>
            )}

            {here && (
              <span
                className="pointer-events-none absolute size-3.5 rounded-full bg-primary ring-4 ring-primary/30"
                style={{
                  left: project(here.lat, here.lon).x - 7,
                  top: project(here.lat, here.lon).y - 7,
                }}
              />
            )}

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => (here ? setCenter(here) : locate())}
              aria-label="Back to where you are"
              className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-card shadow-md"
            >
              <Navigation className="size-5" aria-hidden />
            </button>
            {moved && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => {
                  setAskedAt(center);
                  setSelectedId(null);
                }}
                className="absolute bottom-3 left-3 flex h-10 items-center gap-2 rounded-full bg-card px-4 text-[14px] font-semibold shadow-md"
              >
                <RefreshCw className="size-4" aria-hidden /> Search this area
              </button>
            )}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => setView("list")}
              className="absolute bottom-3 right-3 flex flex-col items-center rounded-2xl bg-card px-3 py-1.5 text-[13px] font-semibold shadow-md"
            >
              <List className="size-5" aria-hidden />
              List
            </button>
          </div>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {OSM_ATTRIBUTION} · {GEOAPIFY_ATTRIBUTION}. Tap anywhere on the map to pin that spot.
          </p>
        </div>
      )}

      {draft && (
        <div className="recs-box p-4">
          <div className="flex items-start justify-between gap-2">
            <label className="text-[15px] font-semibold" htmlFor="nearby-pin-name">
              Name this pin
            </label>
            <button
              type="button"
              onClick={() => setDraft(null)}
              aria-label="Cancel"
              className="grid size-8 place-items-center rounded-full border border-border"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <input
            id="nearby-pin-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Little bakery on the corner"
            className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {pinTypes.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={draftType === t}
                onClick={() => setDraftType(t)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${
                  draftType === t
                    ? "border-primary bg-primary-soft"
                    : "border-border text-muted-foreground"
                }`}
              >
                <span className={`size-2 rounded-full ${pinColorClass[t]}`} aria-hidden />
                {pinLabel[t]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void savePin()}
            disabled={pinning}
            className="btn-primary mt-3 w-full disabled:opacity-60"
          >
            {pinning ? "Saving…" : `Save as ${pinLabel[draftType].toLowerCase()}`}
          </button>
        </div>
      )}
      {pinned && <p className="text-[13px] text-primary">{pinned}</p>}

      {selected && (
        <section className="recs-box overflow-hidden" aria-label={selected.name}>
          <div className="relative">
            <PlaceArt
              place={{ name: selected.name, category: prettyTag(selected.tag) }}
              className="h-36 w-full"
            />
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-card/90 shadow-sm"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[26px] leading-none">{selected.name}</h3>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  {prettyTag(selected.tag)}
                  {selectedMetres != null ? ` · ${formatMetres(selectedMetres)}` : ""}
                </p>
              </div>
              {bookmarkButton(selected)}
            </div>
            {selectedMetres != null && (
              <p className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px]">
                <Clock className="size-4" aria-hidden />
                About {walkMinutesAbout(selectedMetres)} min on foot
              </p>
            )}
            <PlaceFacts name={selected.name} lat={selected.lat} lon={selected.lon} auto />
            <div className="grid grid-cols-2 gap-2">
              <a
                href={directionsUrl(asPlace(selected))}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex items-center justify-center gap-2"
              >
                <Navigation className="size-5" aria-hidden /> Directions
              </a>
              <button
                type="button"
                disabled={savingName === selected.name}
                onClick={() => {
                  const match = savedMatch(selected);
                  if (match) onOpen({ ...asPlace(selected), savedId: match.id });
                  else void onSave(asPlace(selected));
                }}
                className="flex min-h-[var(--h-button)] items-center justify-center gap-2 rounded-[var(--r-button)] border border-border bg-card text-[16px] font-semibold disabled:opacity-60"
              >
                <Bookmark
                  className="size-5"
                  weight={savedMatch(selected) ? "fill" : "regular"}
                  aria-hidden
                />
                {savingName === selected.name ? "Saving…" : savedMatch(selected) ? "Saved" : "Save"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const match = savedMatch(selected);
                onOpen({ ...asPlace(selected), ...(match ? { savedId: match.id } : {}) });
              }}
              className="text-[14px] font-semibold text-primary"
            >
              More about this place
            </button>
          </div>
        </section>
      )}

      {center && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[16px] font-semibold" aria-live="polite">
              {loadingPlaces
                ? "Looking around…"
                : placesError
                  ? "Couldn't reach the map just now."
                  : `${shown.length} ${shown.length === 1 ? "place" : "places"} nearby`}
            </p>
            {placesError && !loadingPlaces ? (
              <button
                type="button"
                onClick={() => setPlacesRetryKey((k) => k + 1)}
                className="text-[14px] font-semibold text-primary"
              >
                Try again
              </button>
            ) : (
              <label className="flex items-center gap-1 text-[14px]">
                <span className="text-muted-foreground">Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "distance" | "name")}
                  className="bg-transparent font-semibold"
                >
                  <option value="distance">Distance</option>
                  <option value="name">Name</option>
                </select>
              </label>
            )}
          </div>

          <ul className="space-y-2.5">
            {shown.slice(0, view === "list" ? 60 : 20).map((p) => (
              <li key={p.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedId(p.id);
                    setCenter({ lat: p.lat, lon: p.lon });
                    setDraft(null);
                    if (view === "list") setView("map");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSelectedId(p.id);
                      setCenter({ lat: p.lat, lon: p.lon });
                    }
                  }}
                  className="recs-box flex cursor-pointer items-center gap-3 p-2.5"
                >
                  <PlaceArt
                    place={{ name: p.name, category: prettyTag(p.tag) }}
                    className="size-[72px] shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[20px] leading-tight">{p.name}</p>
                    <p className="text-[13.5px] text-muted-foreground">
                      {prettyTag(p.tag)}
                      {from ? ` · ${formatMetres(p.d)}` : ""}
                    </p>
                  </div>
                  {bookmarkButton(p)}
                </div>
              </li>
            ))}
          </ul>
          {view === "list" && (
            <p className="text-[13px] text-muted-foreground">{OSM_ATTRIBUTION}</p>
          )}
          {!loadingPlaces && !placesError && shown.length === 0 && places.length > 0 && (
            <p className="text-[14px] text-muted-foreground">
              Nothing of that kind within about 800 m. Try All, or move the map and search this
              area.
            </p>
          )}
          {view === "list" && (
            <button
              type="button"
              onClick={() => setView("map")}
              className="mx-auto flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-[14px] font-semibold"
            >
              <MapGlyph className="size-4" aria-hidden /> Show the map
            </button>
          )}
        </section>
      )}
    </div>
  );
}
