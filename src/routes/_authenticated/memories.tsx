import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { usePhotoMemories, type PhotoRow } from "@/hooks/usePhotoMemories";
import { useFutureNotes, cityKey } from "@/hooks/useFutureNotes";
import { useRecommendations } from "@/hooks/useRecommendations";

export const Route = createFileRoute("/_authenticated/memories")({
  head: () => ({
    meta: [
      { title: "City memories — Béa" },
      {
        name: "description",
        content:
          "Every city you have photographed, grouped into a memory page with dates, notes to your future self and the recommendations waiting there.",
      },
      { property: "og:title", content: "City memories — Béa" },
      {
        property: "og:description",
        content: "Your photos, grouped by city and date, with Future Me notes and saved places.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MemoriesPage,
});

type CityGroup = {
  key: string;
  city: string;
  country: string;
  photos: PhotoRow[];
  first: string | null;
  last: string | null;
  visits: { start: string; end: string; photos: PhotoRow[] }[];
};

function prettyDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function groupByCity(rows: PhotoRow[]): CityGroup[] {
  const map = new Map<string, CityGroup>();
  for (const r of rows) {
    const city = r.city?.trim() || "Unknown place";
    const key = cityKey(city);
    const g =
      map.get(key) ??
      ({
        key,
        city,
        country: r.country ?? "",
        photos: [],
        first: null,
        last: null,
        visits: [],
      } as CityGroup);
    g.photos.push(r);
    if (!g.country && r.country) g.country = r.country;
    map.set(key, g);
  }

  for (const g of map.values()) {
    const dated = g.photos
      .filter((p) => p.taken_at)
      .sort((a, b) => (a.taken_at! < b.taken_at! ? -1 : 1));
    if (dated.length) {
      g.first = dated[0]!.taken_at!;
      g.last = dated[dated.length - 1]!.taken_at!;
      // split into separate visits when there is a gap of more than 14 days
      let current: PhotoRow[] = [];
      const push = () => {
        if (!current.length) return;
        g.visits.push({
          start: current[0]!.taken_at!,
          end: current[current.length - 1]!.taken_at!,
          photos: [...current],
        });
        current = [];
      };
      for (const p of dated) {
        const prev = current[current.length - 1];
        if (
          prev &&
          new Date(p.taken_at!).getTime() - new Date(prev.taken_at!).getTime() >
            14 * 24 * 3600 * 1000
        ) {
          push();
        }
        current.push(p);
      }
      push();
      g.visits.reverse();
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.last && b.last) return a.last < b.last ? 1 : -1;
    return b.photos.length - a.photos.length;
  });
}

function MemoriesPage() {
  const { rows, loading } = usePhotoMemories();
  const notes = useFutureNotes();
  const vault = useRecommendations();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => groupByCity(rows), [rows]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next: Record<string, string> = {};
      for (const r of rows.slice(0, 60)) {
        if (r.storage_path.startsWith("location-only:")) continue;

        const { data } = await supabase.storage
          .from("photo-memories")
          .createSignedUrl(r.storage_path, 3600);
        if (data?.signedUrl) next[r.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    };
    if (rows.length) void run();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const saveNote = async (g: CityGroup) => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await notes.add(g.city, g.country || null, draft.trim());
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell eyebrow="City memories" title="Every place, kept in one page.">
      <div className="space-y-5">
        <div className="card-soft flex items-center justify-between gap-3 p-4">
          <p className="text-[13px] text-muted-foreground">
            {loading
              ? "Opening your memories…"
              : `${rows.length} photo${rows.length === 1 ? "" : "s"} across ${groups.length} place${
                  groups.length === 1 ? "" : "s"
                }.`}
          </p>
          <Link
            to="/photos"
            className="shrink-0 rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
          >
            Import photos
          </Link>
        </div>

        {!loading && groups.length === 0 && (
          <p className="card-soft p-5 text-[14px] text-muted-foreground">
            Nothing here yet. Import a few photos and Béa will sort them into city pages using the
            location saved inside each picture.
          </p>
        )}

        {groups.map((g) => {
          const cityNotes = notes.forCity(g.city);
          const cityRecos = vault.rows.filter((r) => cityKey(r.city) === g.key);
          const isOpen = open === g.key;
          return (
            <section key={g.key} className="rise card-soft overflow-hidden">
              <button
                onClick={() => {
                  setOpen(isOpen ? null : g.key);
                  setDraft("");
                }}
                className="w-full px-4 pt-4 text-left"
              >
                <p className="label-caps">{g.country || "Somewhere"}</p>
                <h2 className="mt-1 text-[24px] leading-tight">{g.city}</h2>
                <p className="text-[12px] text-muted-foreground">
                  {g.photos.length} photo{g.photos.length === 1 ? "" : "s"}
                  {g.first && g.last
                    ? ` · ${prettyDate(g.first)}${
                        g.first.slice(0, 10) === g.last.slice(0, 10) ? "" : ` – ${prettyDate(g.last)}`
                      }`
                    : ""}
                  {g.visits.length > 1 ? ` · ${g.visits.length} visits` : ""}
                </p>
              </button>

              <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-4">
                {g.photos.slice(0, 12).map((p) => (
                  <div
                    key={p.id}
                    className="size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-elevated"
                  >
                    {urls[p.id] && (
                      <img
                        src={urls[p.id]}
                        alt={p.caption || `${g.city} memory`}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>

              {isOpen && (
                <div className="space-y-4 border-t border-border/70 px-4 py-4">
                  {g.visits.length > 0 && (
                    <div>
                      <p className="label-caps">Visits</p>
                      <ul className="mt-2 space-y-1.5">
                        {g.visits.map((v) => (
                          <li key={v.start} className="text-[13px]">
                            <span className="font-semibold">{prettyDate(v.start)}</span>
                            {v.start.slice(0, 10) !== v.end.slice(0, 10) && (
                              <span> – {prettyDate(v.end)}</span>
                            )}
                            <span className="text-muted-foreground">
                              {" "}
                              · {v.photos.length} photo{v.photos.length === 1 ? "" : "s"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="label-caps">Future Me notes</p>
                    {cityNotes.length === 0 && (
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        Nothing yet. Leave a note for the next time you land here.
                      </p>
                    )}
                    <ul className="mt-2 space-y-2">
                      {cityNotes.map((n) => (
                        <li
                          key={n.id}
                          className="rounded-xl border border-border bg-elevated px-3 py-2"
                        >
                          <p className="font-display text-[15px] leading-snug">“{n.note}”</p>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                              {prettyDate(n.created_at)}
                            </span>
                            <button
                              onClick={() => void notes.remove(n.id)}
                              className="text-[11px] font-semibold text-muted-foreground"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={isOpen ? draft : ""}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Next time, stay near the old town…"
                        className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[13px]"
                      />
                      <button
                        disabled={saving || !draft.trim()}
                        onClick={() => void saveNote(g)}
                        className="rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="label-caps">Waiting for you here</p>
                    {cityRecos.length === 0 ? (
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        No saved recommendations in {g.city} yet.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {cityRecos.map((r) => (
                          <li
                            key={r.id}
                            className="rounded-xl border border-border bg-elevated px-3 py-2"
                          >
                            <p className="text-[14px] font-semibold">{r.name}</p>
                            <p className="text-[12px] text-muted-foreground">
                              {r.category ? `${r.category} · ` : ""}
                              {r.recommended_by ? `from ${r.recommended_by}` : "saved by you"} ·{" "}
                              {prettyDate(r.created_at)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
