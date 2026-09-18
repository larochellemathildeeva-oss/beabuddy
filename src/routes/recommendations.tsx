import { createFileRoute } from "@tanstack/react-router";
import { RowListSkeleton } from "@/components/Skeletons";
import { confirm } from "@/lib/haptics";
import { hostOf, linkFailureMessage } from "@/lib/link-failure";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bookmark, Check, Plus, StickyNote, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { NearbyMapPin } from "@/components/NearbyMapPin";
import { RecoListImport } from "@/components/RecoListImport";
import { ShareRecos } from "@/components/ShareRecos";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import {
  addPlaceholder,
  anyFilterWorthShowing,
  kindFilterWorthShowing,
  placeFilterWorthShowing,
  searchWorthShowing,
} from "@/lib/reco-ui";
import { useAuth } from "@/hooks/useAuth";
import { pinColorClass, pinLabel, type Pin, type PinType } from "@/data/atlas";
import { useRecommendations, type RecoRowDB } from "@/hooks/useRecommendations";
import {
  PLACE_TRAVEL_TAGS,
  suggestTravelTags,
  tagsForSave,
  toggleTravelTag,
} from "@/lib/reco-tags";
import {
  parsePlaceLink,
  lookupCoords,
  searchPlaces,
  type ParsedPlace,
} from "@/lib/places.functions";
import { extractPastedPlaceLink, looksLikePastedPlaceLink } from "@/lib/place-paste";
import { placeSuggestionLines } from "@/lib/place-label";
import { prettyPlaceCategory } from "@/lib/place-kind";
import { useUndo } from "@/hooks/useUndo";
import {
  capturedFromParsedPlace,
  capturedFromReco,
  findDuplicate,
  toNewReco,
} from "@/lib/captured-place";
import { fuzzyRank } from "@/lib/fuzzy";
import { isCityLevelPlace, recMatchesPlace, uniqueRecCities } from "@/lib/reco-place";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { scoreOpportunity } from "@/lib/score-opportunity";
import { beaLine } from "@/lib/bea-voice";

