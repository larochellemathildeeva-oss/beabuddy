import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { NearbyMapPin } from "@/components/NearbyMapPin";
import { RecoListImport } from "@/components/RecoListImport";
import { pinColorClass, pinLabel, type Pin, type PinType } from "@/data/atlas";
import { useRecommendations, type RecoRowDB } from "@/hooks/useRecommendations";
import { PLACE_TRAVEL_TAGS, suggestTravelTags, tagsForSave, toggleTravelTag } from "@/lib/reco-tags";
import { parsePlaceLink, lookupCoords, searchPlaces, type ParsedPlace } from "@/lib/places.functions";
import { placeSuggestionLines } from "@/lib/place-label";
import { fuzzyRank } from "@/lib/fuzzy";
import { isCityLevelPlace, recMatchesPlace, uniqueRecCities } from "@/lib/reco-place";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { scoreOpportunity } from "@/lib/score-opportunity";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Recommendation vault — Béa" },
      {
        name: "description",
        content:
          "Every recommendation you've ever been given, saved by link, GPS or note — filterable by city, category and who told you.",
      },
      { property: "og:title", content: "Recommendation vault — Béa" },
      {
        property: "og:description",
        content: "Never lose a recommendation again. Save it once, find it years later.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecommendationsPage,
});

const pinChoices: PinType[] = ["reco", "wishlist", "nexttime", "visited"];

type Draft = {
  name: string;
  city?: string;
  country?: string;
  address?: string;
  category?: string;
  notes?: string;
  recommended_by?: string;
  source?: string;
  url?: string;
  lat?: number;
  lon?: number;
  pin_type?: PinType;
  travel_tags?: string[];
};

function draftWithTags(place: Draft): Draft {
  return { ...place, travel_tags: suggestTravelTags(place) };
}

