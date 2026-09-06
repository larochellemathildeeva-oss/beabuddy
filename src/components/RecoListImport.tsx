import { useRef, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImageIcon } from "lucide-react";
import { pinColorClass, pinLabel, type PinType } from "@/data/atlas";
import type { NewReco } from "@/hooks/useRecommendations";
import { downscaleImage } from "@/lib/image";
import { placeSuggestionLines } from "@/lib/place-label";
import { searchPlaces } from "@/lib/places.functions";
import { loneHttpsUrl } from "@/lib/html-text";
import { parseRecoList } from "@/lib/reco-list.functions";
import {
  applySearchHits,
  draftsToSave,
  RECO_LIST_CATEGORIES,
  searchQueryForReco,
  startRecoDrafts,
  type RecoListDraft,
} from "@/lib/reco-list";
import { localPlaceHits, PLACE_LOOKUP_GAP_MS } from "@/lib/world-countries";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const pinChoices: PinType[] = ["reco", "wishlist", "nexttime", "visited"];

export function RecoListImport({
  signedIn,
  onAddMany,
  onSaved,
}: {
  signedIn: boolean;
  onAddMany: (rows: NewReco[]) => Promise<void>;
  onSaved?: () => void;
}) {
  const parseList = useServerFn(parseRecoList);
  const search = useServerFn(searchPlaces);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [drafts, setDrafts] = useState<RecoListDraft[] | null>(null);
  const [searchingAt, setSearchingAt] = useState(-1);
  const [recommendedBy, setRecommendedBy] = useState("");
  const [paste, setPaste] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [listSource, setListSource] = useState("Uploaded list");

  const ingest = async (input: {
    imageDataUrls: string[] | null;
    text: string | null;
    pageUrl: string | null;
    source: string;
  }) => {
    setBusy("read");
    setError(null);
    setDrafts(null);
    setSummary("");
    try {
      const out = await parseList({
        data: {
          imageDataUrls: input.imageDataUrls,
          text: input.text,
          pageUrl: input.pageUrl,
        },
      });
      const started = startRecoDrafts(
        out.items.map((item) => ({
          name: item.name,
          ...(item.city ? { city: item.city } : {}),
          ...(item.notes ? { notes: item.notes } : {}),
          ...(item.category ? { category: item.category } : {}),
        })),
      );
      if (started.length === 0) {
        throw new Error("Béa didn't find any places on that list.");
      }
      setListSource(input.source);
      setSummary(out.summary);
      setDrafts(started);
      void lookupOneByOne(started);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that list.");
    } finally {
      setBusy(null);
    }
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    try {
      const images: string[] = [];
      const texts: string[] = [];
      for (const file of files.slice(0, 4)) {
        const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
        const isText = file.type.startsWith("text/") || /\.(txt|md|csv|list)$/i.test(file.name);
        if (isImage) images.push(await downscaleImage(file));
        else if (isText || file.size < 200_000) texts.push(await file.text());
        else throw new Error("Use a picture or a text file.");
      }
      if (!images.length && !texts.join("").trim()) {
        throw new Error("Use a picture or a text file.");
      }
      await ingest({
        imageDataUrls: images.length ? images : null,
        text: texts.join("\n\n").trim() || null,
        pageUrl: null,
        source: "Uploaded list",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that list.");
    }
  };

  const onReadPaste = async () => {
    const typedLink = loneHttpsUrl(pageUrl) ?? loneHttpsUrl(paste);
    const extra =
      typedLink && paste.trim() && loneHttpsUrl(paste) !== typedLink ? paste.trim() : paste.trim();
    if (typedLink) {
      await ingest({
        imageDataUrls: null,
        text: extra && extra !== typedLink ? extra : null,
        pageUrl: typedLink,
        source: typedLink,
      });
      return;
    }
    if (paste.trim().length < 3) {
      setError("Paste a list of places, or a page of things to do.");
      return;
    }
    await ingest({
      imageDataUrls: null,
      text: paste.trim(),
      pageUrl: null,
      source: "Pasted list",
    });
  };

  const lookupOneByOne = async (rows: RecoListDraft[]) => {
    const next = [...rows];
    let mapCalls = 0;
    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      if (!row || row.query.length < 2) {
        next[i] = { ...row!, status: "empty" };
        setDrafts([...next]);
        continue;
      }
      const local = localPlaceHits(row.query);
      if (local.length) {
        next[i] = applySearchHits(row, [...local]);
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
        next[i] = applySearchHits(row, hits);
      } catch {
        next[i] = applySearchHits(row, []);
      }
      setDrafts([...next]);
    }
    setSearchingAt(-1);
  };

  const patch = (index: number, update: Partial<RecoListDraft>) => {
    setDrafts((cur) => cur?.map((row, i) => (i === index ? { ...row, ...update } : row)) ?? null);
  };

  const lookupRow = async (index: number) => {
    const row = drafts?.[index];
    if (!row || row.query.length < 2) return;
    setSearchingAt(index);
    patch(index, { status: "searching" });
    try {
      const hits = await search({ data: { query: row.query } });
      setDrafts((cur) => cur?.map((item, i) => (i === index ? applySearchHits(item, hits) : item)) ?? null);
    } catch {
      setDrafts((cur) => cur?.map((item, i) => (i === index ? applySearchHits(item, []) : item)) ?? null);
    } finally {
      setSearchingAt(-1);
    }
  };

  const save = async () => {
    if (!drafts) return;
    const payload = draftsToSave(drafts, recommendedBy, listSource);
    if (payload.length === 0) {
      setError("Pick at least one place to save.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      await onAddMany(payload);
      setDrafts(null);
      setSummary("");
      setRecommendedBy("");
      setPaste("");
      setPageUrl("");
      setListSource("Uploaded list");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save those places.");
    } finally {
      setBusy(null);
    }
  };

  const readyCount = drafts?.filter((row) => !row.skip).length ?? 0;
  const looking = searchingAt >= 0;

  return (
    <div className="rise mt-3 card-soft space-y-3 p-4">
      <p className="label-caps">Paste or upload a list</p>
      <p className="text-[13px] text-muted-foreground">
        Paste names from your notes, a page of things to do, or upload a photo or file. Béa reads
        them, looks each one up, then you can edit and pick the right pin before anything is saved.
      </p>
      <textarea
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        rows={4}
        maxLength={20000}
        placeholder="One place per line, or paste a whole note…"
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary"
      />
      <label className="block">
        <span className="text-[12px] font-medium">Or a page of suggestions</span>
        <input
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          type="url"
          inputMode="url"
          placeholder="https:// — Time Out, a blog, things to do…"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary"
        />
      </label>
      <button
        type="button"
        onClick={() => void onReadPaste()}
        disabled={busy !== null || looking || (paste.trim().length < 3 && !loneHttpsUrl(pageUrl))}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy === "read"
          ? "Reading…"
          : loneHttpsUrl(pageUrl) || loneHttpsUrl(paste)
            ? "Read this page"
            : "Read this list"}
      </button>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onImportFile(e)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,text/plain,text/csv,.txt,.md,.csv,.list"
        multiple
        className="hidden"
        onChange={(e) => void onImportFile(e)}
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy !== null || looking}
          className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-[13px] font-medium disabled:opacity-50"
        >
          <Camera className="size-4" /> Take a picture
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null || looking}
          className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-[13px] font-medium disabled:opacity-50"
        >
          <ImageIcon className="size-4" /> Upload a list
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Lists, pictures and public pages are sent to an AI provider to read them — skip passport
        numbers, card details or other sensitive information.
      </p>
      {busy === "read" && <p className="text-[13px] text-muted-foreground">Reading the list…</p>}
      {looking && (
        <p className="text-[13px] text-muted-foreground">
          Looking up {searchingAt + 1} of {drafts?.length ?? 0}…
        </p>
      )}
      {error && <p className="text-[12px] text-destructive">{error}</p>}

      {drafts && (
        <div className="space-y-3">
          {summary && <p className="text-[12px] text-muted-foreground">{summary}</p>}
          <input
            value={recommendedBy}
            onChange={(e) => setRecommendedBy(e.target.value)}
            placeholder="Who told you (optional — applies to all)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary"
          />
          {drafts.map((row, i) => (
            <article key={`${row.originalName}-${i}`} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {row.status === "searching"
                    ? "Searching the map…"
                    : row.status === "pending"
                      ? "Waiting…"
                      : row.status === "empty"
                        ? "No map match — edit the name and look it up, or skip."
                        : "Edit the details, then pick the right pin."}
                </p>
                <button
                  type="button"
                  onClick={() => patch(i, { skip: !row.skip })}
                  className="shrink-0 text-[11px] text-muted-foreground underline"
                >
                  {row.skip ? "Include" : "Skip"}
                </button>
              </div>
              {!row.skip && (
                <div className="mt-2 space-y-2">
                  <input
                    value={row.originalName}
                    onChange={(e) => {
                      const name = e.target.value;
                      patch(i, {
                        originalName: name,
                        query: searchQueryForReco({ name, city: row.city }),
                      });
                    }}
                    aria-label={`Name for suggestion ${i + 1}`}
                    className="w-full rounded-lg border border-border bg-elevated px-2.5 py-2 text-[13px] font-medium outline-none focus:border-primary"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={row.city ?? ""}
                      onChange={(e) => {
                        const city = e.target.value;
                        patch(i, {
                          city: city || undefined,
                          query: searchQueryForReco({ name: row.originalName, city }),
                        });
                      }}
                      aria-label={`City for ${row.originalName || `suggestion ${i + 1}`}`}
                      placeholder="City"
                      className="rounded-lg border border-border bg-elevated px-2.5 py-2 text-[13px] outline-none focus:border-primary"
                    />
                    <select
                      value={row.category ?? "Place"}
                      onChange={(e) => patch(i, { category: e.target.value })}
                      aria-label={`Category for ${row.originalName || `suggestion ${i + 1}`}`}
                      className="rounded-lg border border-border bg-elevated px-2.5 py-2 text-[13px] outline-none"
                    >
                      {RECO_LIST_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={row.notes ?? ""}
                    onChange={(e) => patch(i, { notes: e.target.value || undefined })}
                    rows={2}
                    maxLength={400}
                    aria-label={`Note for ${row.originalName || `suggestion ${i + 1}`}`}
                    placeholder="Note — why it's here, a dish, a neighbourhood…"
                    className="w-full rounded-lg border border-border bg-elevated px-2.5 py-2 text-[13px] outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => void lookupRow(i)}
                    disabled={looking || row.originalName.trim().length < 2}
                    className="text-[12px] font-medium text-primary underline disabled:opacity-50"
                  >
                    Look up this name
                  </button>
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
              {!row.skip && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {pinChoices.map((t) => {
                    const on = row.pin_type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => patch(i, { pin_type: t })}
                        aria-pressed={on}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                          on ? "border-primary bg-card" : "border-border/60 text-muted-foreground"
                        }`}
                      >
                        <span className={`size-2 rounded-full ${pinColorClass[t]}`} />
                        {pinLabel[t]}
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy === "save" || looking || readyCount === 0}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : `Save ${readyCount} ${readyCount === 1 ? "place" : "places"}`}
          </button>
          {!signedIn && (
            <p className="text-[11px] text-muted-foreground">
              Sign in on the You tab to keep these saved to your account.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