export const Route = createFileRoute("/recommendations")({
  staticData: { plane: "tab" },
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

/** Optional draft fields, shown as chips rather than seven stacked inputs. */
const DRAFT_FIELDS = [
  ["category", "Category"],
  ["recommended_by", "Who told you"],
  ["notes", "Note"],
  ["city", "City"],
  ["country", "Country"],
  ["address", "Address"],
] as const;

type DraftField = (typeof DRAFT_FIELDS)[number][0] | "name";

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
  /** The other ways in, folded away until asked for. */
  const [moreWays, setMoreWays] = useState(false);
  /** What the one add field currently holds. */
  const [addText, setAddText] = useState("");
  const [locQuery, setLocQuery] = useState("");
  const [locResults, setLocResults] = useState<ParsedPlace[] | null>(null);
  const draftRef = useRef<HTMLDivElement | null>(null);
  const [justDrafted, setJustDrafted] = useState(0);
  /** The rec just saved, while the offer to fill in the rest is still up. */
  const [justSaved, setJustSaved] = useState<{ id: string; name: string } | null>(null);
  const [refining, setRefining] = useState<"pin" | "who" | "note" | null>(null);
  const [refineText, setRefineText] = useState("");
  /** Which optional draft field is open, if any. */
  const [draftField, setDraftField2] = useState<Exclude<DraftField, "name"> | null>(null);

  // The draft card is appended below the paste/search card, which on a phone
  // puts it off-screen — the reason reading a link looked like it did nothing.
  useEffect(() => {
    if (!justDrafted || !draftRef.current) return;
    draftRef.current.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, [justDrafted]);

  /** Every path that produces a draft goes through here, so none of them can
   *  leave the card sitting unseen at the bottom of the page. */
  const showDraft = (next: Draft) => {
    setTagsTouched(false);
    setMoreTags(false);
    setDraft(draftWithTags(next));
    setResults(null);
    setJustDrafted((n) => n + 1);
  };

  const vault = useRecommendations();
  const { user } = useAuth();
  // Profiles are readable only by their owner, so a recipient can never look
  // this up — it is captured onto the share row when the share is made.
  const myName =
    (user?.user_metadata?.["display_name"] as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";
  const { removeWithUndo } = useUndo();
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
          type: (r.pin_type ?? "reco") as PinType,
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
    const extracted = extractPastedPlaceLink(link);
    if (!extracted) {
      setError(
        "That doesn't look like a link. Paste the whole thing — share text with a link in it is fine.",
      );
      setBusy(null);
      return;
    }
    try {
      const place = await parseLink({
        data: extracted.nameHint
          ? { url: extracted.url, nameHint: extracted.nameHint }
          : { url: extracted.url },
      });
      showDraft({ ...place, category: prettyPlaceCategory(place) });
      if (place.partial) setError(linkFailureMessage(place.partialReason, hostOf(place.url)));
    } catch {
      setError("Couldn't read that link. You can still fill the details in yourself.");
      showDraft({ name: extracted.nameHint ?? "", url: extracted.url });
    } finally {
      setBusy(null);
    }
  };

  const handleSearch = async () => {
    setError(null);
    const pasted = extractPastedPlaceLink(term);
    if (pasted) {
      setBusy("search");
      setResults(null);
      try {
        const place = await parseLink({
          data: pasted.nameHint
            ? { url: pasted.url, nameHint: pasted.nameHint }
            : { url: pasted.url },
        });
        showDraft({ ...place, category: prettyPlaceCategory(place) });
        if (place.partial) setError(linkFailureMessage(place.partialReason, hostOf(place.url)));
      } catch {
        setError("Couldn't read that link. Try Paste a link, or type the place name.");
      } finally {
        setBusy(null);
      }
      return;
    }
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
        showDraft({
          name: "",
          lat: latitude,
          lon: longitude,
          ...(place.city ? { city: place.city } : {}),
          ...(place.country ? { country: place.country } : {}),
          source: "Current location",
        });
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
      if (found.length === 0)
        setError("Nothing found for that spot. Try a fuller address or add the city.");
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

  /** The saved rec this draft would duplicate, if any. */
  const existingMatch = draft?.name.trim()
    ? findDuplicate(
        vault.rows.map((r) => ({
          id: r.id,
          name: r.name,
          city: r.city,
          lat: r.lat,
          lon: r.lon,
        })),
        {
          name: draft.name,
          ...(draft.city ? { city: draft.city } : {}),
          ...(draft.lat != null ? { lat: draft.lat } : {}),
          ...(draft.lon != null ? { lon: draft.lon } : {}),
        },
      )
    : undefined;

  /**
   * Edit one draft field, re-guessing the travel tags from the fields that
   * feed them — unless the traveller has already set the tags by hand.
   */
  const setDraftField = (field: DraftField, value: string) => {
    if (!draft) return;
    const next = { ...draft, [field]: value };
    const retag =
      !tagsTouched &&
      (field === "name" || field === "category" || field === "notes" || field === "address");
    setDraft(retag ? { ...next, travel_tags: suggestTravelTags(next) } : next);
  };

  /**
   * Save a looked-up place in one tap. Everything optional — who told you
   * about it, a note, which pin it is — is offered afterwards, once the rec
   * exists, rather than asked for before it does.
   */
  const quickSave = async (found: ParsedPlace) => {
    setBusy("quick");
    setError(null);
    try {
      const captured = capturedFromParsedPlace(found);
      const id = await vault.add({
        ...toNewReco(captured, { category: prettyPlaceCategory(found) }),
        travel_tags: suggestTravelTags({ name: found.name, category: prettyPlaceCategory(found) }),
      });
      setResults(null);
      setDraft(null);
      setRefining(null);
      setRefineText("");
      confirm();
      if (id) setJustSaved({ id, name: found.name });
      else {
        const line = beaLine("recs.saved");
        toast.success(line.title, { description: line.body });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that one.");
    } finally {
      setBusy(null);
    }
  };

  /** Fill in one optional thing on the rec just saved. */
  const refineSaved = async (patch: Parameters<typeof vault.update>[1]) => {
    if (!justSaved) return;
    try {
      await vault.update(justSaved.id, patch);
      setRefining(null);
      setRefineText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update that.");
    }
  };

  const save = async () => {
    if (!draft?.name.trim()) {
      setError("Give it a name first.");
      return;
    }
    setBusy("save");
    try {
      const savedId = await vault.add(draft);
      confirm();
      const line = beaLine("recs.saved");
      toast.success(line.title, { description: line.body });
      if (savedId) setJustSaved({ id: savedId, name: draft.name.trim() });
      setRefining(null);
      setRefineText("");
      setDraft(null);
      setDraftField2(null);
      setTagsTouched(false);
      setMoreTags(false);
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
        {/* One field, whatever you have. A name gets looked up as you type; a
            pasted link gets read. The five equal-weight buttons that used to
            live here are folded into "Other ways" below, because four of them
            are rare and the fifth was this. */}
        <section data-guide="reco-add" className="surface border border-border/50 p-3.5">
          <p className="font-display text-[16.5px] leading-tight">Save a place</p>
          <p className="mb-2.5 mt-0.5 text-[12.5px] text-muted-foreground">
            Type a name, or paste a link from Maps, Instagram, a blog — anywhere.
          </p>
          <PlaceSearchInput
            value={addText}
            onChange={setAddText}
            onPick={(place) => {
              setAddText("");
              showDraft({ ...place, category: prettyPlaceCategory(place) });
            }}
            placeholder={addPlaceholder(views.length > 0)}
            quickAdd={{
              label: "Save",
              busyLabel: "Saving…",
              onAdd: async (place) => {
                await quickSave(place);
                setAddText("");
              },
            }}
          />

          <button
            type="button"
            onClick={() => setMoreWays((v) => !v)}
            aria-expanded={moreWays}
            className="mt-2 text-[12.5px] text-muted-foreground underline"
          >
            {moreWays ? "Fewer ways" : "Other ways to save"}
          </button>

          {moreWays && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ["here", "I'm here now"],
                  ["manual", "By hand"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(mode === m ? null : m);
                    setTagsTouched(false);
                    setMoreTags(false);
                    if (m === "manual") showDraft({ name: "" });
                    else setDraft(null);
                    setResults(null);
                    setLocQuery("");
                    setLocResults(null);
                    setError(null);
                    if (m === "here") handleHere();
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-left text-[14px] transition-colors ${
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
                className={`col-span-2 rounded-xl border px-3 py-2.5 text-left text-[14px] transition-colors ${
                  mode === "list" ? "border-primary bg-elevated" : "border-border bg-card"
                }`}
              >
                Paste or upload a list
              </button>
              <div className="col-span-2">
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
              </div>
            </div>
          )}
          {mode === "here" && busy === "here" && (
            <p className="mt-3 text-[14.5px] text-muted-foreground">Finding where you are…</p>
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

          {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}

          {/* Saved first, filled in after. Who told you about it and which pin
              it is are the two things worth asking, and neither is worth
              blocking the save over. */}
          {justSaved && (
            <div className="rise mt-3 space-y-2 rounded-xl border border-primary/40 bg-elevated p-3">
              <div className="flex items-start justify-between gap-2">
                <p aria-live="polite" className="min-w-0 text-[14.5px]">
                  <Check className="mr-1 inline size-4 text-primary" aria-hidden />
                  Saved <span className="font-medium">{justSaved.name}</span>
                </p>
                <button
                  type="button"
                  aria-label="Done with this one"
                  onClick={() => {
                    setJustSaved(null);
                    setRefining(null);
                    setRefineText("");
                  }}
                  className="grid size-6 shrink-0 place-items-center rounded-full border border-border"
                >
                  <X className="size-3" />
                </button>
              </div>

              {refining === null && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRefining("pin")}
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[12px]"
                  >
                    <Bookmark className="size-3.5" aria-hidden /> Which pin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefining("who");
                      setRefineText("");
                    }}
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[12px]"
                  >
                    <UserRound className="size-3.5" aria-hidden /> Who told you
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefining("note");
                      setRefineText("");
                    }}
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[12px]"
                  >
                    <StickyNote className="size-3.5" aria-hidden /> Add a note
                  </button>
                </div>
              )}

              {refining === "pin" && (
                <div className="flex flex-wrap gap-1.5">
                  {pinChoices.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => void refineSaved({ pin_type: t })}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px]"
                    >
                      <span className={`size-2 rounded-full ${pinColorClass[t]}`} aria-hidden />
                      {pinLabel[t]}
                    </button>
                  ))}
                </div>
              )}

              {(refining === "who" || refining === "note") && (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      void refineSaved(
                        refining === "who"
                          ? { recommended_by: refineText.trim() }
                          : { notes: refineText.trim() },
                      );
                    }}
                    placeholder={
                      refining === "who" ? "A friend, a guide, a stranger…" : "Why it's worth it"
                    }
                    aria-label={refining === "who" ? "Who told you" : "Note"}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
                  />
                  <button
                    type="button"
                    disabled={!refineText.trim()}
                    onClick={() =>
                      void refineSaved(
                        refining === "who"
                          ? { recommended_by: refineText.trim() }
                          : { notes: refineText.trim() },
                      )
                    }
                    className="shrink-0 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          )}

          {draft && (
            <div ref={draftRef} className="rise mt-3 card-soft space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="label-caps">Check the details</p>
                  <p className="text-[12px] text-muted-foreground">
                    Name is the only part Béa needs. Everything else can wait.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setDraftField2(null);
                    setLocQuery("");
                    setLocResults(null);
                    setError(null);
                  }}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground"
                >
                  Discard
                </button>
              </div>
              {existingMatch && (
                <p className="rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-muted-foreground">
                  You already saved{" "}
                  <span className="font-medium text-foreground">{existingMatch.name}</span>
                  {existingMatch.city ? ` in ${existingMatch.city}` : ""}. Saving again makes a
                  second copy — fine if that is what you want.
                </p>
              )}
              {/* Save sits at the top as well as the bottom: the card is long,
                  and on a phone the only Save button used to be several
                  scrolls past the point where the rec was already complete. */}
              <button
                onClick={save}
                disabled={busy === "save" || !draft.name.trim()}
                className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === "save" ? "Saving…" : "Save to vault"}
              </button>
              {/* The name is the only thing Béa needs. The rest are chips that
                  read as their own value and open one field at a time, the
                  same shape as adding to a trip timeline. */}
              <input
                value={draft.name ?? ""}
                onChange={(e) => setDraftField("name", e.target.value)}
                placeholder="Name"
                aria-label="Name"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[14.5px] outline-none focus:border-primary"
              />
              {[draft.address, draft.city, draft.country].some(Boolean) && (
                <p className="px-1 text-[12px] text-muted-foreground">
                  📍 {[draft.address || draft.city, draft.country].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Optional details">
                {DRAFT_FIELDS.map(([field, label]) => {
                  const value = (draft[field] as string | undefined) ?? "";
                  const open = draftField === field;
                  return (
                    <button
                      key={field}
                      type="button"
                      aria-expanded={open}
                      onClick={() => setDraftField2(open ? null : field)}
                      className={`rounded-full border px-2.5 py-1.5 text-[13px] ${
                        open
                          ? "border-primary bg-primary text-primary-foreground"
                          : value
                            ? "border-primary/50 text-foreground"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {value ? (value.length > 18 ? `${value.slice(0, 17)}…` : value) : label}
                    </button>
                  );
                })}
              </div>
              {draftField && (
                <input
                  autoFocus
                  value={(draft[draftField] as string | undefined) ?? ""}
                  onChange={(e) => setDraftField(draftField, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setDraftField2(null);
                  }}
                  placeholder={DRAFT_FIELDS.find(([f]) => f === draftField)?.[1] ?? ""}
                  aria-label={DRAFT_FIELDS.find(([f]) => f === draftField)?.[1] ?? ""}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[14.5px] outline-none focus:border-primary"
                />
              )}
              <div className="pt-1">
                <p className="label-caps">Travel tags</p>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                  Béa guessed these so she can pick this rec when you ask her to plan. Tap to
                  change.
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
                          setDraft({
                            ...draft,
                            travel_tags: toggleTravelTag(draft.travel_tags ?? [], tag),
                          });
                        }}
                        aria-pressed={on}
                        className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                          on
                            ? "border-primary bg-card text-foreground"
                            : "border-border/60 text-muted-foreground"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setMoreTags((v) => !v)}
                    className="rounded-full border border-dashed border-border/80 px-2.5 py-1 text-[12px] text-muted-foreground"
                  >
                    {moreTags ? "Fewer tags" : "Add a tag"}
                  </button>
                </div>
              </div>
              <div data-guide="reco-location" className="pt-1">
                <p className="label-caps">Location on the map</p>
                {draft.lat != null ? (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Pinned at {draft.lat.toFixed(4)}, {draft.lon?.toFixed(4)}. Search again to move
                    it.
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    No exact spot yet. Search a place or address and pick the pin yourself — Near
                    and directions need it.
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
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-[14.5px] outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => void findLocation()}
                  disabled={busy === "location"}
                  className="mt-2 w-full rounded-xl border border-border px-4 py-2 text-[14.5px] font-semibold disabled:opacity-50"
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
                          <p className="text-[14.5px] font-semibold">{line.title}</p>
                          {line.subtitle ? (
                            <p className="text-[12px] text-muted-foreground">{line.subtitle}</p>
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
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
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
                disabled={busy === "save" || !draft.name.trim()}
                className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === "save" ? "Saving…" : "Save to vault"}
              </button>
              {!draft.name.trim() && (
                <p className="text-[12px] text-muted-foreground">
                  Give it a name first — that's the only required field.
                </p>
              )}
              {!vault.signedIn && (
                <p className="text-[12px] text-muted-foreground">
                  Sign in on the You tab to keep this saved to your account.
                </p>
              )}
            </div>
          )}
        </section>

        <ShareRecos
          rows={vault.rows}
          uid={user?.id ?? null}
          myName={myName}
          onKept={vault.addMany}
        />

        {(searchWorthShowing({ total: views.length }) ||
          anyFilterWorthShowing({
            total: views.length,
            places: places.length - 1,
            kinds: categories.length - 1,
          })) && (
          <div className="space-y-2">
            {searchWorthShowing({ total: views.length }) && (
              <input
                data-guide="reco-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search places, cities, people — typos are fine"
                className="w-full rounded-full border border-border bg-card px-4 py-2.5 text-[14.5px] outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            )}
            {placeFilterWorthShowing({
              total: views.length,
              places: places.length - 1,
              kinds: categories.length - 1,
            }) && (
              <div data-guide="reco-places" className="flex gap-2 overflow-x-auto pb-1">
                {places.map((c) => (
                  <button
                    key={c}
                    onClick={() => setPlaceFilter(c)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                      placeFilter === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {kindFilterWorthShowing({
              total: views.length,
              places: places.length - 1,
              kinds: categories.length - 1,
            }) && (
              <div data-guide="reco-categories" className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                      category === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <section data-guide="reco-list" className="space-y-3">
          {vault.loading && vault.rows.length === 0 && <RowListSkeleton />}
          {filtered.map((v) => (
            <article key={v.id} className="card-soft p-3.5">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${pinColorClass[v.type]}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[18px] leading-tight">{v.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {[v.city, v.country].filter(Boolean).join(", ")}
                    {v.by ? ` · by ${v.by}` : ""}
                    {v.source ? ` · ${v.source}` : ""}
                  </p>
                  {v.notes && <p className="mt-1.5 text-[14.5px] leading-snug">{v.notes}</p>}
                  {v.tags.length > 0 && (
                    <p className="mt-1.5 text-[12px] text-muted-foreground">{v.tags.join(" · ")}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded-full border border-border px-2 py-1 text-[11.5px] uppercase tracking-wider text-muted-foreground">
                    {v.category}
                  </span>
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">{v.year}</p>
                  {v.removable && (
                    <button
                      onClick={() => {
                        // Keep enough to re-create it before the row is gone.
                        const row = vault.rows.find((r) => r.id === v.id);
                        void removeWithUndo({
                          label: v.name,
                          remove: () => vault.remove(v.id),
                          restore: async () => {
                            if (!row) throw new Error("gone");
                            await vault.add({
                              ...toNewReco(capturedFromReco(row), {
                                ...(row.category ? { category: row.category } : {}),
                                ...(row.recommended_by
                                  ? { recommended_by: row.recommended_by }
                                  : {}),
                              }),
                              ...(row.pin_type ? { pin_type: row.pin_type as PinType } : {}),
                              ...(row.travel_tags ? { travel_tags: row.travel_tags } : {}),
                            });
                          },
                        });
                      }}
                      className="mt-1.5 text-[11.5px] text-muted-foreground underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {views.length === 0 && (
            <div className="py-8 text-center">
              <p className="font-display text-[18px] leading-snug">{beaLine("empty.recs").title}</p>
              <p className="mt-1 text-[14.5px] text-muted-foreground">
                {beaLine("empty.recs").body}
              </p>
            </div>
          )}
          {views.length > 0 && filtered.length === 0 && (
            <p className="py-8 text-center text-[14.5px] text-muted-foreground">
              Nothing saved matches that yet.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
