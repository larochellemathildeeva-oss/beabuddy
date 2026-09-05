import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Globe } from "@/components/Globe";
import { supabase } from "@/integrations/supabase/client";
import { usePhotoMemories, derivePhotoPins, type PhotoRow } from "@/hooks/usePhotoMemories";
import { cityKey } from "@/hooks/useFutureNotes";

export const Route = createFileRoute("/_authenticated/story")({
  head: () => ({
    meta: [
      { title: "Travel story — Béa" },
      {
        name: "description",
        content:
          "Play your travel story — the cities you've photographed, drawn in order, photo by photo.",
      },
      { property: "og:title", content: "Travel story — Béa" },
      {
        property: "og:description",
        content: "An animated playback of everywhere you've been, city by city.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoryPage,
});

type Stop = {
  key: string;
  city: string;
  country: string;
  lat: number | null;
  lon: number | null;
  first: string | null;
  last: string | null;
  photos: PhotoRow[];
};

function buildStory(rows: PhotoRow[]): Stop[] {
  const map = new Map<string, Stop>();
  for (const r of rows) {
    const city = r.city?.trim() || "Unknown place";
    const key = cityKey(city);
    const g =
      map.get(key) ??
      ({
        key,
        city,
        country: r.country ?? "",
        lat: r.lat,
        lon: r.lon,
        first: r.taken_at,
        last: r.taken_at,
        photos: [],
      } as Stop);
    g.photos.push(r);
    if (!g.country && r.country) g.country = r.country;
    if (r.lat != null && r.lon != null) {
      if (g.lat == null || g.lon == null) {
        g.lat = r.lat;
        g.lon = r.lon;
      }
    }
    if (r.taken_at) {
      if (!g.first || r.taken_at < g.first) g.first = r.taken_at;
      if (!g.last || r.taken_at > g.last) g.last = r.taken_at;
    }
    map.set(key, g);
  }
  return Array.from(map.values())
    .filter((s) => s.lat != null && s.lon != null)
    .sort((a, b) => (a.first && b.first ? (a.first < b.first ? -1 : 1) : 0));
}

function pretty(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

const STEP_MS = 3800;

function StoryPage() {
  const { rows, loading } = usePhotoMemories();
  const stops = useMemo(() => buildStory(rows), [rows]);
  const pins = useMemo(() => derivePhotoPins(rows), [rows]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const stop = stops[index];

  // advance timer
  useEffect(() => {
    if (!playing || stops.length === 0) return;
    if (index >= stops.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => Math.min(stops.length - 1, i + 1)), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, index, stops.length]);

  // signed url for the current stop's first photo
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    const run = async () => {
      const p = stop?.photos[0];
      if (!p || p.storage_path.startsWith("location-only:")) return;
      const { data } = await supabase.storage
        .from("photo-memories")
        .createSignedUrl(p.storage_path, 3600);
      if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [stop]);

  const currentPinId = stop ? `photo-${stop.key}` : null;

  return (
    <AppShell eyebrow="Travel story" title="Your journey, played back.">
      <div className="space-y-5">
        {loading && (
          <p className="card-soft p-5 text-[14px] text-muted-foreground">Opening your story…</p>
        )}

        {!loading && stops.length === 0 && (
          <div className="card-soft p-5">
            <p className="font-display text-[19px] leading-snug">No story to play yet.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Import a few photos with location on and Béa will turn them into a city-by-city story.
            </p>
            <Link
              to="/photos"
              className="mt-3 block rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-primary-foreground"
            >
              Import photos
            </Link>
          </div>
        )}

        {stops.length > 0 && (
          <>
            <div className="rise">
              <Globe pins={pins} selectedId={currentPinId} />
            </div>

            <section className="rise card-soft overflow-hidden">
              {url && (
                <div className="relative h-44 w-full overflow-hidden bg-elevated">
                  <img
                    src={url}
                    alt={stop?.city ? `${stop.city} memory` : "Travel memory"}
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <p className="label-caps opacity-90">{stop?.country || "Somewhere"}</p>
                    <h2 className="font-display text-[26px] leading-tight">{stop?.city}</h2>
                  </div>
                </div>
              )}
              {!url && (
                <div className="px-4 pt-4">
                  <p className="label-caps">{stop?.country || "Somewhere"}</p>
                  <h2 className="mt-1 font-display text-[26px] leading-tight">{stop?.city}</h2>
                </div>
              )}
              <div className="px-4 py-3.5">
                <p className="text-[13px] text-muted-foreground">
                  {pretty(stop?.first ?? null)}
                  {stop?.first && stop?.last && stop.first.slice(0, 10) !== stop.last.slice(0, 10)
                    ? ` – ${pretty(stop.last)}`
                    : ""}{" "}
                  · {stop?.photos.length ?? 0} photo{(stop?.photos.length ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
            </section>

            <div className="rise flex items-center gap-2">
              <button
                onClick={() => {
                  setIndex((i) => Math.max(0, i - 1));
                  setPlaying(false);
                }}
                disabled={index === 0}
                className="rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (index >= stops.length - 1) {
                    setIndex(0);
                    setPlaying(true);
                  } else {
                    setPlaying((p) => !p);
                  }
                }}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                {playing ? "Pause" : index >= stops.length - 1 ? "Replay" : "Play story"}
              </button>
              <button
                onClick={() => {
                  setIndex((i) => Math.min(stops.length - 1, i + 1));
                  setPlaying(false);
                }}
                disabled={index >= stops.length - 1}
                className="rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>

            <div className="rise card-soft p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="label-caps text-foreground">Stops</p>
                <span className="text-[11px] text-muted-foreground">
                  {index + 1} / {stops.length}
                </span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {stops.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      setIndex(i);
                      setPlaying(false);
                    }}
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                      i === index
                        ? "bg-primary text-primary-foreground"
                        : i < index
                          ? "bg-elevated text-foreground"
                          : "border border-border text-muted-foreground"
                    }`}
                  >
                    {s.city}
                  </button>
                ))}
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${((index + 1) / stops.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