function RecommendationsPage() {
  const [query, setQuery] = useState("");
  const [placeFilter, setPlaceFilter] = useState("All places");
  const [category, setCategory] = useState("All");
  const [mode, setMode] = useState<"link" | "search" | "here" | "manual" | "list" | null>(null);
  const [link, setLink] = useState("");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ParsedPlace[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tagsTouched, setTagsTouched] = useState(false);
  const [moreTags, setMoreTags] = useState(false);
  const [locQuery, setLocQuery] = useState("");
  const [locResults, setLocResults] = useState<ParsedPlace[] | null>(null);

  const vault = useRecommendations();
  const scorePrefs = useScorePrefs();
  const parseLink = useServerFn(parsePlaceLink);
  const lookup = useServerFn(lookupCoords);
  const search = useServerFn(searchPlaces);

  const saved: (RecoRowDB | Pin)[] = vault.signedIn ? vault.rows : [];

  const rowView = (r: RecoRowDB | Pin) =>
    "created_at" in r
      ? {
          id: r.id,
          name: r.name,
          city: r.city ?? "",
          country: r.country ?? "",
          by: r.recommended_by ?? "",
          source: r.source ?? "",
          notes: r.notes ?? "",
          category: r.category ?? "Place",
          year: r.created_at.slice(0, 4),
          type: ((r.pin_type ?? "reco") as PinType),
          tags: tagsForSave(r),
          removable: true,
        }
      : {
          id: r.id,
          name: r.name,
          city: r.city,
          country: r.country,
          by: r.recommendedBy ?? "",
          source: r.source ?? "",
          notes: r.notes ?? "",
          category: r.category ?? "Place",
          year: r.dateAdded?.slice(0, 4) ?? "",
          type: r.type,
          tags: r.travelTags ?? tagsForSave(r),
          removable: false,
        };

  const venues = saved.filter((r) => !isCityLevelPlace(r));
  const views = venues.map(rowView);
  const places = ["All places", ...uniqueRecCities(saved)];
  const categories = ["All", ...new Set(views.map((v) => v.category))];
  const inPlace = views.filter((v) => recMatchesPlace(v, placeFilter));
  const inCategory = inPlace.filter((v) => category === "All" || v.category === category);
  const filtered = query.trim()
    ? fuzzyRank(inCategory, query, (v) => [v.name, v.city, v.country, v.by, v.notes])
    : [...inCategory].sort((a, b) => {
        const pinA = vault.comparePins.find((p) => p.id === a.id || p.id === `reco-${a.id}`);
        const pinB = vault.comparePins.find((p) => p.id === b.id || p.id === `reco-${b.id}`);
        if (!pinA || !pinB) return 0;
        return scoreOpportunity(pinB, scorePrefs).score - scoreOpportunity(pinA, scorePrefs).score;
      });

  const handleLink = async () => {
    setError(null);
    setBusy("link");
    try {
      const place = await parseLink({ data: { url: link.trim() } });
      setTagsTouched(false); setMoreTags(false);
      setDraft(draftWithTags({ ...place, category: place.category ?? "Place" }));
    } catch {
      setError("Couldn't read that link. You can still fill the details in yourself.");
      setTagsTouched(false); setMoreTags(false);
      setDraft(draftWithTags({ name: "", url: link.trim() }));
    } finally {
      setBusy(null);
    }
  };

  const handleSearch = async () => {
    setError(null);
    setBusy("search");
    setResults(null);
    try {
      const found = await search({ data: { query: term.trim() } });
      setResults(found);
      if (found.length === 0) setError("Nothing found by that name. Try adding the city.");
    } catch {
      setError("Couldn't search just now. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const handleHere = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("Your device won't share its location.");
      return;
    }
    setBusy("here");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const place = await lookup({ data: { lat: latitude, lon: longitude } });
        setTagsTouched(false); setMoreTags(false);
        setDraft(
          draftWithTags({
            name: "",
            lat: latitude,
            lon: longitude,
            ...(place.city ? { city: place.city } : {}),
            ...(place.country ? { country: place.country } : {}),
            source: "Current location",
          }),
        );
        setBusy(null);
      },
      (err) => {
        const framed = typeof window !== "undefined" && window.self !== window.top;
        setError(
          err.code === 1 && framed
            ? "This preview window isn't allowed to use location. Open Béa in its own tab and try again."
            : err.code === 1
              ? "Your browser is blocking location for this site. Allow it, then try again."
              : "Couldn't get your location just now.",
        );
        setBusy(null);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const findLocation = async () => {
    const q =
      locQuery.trim() ||
      [draft?.name, draft?.address, draft?.city, draft?.country].filter(Boolean).join(", ");
    if (q.trim().length < 2) {
      setError("Type a place or address to find on the map.");
      return;
    }
    setError(null);
    setBusy("location");
    setLocResults(null);
    try {
      const found = await search({ data: { query: q.trim() } });
      setLocResults(found);
      if (found.length === 0) setError("Nothing found for that spot. Try a fuller address or add the city.");
    } catch {
      setError("Couldn't search the map just now. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const pickLocation = (place: ParsedPlace) => {
    if (!draft) return;
    const next: Draft = { ...draft };
    if (place.lat != null) next.lat = place.lat;
    if (place.lon != null) next.lon = place.lon;
    if (place.city) next.city = place.city;
    if (place.country) next.country = place.country;
    if (place.address) next.address = place.address;
    setDraft(next);
    setLocResults(null);
    setLocQuery("");
    setError(null);
  };

  const save = async () => {
    if (!draft?.name.trim()) {
      setError("Give it a name first.");
      return;
    }
    setBusy("save");
    try {
      await vault.add(draft);
      setDraft(null);
      setTagsTouched(false); setMoreTags(false);
      setLocQuery("");
      setLocResults(null);
      setLink("");
      setMode(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell eyebrow={`${views.length} saved`} title="Recommendation vault.">
      <div className="space-y-5">
        <input
          data-guide="reco-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search places, cities, people — typos are fine"
          className="w-full rounded-full border border-border bg-card px-4 py-2.5 text-[13px] outline-none placeholder:text-muted-foreground focus:border-primary"
        />

        <div>
          <p className="label-caps mb-2 text-muted-foreground">Places</p>
          <div data-guide="reco-places" className="flex gap-2 overflow-x-auto pb-1">
            {places.map((c) => (
              <button
                key={c}
                onClick={() => setPlaceFilter(c)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                  placeFilter === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="label-caps mb-2 text-muted-foreground">Kind</p>
          <div data-guide="reco-categories" className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <section>
          <p className="label-caps mb-2 text-foreground">Pin nearby places</p>
          <NearbyMapPin
            existing={venues
              .filter((r): r is RecoRowDB => "lat" in r && r.lat != null && r.lon != null)
              .map((r) => ({
                id: r.id,
                type: (r.pin_type as PinType) || "reco",
                name: r.name,
                city: r.city ?? "",
                country: r.country ?? "",
                lat: r.lat!,
                lon: r.lon!,
                ...(r.category ? { category: r.category } : {}),
              }))}
          />
        </section>

        <section>
          <p className="label-caps mb-2 text-foreground">Save something new</p>
          <div data-guide="reco-add" className="grid grid-cols-2 gap-2">
            {(
              [
                ["link", "Paste a link"],
                ["search", "Search the web"],
                ["here", "I'm here now"],
                ["manual", "By hand"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => {
                  setMode(mode === m ? null : m);
                  setTagsTouched(false); setMoreTags(false);
                  setDraft(m === "manual" ? draftWithTags({ name: "" }) : null);
                  setResults(null);
                  setLocQuery("");
                  setLocResults(null);
                  setError(null);
                  if (m === "here") handleHere();
                }}
                className={`rounded-xl border px-3 py-3 text-left text-[13px] transition-colors ${
                  mode === m ? "border-primary bg-elevated" : "border-border bg-card"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => {
                setMode(mode === "list" ? null : "list");
                setDraft(null);
                setResults(null);
                setLocQuery("");
                setLocResults(null);
                setError(null);
              }}
              className={`col-span-2 rounded-xl border px-3 py-3 text-left text-[13px] transition-colors ${
                mode === "list" ? "border-primary bg-elevated" : "border-border bg-card"
              }`}
            >
              Paste or upload a list
            </button>
          </div>

          {mode === "link" && (
            <div className="rise mt-3 card-soft p-4">
              <p className="label-caps">Paste a link</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                A map link, a restaurant page, an article — Béa pulls out the name, the address and
                the exact spot on the map.
              </p>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary"
              />
              <button
                onClick={handleLink}
                disabled={!link.trim() || busy === "link"}
                className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === "link" ? "Reading the link…" : "Read this link"}
              </button>
            </div>
          )}

          {mode === "search" && (
            <div className="rise mt-3 card-soft p-4">
              <p className="label-caps">Search the web</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Type a place name — add the city if you know it — and Béa finds it on the map.
              </p>
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && term.trim().length > 1) void handleSearch();
                }}
                placeholder="Café de Flore, Paris"
                className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary"
              />
              <button
                onClick={() => void handleSearch()}
                disabled={term.trim().length < 2 || busy === "search"}
                className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === "search" ? "Searching…" : "Search"}
              </button>
              {results && results.length > 0 && (
                <div className="mt-3 space-y-2">
                  {results.map((r) => {
                    const line = placeSuggestionLines(r);
                    return (
                      <button
                        key={`${r.lat}-${r.lon}-${r.name}`}
                        onClick={() => {
                          setTagsTouched(false); setMoreTags(false);
                          setDraft(draftWithTags({ ...r, category: r.category ?? "Place" }));
                          setResults(null);
                        }}
                        className="w-full rounded-xl border border-border bg-background p-3 text-left"
                      >
                        <p className="text-[13px] font-semibold">{line.title}</p>
                        {line.subtitle ? (
                          <p className="text-[11px] text-muted-foreground">{line.subtitle}</p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {mode === "here" && busy === "here" && (
            <p className="mt-3 text-[13px] text-muted-foreground">Finding where you are…</p>
          )}

          {mode === "list" && (
            <RecoListImport
              signedIn={vault.signedIn}
              onAddMany={vault.addMany}
              onSaved={() => {
                setMode(null);
                setError(null);
              }}
            />
          )}

          {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}

          {draft && (
            <div className="rise mt-3 card-soft space-y-2 p-4">
              <p className="label-caps">Check the details</p>
              {(
                [
                  ["name", "Name"],
                  ["category", "Category"],
                  ["city", "City"],
                  ["country", "Country"],
                  ["address", "Address"],
                  ["recommended_by", "Who told you"],
                  ["notes", "Note"],
                ] as const
              ).map(([field, label]) => (
                <input
                  key={field}
                  value={(draft[field] as string | undefined) ?? ""}
                  onChange={(e) => {
                    const next = { ...draft, [field]: e.target.value };
                    const retag = !tagsTouched && (field === "name" || field === "category" || field === "notes" || field === "address");
                    setDraft(retag ? { ...next, travel_tags: suggestTravelTags(next) } : next);
                  }}
                  placeholder={label}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary"
                />
              ))}
              <div className="pt-1">
                <p className="label-caps">Travel tags</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Béa guessed these so she can pick this rec when you ask her to plan. Tap to change.
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(moreTags ? PLACE_TRAVEL_TAGS : (draft.travel_tags ?? [])).map((tag) => {
                    const on = (draft.travel_tags ?? []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setTagsTouched(true);
                          setDraft({ ...draft, travel_tags: toggleTravelTag(draft.travel_tags ?? [], tag) });
                        }}
                        aria-pressed={on}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                          on ? "border-primary bg-card text-foreground" : "border-border/60 text-muted-foreground"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setMoreTags((v) => !v)}
                    className="rounded-full border border-dashed border-border/80 px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    {moreTags ? "Fewer tags" : "Add a tag"}
                  </button>
                </div>
              </div>
              <div data-guide="reco-location" className="pt-1">
                <p className="label-caps">Location on the map</p>
                {draft.lat != null ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Pinned at {draft.lat.toFixed(4)}, {draft.lon?.toFixed(4)}. Search again to move it.
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    No exact spot yet. Search a place or address and pick the pin yourself — Near and
                    directions need it.
                  </p>
                )}
                <input
                  value={locQuery}
                  onChange={(e) => setLocQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void findLocation();
                    }
                  }}
                  placeholder="Search a place, street, or city"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => void findLocation()}
                  disabled={busy === "location"}
                  className="mt-2 w-full rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
                >
                  {busy === "location" ? "Searching the map…" : "Find this spot"}
                </button>
                {locResults && locResults.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {locResults.map((r) => {
                      const line = placeSuggestionLines(r);
                      return (
                        <button
                          key={`${r.lat}-${r.lon}-${r.name}`}
                          type="button"
                          onClick={() => pickLocation(r)}
                          className="w-full rounded-xl border border-border bg-background p-3 text-left"
                        >
                          <p className="text-[13px] font-semibold">{line.title}</p>
                          {line.subtitle ? (
                            <p className="text-[11px] text-muted-foreground">{line.subtitle}</p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="pt-1">
                <p className="label-caps">Pin on the map</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {pinChoices.map((t) => {
                    const on = (draft.pin_type ?? "reco") === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDraft({ ...draft, pin_type: t })}
                        aria-pressed={on}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                          on ? "border-primary bg-card" : "border-border/60 text-muted-foreground"
                        }`}
                      >
                        <span className={`size-2 rounded-full ${pinColorClass[t]}`} />
                        {pinLabel[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={save}
                disabled={busy === "save"}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === "save" ? "Saving…" : "Save to vault"}
              </button>
              {!vault.signedIn && (
                <p className="text-[11px] text-muted-foreground">
                  Sign in on the You tab to keep this saved to your account.
                </p>
              )}
            </div>
          )}
        </section>

        <section data-guide="reco-list" className="space-y-3">
          {filtered.map((v) => (
            <article key={v.id} className="card-soft p-3.5">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${pinColorClass[v.type]}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[18px] leading-tight">{v.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {[v.city, v.country].filter(Boolean).join(", ")}
                    {v.by ? ` · by ${v.by}` : ""}
                    {v.source ? ` · ${v.source}` : ""}
                  </p>
                  {v.notes && <p className="mt-1.5 text-[13px] leading-snug">{v.notes}</p>}
                  {v.tags.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{v.tags.join(" · ")}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {v.category}
                  </span>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{v.year}</p>
                  {v.removable && (
                    <button
                      onClick={() => void vault.remove(v.id)}
                      className="mt-1.5 text-[10px] text-muted-foreground underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Nothing saved matches that yet.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
