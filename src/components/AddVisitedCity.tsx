import { useRef, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { useRecommendations } from "@/hooks/useRecommendations";
import {
  applyCityHits,
  correctCityDraft,
  draftsToCities,
  parseCityListText,
  startCityDrafts,
  type CityListDraft,
} from "@/lib/city-list";
import { placeSuggestionLines } from "@/lib/place-label";
import { searchPlaces, type ParsedPlace } from "@/lib/places.functions";
import { localPlaceHits, PLACE_LOOKUP_GAP_MS } from "@/lib/world-countries";
import type { PinType } from "@/data/atlas";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const types: { type: PinType; label: string }[] = [
  { type: "visited", label: "Been there" },
  { type: "wishlist", label: "Wishlist" },
  { type: "nexttime", label: "Next time" },
];

/**
 * Lets someone type a city by hand, or paste / upload a list from their notes,
 * pick each pin off the map and drop it on the globe.
 */
export function AddVisitedCity({ onSaved }: { onSaved?: () => void }) {
  const vault = useRecommendations();
  const search = useServerFn(searchPlaces);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"one" | "list">("one");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ParsedPlace | null>(null);
  const [type, setType] = useState<PinType>("visited");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [paste, setPaste] = useState("");
  const [drafts, setDrafts] = useState<CityListDraft[] | null>(null);
  const [searchingAt, setSearchingAt] = useState(-1);
  const [listSource, setListSource] = useState("Pasted list");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  const looking = searchingAt >= 0;
  const readyCount = drafts?.filter((row) => !row.skip && row.chosen != null).length ?? 0;

  const resetList = () => {
    setDrafts(null);
    setPaste("");
    setSearchingAt(-1);
    setEditing(null);
  };

  const lookup = async (names: string[], source: string) => {
    const started = startCityDrafts(names);
    if (started.length === 0) {
      setErr("Béa didn't find any place names in that list.");
      return;
    }
    setErr("");
    setMsg("");
    setEditing(null);
    setListSource(source);
    setDrafts(started);
    const next = [...started];
    let mapCalls = 0;
    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      if (row?.status === "ready" && row.hits.length) continue;
      if (!row || row.query.length < 2) {
        next[i] = { ...row!, status: "empty" };
        setDrafts([...next]);
        continue;
      }
      next[i] = { ...row, status: "searching" };
      setSearchingAt(i);
      setDrafts([...next]);
      if (mapCalls > 0) await wait(PLACE_LOOKUP_GAP_MS);
      mapCalls += 1;
      try {
        let hits = await search({ data: { query: row.query } });
        if (hits.length === 0) {
          await wait(PLACE_LOOKUP_GAP_MS);
          hits = await search({ data: { query: row.query } });
        }
        next[i] = applyCityHits(row, hits);
      } catch {
        next[i] = applyCityHits(row, []);
      }
      setDrafts([...next]);
    }
    setSearchingAt(-1);
  };

  const lookupRow = async (index: number) => {
    const row = drafts?.[index];
    if (!row || row.query.trim().length < 2) return;
    const corrected = correctCityDraft(row, row.query);
    if (corrected.status === "ready") {
      setDrafts((cur) => cur?.map((item, i) => (i === index ? corrected : item)) ?? null);
      setEditing(null);
      setErr("");
      return;
    }
    setErr("");
    setSearchingAt(index);
    setDrafts((cur) => cur?.map((item, i) => (i === index ? { ...corrected, status: "searching" } : item)) ?? null);
    try {
      const local = localPlaceHits(corrected.query);
      let hits = local.length ? [...local] : await search({ data: { query: corrected.query } });
      if (hits.length === 0) {
        await wait(PLACE_LOOKUP_GAP_MS);
        hits = await search({ data: { query: corrected.query } });
      }
      const next = applyCityHits(corrected, hits);
      setDrafts((cur) => cur?.map((item, i) => (i === index ? next : item)) ?? null);
      if (next.status === "ready") setEditing(null);
    } catch {
      setDrafts((cur) => cur?.map((item, i) => (i === index ? applyCityHits(corrected, []) : item)) ?? null);
    } finally {
      setSearchingAt(-1);
    }
  };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isText = file.type.startsWith("text/") || /\.(txt|md|csv|list)$/i.test(file.name);
    if (!isText && file.size >= 200_000) {
      setErr("Use a text file from your notes — one city per line is perfect.");
      return;
    }
    const text = await file.text();
    setPaste(text);
    await lookup(parseCityListText(text), "Uploaded list");
  };

  const saveOne = async () => {
    if (!picked || picked.lat == null || picked.lon == null) {
      setErr("Pick a city from the list first so it can go on the globe.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await vault.add({
        name: picked.city || picked.name || query.trim(),
        city: picked.city || picked.name || query.trim(),
        country: picked.country,
        lat: picked.lat,
        lon: picked.lon,
        category: "City",
        pin_type: type,
        source: "Added by hand",
        notes: [when ? `Visited ${when}` : "", note.trim()].filter(Boolean).join(" — ") || undefined,
      });
      setMsg(`${picked.city || picked.name} is on your globe.`);
      setPicked(null);
      setQuery("");
      setWhen("");
      setNote("");
      onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  const saveList = async () => {
    if (!drafts) return;
    const payload = draftsToCities(drafts, type, listSource);
    if (payload.length === 0) {
      setErr("Pick at least one city with a map pin.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await vault.addMany(payload);
      setMsg(
        payload.length === 1
          ? `${payload[0]?.name} is on your globe.`
          : `${payload.length} cities are on your globe.`,
      );
      resetList();
      onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save those.");
    } finally {
      setBusy(false);
    }
  };

  const patch = (index: number, update: Partial<CityListDraft>) => {
    setDrafts((cur) => cur?.map((row, i) => (i === index ? { ...row, ...update } : row)) ?? null);
  };

  return (
    <section data-guide="add-city" className="rounded-2xl border border-border bg-card p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="add-city-body"
        className="flex w-full items-center justify-between text-left"
      >
        <span className="label-caps text-foreground">Add cities or countries</span>
        <span className={`text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
      </button>

      {open && (
        <div id="add-city-body" className="mt-3 space-y-3">
          <p className="text-[12px] text-muted-foreground">
            One city or country, or a whole list from your notes. Country names are recognised
            straight away. Other names are looked up so you can pick the pin before anything lands
            on the globe.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("one")}
              className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${
                mode === "one" ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              One city
            </button>
            <button
              type="button"
              onClick={() => setMode("list")}
              className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${
                mode === "list" ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              Paste or upload a list
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t.type}
                onClick={() => setType(t.type)}
                className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                  type === t.type ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mode === "one" && (
            <>
              <PlaceSearchInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPicked(null);
                  setMsg("");
                }}
                onPick={(p) => {
                  setPicked(p);
                  setQuery(p.city || p.name);
                  setMsg("");
                }}
                placeholder="Search a city, e.g. Lisbon"
              />

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[12px] text-muted-foreground">
                  When (optional)
                  <input
                    type="month"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                  />
                </label>
                <label className="text-[12px] text-muted-foreground">
                  Note (optional)
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything to remember"
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                </label>
              </div>
            </>
          )}

          {mode === "list" && (
            <>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={5}
                placeholder={"France\nSpain\nParis\nLisbon"}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary"
              />
              <input
                ref={fileRef}
                type="file"
                accept="text/plain,text/csv,.txt,.md,.csv,.list"
                className="hidden"
                onChange={(e) => void onUpload(e)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy || looking}
                  className="rounded-xl border border-border px-3 py-2.5 text-[13px] font-medium disabled:opacity-50"
                >
                  Upload a list
                </button>
                <button
                  type="button"
                  onClick={() => void lookup(parseCityListText(paste), "Pasted list")}
                  disabled={busy || looking || paste.trim().length < 2}
                  className="rounded-xl bg-primary px-3 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {looking ? "Looking up…" : "Look these up"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                One city or country per line is best. A comma-separated line from Notes works too.
              </p>
              {looking && (
                <p className="text-[13px] text-muted-foreground">
                  Looking up {searchingAt + 1} of {drafts?.length ?? 0}…
                </p>
              )}
              {drafts && (
                <div className="space-y-2">
                  {drafts.map((row, i) => (
                    <article key={`${row.originalName}-${i}`} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-semibold">{row.originalName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {row.status === "searching"
                              ? "Searching the map…"
                              : row.status === "pending"
                                ? "Waiting…"
                                : row.status === "empty"
                                  ? "Not recognised — skip, or correct it."
                                  : "Pick the right pin."}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-3">
                          {!row.skip && row.status !== "empty" && row.status !== "searching" && editing !== i && (
                            <button
                              type="button"
                              onClick={() => setEditing(i)}
                              className="text-[11px] font-semibold text-primary underline"
                            >
                              Correct it
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => patch(i, { skip: !row.skip })}
                            className="text-[11px] text-muted-foreground underline"
                          >
                            {row.skip ? "Include" : "Skip"}
                          </button>
                        </div>
                      </div>
                      {!row.skip && (row.status === "empty" || editing === i) && (
                        <div className="mt-2 space-y-2">
                          <label className="block">
                            <span className="text-[11px] text-muted-foreground">Correct the name</span>
                            <input
                              value={row.query}
                              onChange={(e) => patch(i, { query: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void lookupRow(i);
                                }
                              }}
                              placeholder="Usual country or city name"
                              aria-label={`Correct ${row.originalName}`}
                              className="mt-1 w-full rounded-lg border border-border bg-elevated px-2.5 py-2 text-[13px] outline-none focus:border-primary"
                            />
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => void lookupRow(i)}
                              disabled={looking || row.query.trim().length < 2}
                              className="text-[12px] font-semibold text-primary underline disabled:opacity-50"
                            >
                              {searchingAt === i ? "Looking up…" : "Correct it"}
                            </button>
                            {row.status !== "empty" && (
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className="text-[11px] text-muted-foreground underline"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {!row.skip && row.hits.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {row.hits.map((hit, h) => {
                            const line = placeSuggestionLines(hit);
                            const on = row.chosen === h;
                            return (
                              <button
                                key={`${hit.lat}-${hit.lon}-${hit.name}`}
                                type="button"
                                onClick={() => patch(i, { chosen: h })}
                                className={`w-full rounded-lg border px-2.5 py-2 text-left ${
                                  on ? "border-primary bg-elevated" : "border-border/60"
                                }`}
                              >
                                <p className="text-[13px] font-medium">{line.title}</p>
                                {line.subtitle ? (
                                  <p className="text-[11px] text-muted-foreground">{line.subtitle}</p>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {err && <p className="text-[12px] text-destructive">{err}</p>}
          {msg && <p className="text-[12px] text-muted-foreground">{msg}</p>}

          <button
            onClick={() => void (mode === "list" ? saveList() : saveOne())}
            disabled={
              busy || looking || (mode === "one" ? !picked : !drafts || readyCount === 0)
            }
            className="w-full rounded-full bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : mode === "list"
                ? `Add ${readyCount} ${readyCount === 1 ? "place" : "places"} to my globe`
                : "Add to my globe"}
          </button>
        </div>
      )}
    </section>
  );
}
