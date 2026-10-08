import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/friendly-error";
import { RowListSkeleton } from "@/components/Skeletons";
import { confirm } from "@/lib/haptics";
import { hostOf, linkFailureMessage, unlocatedMessage } from "@/lib/link-failure";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronDown,
  Hand,
  Inbox,
  ListPlus,
  LocateFixed,
  MapPinned,
  Plus,
  Search,
  Settings2,
  Share2,
} from "@/components/icons";
import { AppShell } from "@/components/AppShell";
import { RecoListImport } from "@/components/RecoListImport";
import { TripPlacesImport } from "@/components/TripPlacesImport";
import { ShareRecos } from "@/components/ShareRecos";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { AddToTripSheet } from "@/components/recs/AddToTripSheet";
import { ExploreNearby } from "@/components/recs/ExploreNearby";
import { PlaceDetail } from "@/components/recs/PlaceDetail";
import { KIND_ICON } from "@/components/recs/kind-icons";
import { PlaceArt, RecsSectionHead, Sheet, type RecsPlace } from "@/components/recs/RecsParts";
import { SaveSheet } from "@/components/recs/SaveSheet";
import {
  addPlaceholder,
  anyFilterWorthShowing,
  categoryKey,
  categoryOptions,
  kindFilterWorthShowing,
  placeFilterWorthShowing,
  searchWorthShowing,
} from "@/lib/reco-ui";
import { useAuth } from "@/hooks/useAuth";
import { beaCheer, useBeaSettings } from "@/hooks/useBeaSettings";
import { useTrips } from "@/hooks/useTrips";
import { pinColorClass, pinLabel, type Pin, type PinType } from "@/data/atlas";
import { groupCountLabel, groupRecosByType } from "@/lib/reco-groups";
import { listOf } from "@/lib/place-lists";
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
import { placeSuggestionLines, formatTripLocation } from "@/lib/place-label";
import { prettyPlaceCategory } from "@/lib/place-kind";
import { useUndo } from "@/hooks/useUndo";
import {
  capturedFromParsedPlace,
  capturedFromReco,
  findDuplicate,
  toNewReco,
} from "@/lib/captured-place";
import { fuzzyRank } from "@/lib/fuzzy";
import { hiddenFromRecs, isAreaPlace, recMatchesPlace, uniqueRecCities } from "@/lib/reco-place";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { draftFromTyped, recMapsUrl } from "@/lib/reco-open";
import { PlaceFacts } from "@/components/PlaceFacts";
import { scoreOpportunity } from "@/lib/score-opportunity";
import { beaLine } from "@/lib/bea-voice";
import { emptyLine } from "@/lib/bea-personality";
import { BROWSE_KINDS, listCounts, recentlySaved, type BrowseKind } from "@/lib/recs-browse";
import { toLocalISODate } from "@/lib/trip-dates";
import { pickActiveTrip } from "@/lib/home-trip";

export const Route = createFileRoute("/recommendations")({
  staticData: { plane: "tab" },
  head: () => ({
    meta: [
      { title: "Recommendations — Béa" },
      {
        name: "description",
        content:
          "Every recommendation you've ever been given, saved by link, GPS or note — filterable by city, category and who told you.",
      },
      { property: "og:title", content: "Recommendations — Béa" },
      {
        property: "og:description",
        content: "Never lose a recommendation again. Save it once, find it years later.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // Home's search loop opens this page with the search box ready.
  validateSearch: (search: Record<string, unknown>): { find?: true } =>
    search["find"] === true || search["find"] === "1" ? { find: true } : {},
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

/** Which of the tab's screens is showing; a place remembers where it was opened from. */
type Screen =
  | { kind: "home" }
  | { kind: "saved"; list: PinType | "all" }
  | { kind: "nearby"; browse: BrowseKind | "All" }
  | { kind: "place"; place: RecsPlace; back: Screen };

function draftWithTags(place: Draft): Draft {
  return { ...place, travel_tags: suggestTravelTags(place) };
}

function RecommendationsPage() {
  const { find } = Route.useSearch();
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (find) searchRef.current?.focus();
  }, [find]);
  const [query, setQuery] = useState("");
  const [placeFilter, setPlaceFilter] = useState("All places");
  const [category, setCategory] = useState("All");
  const [mode, setMode] = useState<"link" | "search" | "here" | "manual" | "list" | "trips" | null>(
    null,
  );
  const [link, setLink] = useState("");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tagsTouched, setTagsTouched] = useState(false);
  const [moreTags, setMoreTags] = useState(false);
  /** The other ways in, folded away until asked for. */
  const [moreWays, setMoreWays] = useState(false);
  /** Send / Open a share, asked for from the "+" menu. */
  const [shareAsk, setShareAsk] = useState<{ mode: "picking" | "opening"; n: number } | null>(null);
  /** What the one add field currently holds. */
  const [addText, setAddText] = useState("");
  const [locQuery, setLocQuery] = useState("");
  const [locResults, setLocResults] = useState<ParsedPlace[] | null>(null);
  const draftRef = useRef<HTMLDivElement | null>(null);
  const [justDrafted, setJustDrafted] = useState(0);
  /** The rec just saved, while the offer to fill in the rest is still up. */
  const [justSaved, setJustSaved] = useState<{ id: string; name: string } | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  /** The place being saved from a list, for its button. */
  const [savingName, setSavingName] = useState<string | null>(null);
  /** The place being added to a trip, while that sheet is up. */
  const [tripSheet, setTripSheet] = useState<RecsPlace | null>(null);
  const trips = useTrips();
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
  /**
   * Where to look from, when Béa already knows.
   *
   * Never asked for on arrival — a search box should not open a permission
   * prompt. It is filled by "I'm here now", or by the Near me button under a
   * search that came back empty, and then every later search benefits.
   */
  const [searchAt, setSearchAt] = useState<{ lat: number; lon: number } | null>(null);

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

  const venues = saved.filter(
    (r) => !hiddenFromRecs(r, "created_at" in r ? r.pin_type : r.type, r.visited),
  );
  const views = venues.map(rowView);
  const places = ["All places", ...uniqueRecCities(saved)];
  // "cafe" and "Cafe" are one filter, not two.
  const categories = ["All", ...categoryOptions(views.map((v) => v.category))];
  const inPlace = views.filter((v) => recMatchesPlace(v, placeFilter));
  const inCategory = inPlace.filter(
    (v) => category === "All" || categoryKey(v.category) === categoryKey(category),
  );
  const filtered = query.trim()
    ? fuzzyRank(inCategory, query, (v) => [v.name, v.city, v.country, v.by, v.notes])
    : [...inCategory].sort((a, b) => {
        const pinA = vault.comparePins.find((p) => p.id === a.id || p.id === `reco-${a.id}`);
        const pinB = vault.comparePins.find((p) => p.id === b.id || p.id === `reco-${b.id}`);
        if (!pinA || !pinB) return 0;
        return scoreOpportunity(pinB, scorePrefs).score - scoreOpportunity(pinA, scorePrefs).score;
      });

  const groups = groupRecosByType(filtered);

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
        data: {
          url: extracted.url,
          ...(extracted.nameHint ? { nameHint: extracted.nameHint } : {}),
          ...(extracted.addressHint ? { addressHint: extracted.addressHint } : {}),
        },
      });
      // "Saved place" is the server's stand-in for no name at all. Saving it
      // as the name is how a rec ended up called that; an empty field asks.
      const name = place.name === "Saved place" ? (extracted.nameHint ?? "") : place.name;
      showDraft({ ...place, name, category: prettyPlaceCategory(place) });
      if (place.partial) setError(linkFailureMessage(place.partialReason, hostOf(place.url)));
      else if (place.unlocated) setError(unlocatedMessage(place.name));
    } catch {
      setError("Couldn't read that link. You can still fill the details in yourself.");
      showDraft({ name: extracted.nameHint ?? "", url: extracted.url });
    } finally {
      setBusy(null);
    }
  };

  /**
   * Ask for the person's position, so the search box can look around them.
   *
   * Location is not requested on arrival — a search field should not open a
   * permission prompt — only when the answer would change: the world search
   * came back empty, or its nonempty results span at least two countries.
   * PlaceSearchInput re-runs itself once the position lands.
   */
  // Already allowed on this device: use it without asking, so a chain search
  // starts near you. Never prompts — only reads a permission already given.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions || !navigator.geolocation)
      return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelled || status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!cancelled) setSearchAt({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          },
          () => {},
          { timeout: 15_000, maximumAge: 300_000 },
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const locateForSearch = () => {
    if (!navigator.geolocation) {
      setError("Your device won't share its location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setSearchAt({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setError("Couldn't get your location just now. Adding the city works too."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
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
        setSearchAt({ lat: latitude, lon: longitude });
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
          url: r.url,
        })),
        {
          name: draft.name,
          ...(draft.url ? { url: draft.url } : {}),
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
      setDraft(null);
      confirm();
      if (id) setJustSaved({ id, name: found.name });
      else {
        const line = beaLine("recs.saved");
        toast.success(line.title, { description: beaCheer("recommendations") ?? line.body });
      }
    } catch (e) {
      setError(friendlyError(e, "Couldn't save that one."));
    } finally {
      setBusy(null);
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
      toast.success(line.title, { description: beaCheer("recommendations") ?? line.body });
      if (savedId) setJustSaved({ id: savedId, name: draft.name.trim() });
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
      setError(friendlyError(e, "Couldn't save that."));
    } finally {
      setBusy(null);
    }
  };

  /** Save any place in one tap, then offer the rest in the save sheet. */
  const savePlace = async (place: RecsPlace, pin?: PinType) => {
    setBusy("quick");
    setSavingName(place.name);
    setError(null);
    try {
      const id = await vault.add({
        name: place.name,
        ...(place.category ? { category: place.category } : {}),
        ...(place.city ? { city: place.city } : {}),
        ...(place.country ? { country: place.country } : {}),
        ...(place.address ? { address: place.address } : {}),
        ...(place.url ? { url: place.url } : {}),
        ...(place.source ? { source: place.source } : {}),
        ...(place.lat != null ? { lat: place.lat } : {}),
        ...(place.lon != null ? { lon: place.lon } : {}),
        ...(pin ? { pin_type: pin } : {}),
        travel_tags: suggestTravelTags({
          name: place.name,
          ...(place.category ? { category: place.category } : {}),
        }),
      });
      confirm();
      if (id) {
        setJustSaved({ id, name: place.name });
        setScreen((s) =>
          s.kind === "place" && s.place.name === place.name
            ? { ...s, place: { ...s.place, savedId: id } }
            : s,
        );
      } else {
        const line = beaLine("recs.saved");
        toast.success(line.title, { description: beaCheer("recommendations") ?? line.body });
      }
    } catch (e) {
      setError(friendlyError(e, "Couldn't save that one."));
      toast.error(friendlyError(e, "Couldn't save that one."));
    } finally {
      setBusy(null);
      setSavingName(null);
    }
  };

  const removeRow = (id: string, name: string) => {
    // Keep enough to re-create it before the row is gone.
    const row = vault.rows.find((r) => r.id === id);
    void removeWithUndo({
      label: name,
      remove: () => vault.remove(id),
      restore: async () => {
        if (!row) throw new Error("gone");
        await vault.add({
          ...toNewReco(capturedFromReco(row), {
            ...(row.category ? { category: row.category } : {}),
            ...(row.recommended_by ? { recommended_by: row.recommended_by } : {}),
          }),
          ...(row.pin_type ? { pin_type: row.pin_type as PinType } : {}),
          ...(row.travel_tags ? { travel_tags: row.travel_tags } : {}),
        });
      },
    });
  };

  /** A saved row as a place to open. */
  const placeFromRow = (r: RecoRowDB): RecsPlace => ({
    name: r.name,
    savedId: r.id,
    ...(r.category ? { category: r.category } : {}),
    ...(r.city ? { city: r.city } : {}),
    ...(r.country ? { country: r.country } : {}),
    ...(r.address ? { address: r.address } : {}),
    ...(r.lat != null ? { lat: r.lat } : {}),
    ...(r.lon != null ? { lon: r.lon } : {}),
    ...(r.url ? { url: r.url } : {}),
    ...(r.source ? { source: r.source } : {}),
  });

  const openPlace = (place: RecsPlace) =>
    setScreen((s) => ({ kind: "place", place, back: s.kind === "place" ? s.back : s }));

  /** A search hit or a read link: a full place opens, a thin one goes to the details card. */
  const openFound = (found: ParsedPlace) => {
    setAddText("");
    const category = prettyPlaceCategory(found);
    if (!found.name.trim() || found.partial) {
      showDraft({ ...found, category });
      return;
    }
    const match = findDuplicate(
      vault.rows.map((r) => ({
        id: r.id,
        name: r.name,
        city: r.city,
        lat: r.lat,
        lon: r.lon,
        url: r.url,
      })),
      {
        name: found.name,
        ...(found.url ? { url: found.url } : {}),
        ...(found.city ? { city: found.city } : {}),
        ...(found.lat != null ? { lat: found.lat } : {}),
        ...(found.lon != null ? { lon: found.lon } : {}),
      },
    );
    openPlace({
      name: found.name,
      ...(category ? { category } : {}),
      ...(found.city ? { city: found.city } : {}),
      ...(found.country ? { country: found.country } : {}),
      ...(found.address ? { address: found.address } : {}),
      ...(found.lat != null ? { lat: found.lat } : {}),
      ...(found.lon != null ? { lon: found.lon } : {}),
      ...(found.url ? { url: found.url } : {}),
      ...(found.source ? { source: found.source } : {}),
      ...(match ? { savedId: match.id } : {}),
    });
  };

  const startMode = (m: "trips" | "here" | "manual" | "list") => {
    setScreen({ kind: "home" });
    setMode(mode === m ? null : m);
    setTagsTouched(false);
    setMoreTags(false);
    if (m === "manual") showDraft({ name: "" });
    else setDraft(null);
    setLocQuery("");
    setLocResults(null);
    setError(null);
    if (m === "here") handleHere();
    setMoreWays(false);
  };

  // Each screen opens at its top, as a new page would.
  const screenKey = screen.kind === "place" ? `place:${screen.place.name}` : `${screen.kind}`;
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [screenKey]);

  const today = toLocalISODate(new Date());
  const tripNow = trips.trips.find(
    (t) => t.start_date && t.start_date <= today && (t.end_date ?? t.start_date) >= today,
  );
  const tripLine = tripNow?.start_date
    ? [tripNow.start_date, tripNow.end_date ?? tripNow.start_date]
        .map((d) =>
          new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
        )
        .filter((d, i, all) => i === 0 || d !== all[0])
        .join(" – ")
    : undefined;

  const [homeList, setHomeList] = useState<"all" | "reco" | "wishlist" | "visited">("all");
  const nextTrip = pickActiveTrip(trips.trips, today);
  const visibleRows = vault.rows.filter((r) => !hiddenFromRecs(r, r.pin_type, r.visited));
  const savedForTrip = nextTrip?.city
    ? visibleRows
        .filter(
          (r) => !isAreaPlace(r) && recMatchesPlace(r, (nextTrip.city ?? "").split(",")[0]!.trim()),
        )
        .slice(0, 4)
    : [];
  const counts = listCounts(vault.rows.filter((r) => !hiddenFromRecs(r, r.pin_type, r.visited)));
  const savedRow = justSaved ? vault.rows.find((r) => r.id === justSaved.id) : undefined;
  const placeRow =
    screen.kind === "place" && screen.place.savedId
      ? vault.rows.find((r) => r.id === screen.place.savedId)
      : undefined;
  const nearbyOpen =
    screen.kind === "nearby" || (screen.kind === "place" && screen.back.kind === "nearby");
  const listFilter = screen.kind === "saved" ? screen.list : "all";
  const shownGroups = listFilter === "all" ? groups : groups.filter((g) => g.type === listFilter);

  // A saved place as a card: its name, its picture, a line, and the two things
  // to do with it next.
  const recCard = (r: RecoRowDB) => (
    <article className="recs-card">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => openPlace(placeFromRow(r))}
          aria-label={`Open ${r.name}`}
          className="shrink-0"
        >
          <PlaceArt
            place={{ name: r.name, category: r.category, lat: r.lat, lon: r.lon }}
            className="size-[96px] rounded-2xl"
          />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => openPlace(placeFromRow(r))}
            className="flex min-h-11 w-full items-center gap-2 text-left"
          >
            <span
              className={`size-2.5 shrink-0 rounded-full ${pinColorClass[(r.pin_type ?? "reco") as PinType]}`}
              aria-hidden
            />
            <span className="font-display text-[22px] leading-tight">{r.name}</span>
          </button>
          <p className="text-[15px] font-semibold leading-snug">
            {[r.city, r.category].filter(Boolean).join(" · ") || "Saved place"}
          </p>
          <p className="text-[14px] leading-snug text-muted-foreground">
            {r.notes
              ? `“${r.notes}”`
              : [
                  r.recommended_by ? `From ${r.recommended_by}` : null,
                  pinLabel[(r.pin_type ?? "reco") as PinType],
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={recMapsUrl(r)}
          target="_blank"
          rel="noreferrer"
          className="recs-pill grid min-h-11 place-items-center text-center text-[14px] font-semibold"
        >
          Open in Maps ↗
        </a>
        <button
          type="button"
          onClick={() => setTripSheet(placeFromRow(r))}
          className="recs-pill min-h-11 text-[14px] font-semibold"
        >
          Add to a day
        </button>
      </div>
    </article>
  );

  return (
    <AppShell
      {...(screen.kind === "home"
        ? { eyebrow: `${visibleRows.length} saved`, title: "Places worth keeping." }
        : {})}
    >
      {nearbyOpen && (
        <div className={screen.kind === "nearby" ? "" : "hidden"}>
          <ExploreNearby
            initialKind={screen.kind === "nearby" ? screen.browse : "All"}
            saved={vault.rows}
            tripLine={tripLine}
            savingName={savingName}
            onBack={() => setScreen({ kind: "home" })}
            onOpen={openPlace}
            onSave={(place) => savePlace(place, "wishlist")}
            onAdd={vault.add}
            onHere={setSearchAt}
          />
        </div>
      )}

      {screen.kind === "place" && (
        <PlaceDetail
          place={screen.place}
          row={placeRow}
          here={searchAt}
          uid={user?.id ?? null}
          myName={myName}
          saving={busy === "quick"}
          onBack={() => setScreen(screen.back)}
          onSave={() => void savePlace(screen.place)}
          onEditSaved={() => placeRow && setJustSaved({ id: placeRow.id, name: placeRow.name })}
          onAddToTrip={() => setTripSheet(screen.place)}
          onEditBeforeSave={() => {
            const p = screen.place;
            setScreen({ kind: "home" });
            // Only the fields there are: a draft never carries an empty one.
            const fields = Object.fromEntries(
              Object.entries(p).filter(([k, v]) => k !== "savedId" && v != null && v !== ""),
            ) as Omit<Draft, "name">;
            showDraft({ ...fields, name: p.name });
          }}
          onRemove={() => {
            if (!placeRow) return;
            removeRow(placeRow.id, placeRow.name);
            setScreen(screen.back);
          }}
        />
      )}

      {screen.kind === "saved" && (
        <div className="rise space-y-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setScreen({ kind: "home" })}
              aria-label="Back to Recommendations"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            <div className="min-w-0">
              <h2 className="font-display text-[30px] leading-none">
                {listFilter === "all" ? "Saved places" : pinLabel[listFilter]}
              </h2>
              <p className="mt-1 text-[14px] text-muted-foreground">{views.length} saved</p>
            </div>
          </div>

          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
            role="tablist"
            aria-label="Which list"
          >
            {(["all", ...pinChoices] as const).map((t, i) => {
              const on = listFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setScreen({ kind: "saved", list: t })}
                  className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] font-semibold ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : `tile-fill-${(i % 5) + 1} border-border`
                  }`}
                >
                  {t === "all" ? "All" : pinLabel[t]}
                </button>
              );
            })}
          </div>

          {(searchWorthShowing({ total: views.length }) ||
            find ||
            anyFilterWorthShowing({
              total: views.length,
              places: places.length - 1,
              kinds: categories.length - 1,
            })) && (
            // One row: search, then City and Type as two compact menus rather
            // than two rows of chips that ran off the side of the screen.
            <div className="flex flex-wrap gap-2">
              {(searchWorthShowing({ total: views.length }) || find) && (
                <label className="relative min-w-[12rem] flex-[2_1_14rem]">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    data-guide="reco-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search places, cities, people…"
                    aria-label="Search your saved places — typos are fine"
                    className="h-12 w-full rounded-full border border-[var(--field-border)] bg-card pl-12 pr-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                </label>
              )}
              {placeFilterWorthShowing({
                total: views.length,
                places: places.length - 1,
                kinds: categories.length - 1,
              }) && (
                <FilterSelect
                  guide="reco-places"
                  label="City"
                  value={placeFilter}
                  all="All places"
                  options={places}
                  onChange={setPlaceFilter}
                />
              )}
              {kindFilterWorthShowing({
                total: views.length,
                places: places.length - 1,
                kinds: categories.length - 1,
              }) && (
                <FilterSelect
                  guide="reco-categories"
                  label="Type"
                  value={category}
                  all="All"
                  options={categories}
                  onChange={setCategory}
                />
              )}
            </div>
          )}

          <section data-guide="reco-list" className="space-y-3">
            {vault.loading && vault.rows.length === 0 && <RowListSkeleton />}
            {shownGroups.map((group) => (
              <RecsGroup
                key={group.type}
                title={pinLabel[group.type]}
                hint={groupCountLabel(group.rows.length)}
                defaultOpen
              >
                <div className="space-y-3">
                  {group.rows.map((v) => {
                    const row = vault.rows.find((r) => r.id === v.id);
                    return (
                      <article key={v.id} className="recs-card">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => row && openPlace(placeFromRow(row))}
                            aria-label={`Open ${v.name}`}
                            className="shrink-0"
                          >
                            <PlaceArt
                              place={{ name: v.name, category: v.category }}
                              className="size-[68px] rounded-xl"
                            />
                          </button>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => row && openPlace(placeFromRow(row))}
                              className="flex items-center gap-1.5 text-left"
                            >
                              <span
                                className={`size-2 shrink-0 rounded-full ${pinColorClass[v.type]}`}
                                aria-hidden
                              />
                              <span className="font-display text-[20px] leading-tight">
                                {v.name}
                              </span>
                            </button>
                            <p className="text-[13px] text-muted-foreground">
                              {formatTripLocation(v.city, v.country)}
                              {v.by ? ` · by ${v.by}` : ""}
                              {v.source ? ` · ${v.source}` : ""}
                            </p>
                            {v.notes && (
                              <p className="mt-1.5 text-[15px] leading-snug">{v.notes}</p>
                            )}
                            {v.tags.length > 0 && (
                              <p className="mt-1.5 text-[13px] text-muted-foreground">
                                {v.tags.join(" · ")}
                              </p>
                            )}
                            {row && (
                              // The phone's maps app, on this place: its pin when
                              // it has one, otherwise a search for its name.
                              <div className="mt-1.5 space-y-1">
                                <a
                                  href={recMapsUrl(row)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block text-[13px] font-semibold text-primary underline"
                                >
                                  Open in Maps ↗
                                </a>
                                {/* Hours on request: one lookup per card tapped,
                                    not one per card listed. A country or a city
                                    has no opening hours, so it gets no button. */}
                                {!isAreaPlace(row) && (
                                  <PlaceFacts name={row.name} lat={row.lat} lon={row.lon} />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="rounded-full border border-border px-2 py-1 text-[13px] uppercase tracking-wider text-muted-foreground">
                              {v.category}
                            </span>
                            <p className="mt-1.5 text-[13px] text-muted-foreground">{v.year}</p>
                            {v.removable && (
                              <button
                                type="button"
                                onClick={() => removeRow(v.id, v.name)}
                                className="mt-1.5 text-[13px] text-muted-foreground underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </RecsGroup>
            ))}
            {views.length === 0 && !vault.loading && <EmptyVault />}
            {views.length > 0 && filtered.length === 0 && (
              <p className="py-8 text-center text-[15px] text-muted-foreground">
                Nothing saved matches that yet.
              </p>
            )}
            {views.length > 0 && filtered.length > 0 && shownGroups.length === 0 && (
              <p className="py-8 text-center text-[15px] text-muted-foreground">
                Nothing in this list yet.
              </p>
            )}
          </section>
        </div>
      )}

      {screen.kind === "home" && (
        <div className="space-y-5">
          {/* One field, whatever you have: a name is looked up as you type, a
              pasted link gets read. The filter button beside it opens the
              saved places with their search, city and type filters. */}
          <section data-guide="reco-add" className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="relative min-w-0 flex-1 [&_textarea]:min-h-12 [&_textarea]:rounded-[24px] [&_textarea]:py-[13px] [&_textarea]:pl-12 [&_textarea]:text-[15px] [&_textarea]:leading-snug [&_textarea+button]:size-12 [&_textarea+button]:rounded-full [&_textarea+button]:bg-card [&_textarea:placeholder-shown+button]:hidden">
                <Search
                  className="pointer-events-none absolute left-4 top-3.5 z-[1] size-5 text-muted-foreground"
                  aria-hidden
                />
                <PlaceSearchInput
                  value={addText}
                  onChange={setAddText}
                  at={searchAt}
                  onLocate={locateForSearch}
                  onPick={openFound}
                  placeholder={
                    views.length > 0 ? "Search places, cities, people…" : addPlaceholder(false)
                  }
                  onSaveTyped={(text) => {
                    setAddText("");
                    const typed = draftFromTyped(text);
                    showDraft({
                      ...typed,
                      source: "Typed in",
                      url: recMapsUrl(typed),
                    });
                  }}
                  quickAdd={{
                    label: "Save",
                    busyLabel: "Saving…",
                    onAdd: async (place) => {
                      await quickSave(place);
                      setAddText("");
                    },
                  }}
                />
              </div>
              <button
                type="button"
                data-guide="reco-search"
                onClick={() => setScreen({ kind: "saved", list: "all" })}
                aria-label="Your saved places: search and filter"
                title="Your saved places: search and filter"
                className="grid size-12 shrink-0 place-items-center rounded-full border border-border bg-card"
              >
                <Settings2 className="size-5" aria-hidden />
              </button>
            </div>

            {/* Saved places matching what is typed, so a name, a city or who
                told you finds your own save before the map is asked. */}
            {addText.trim().length >= 2 && !looksLikePastedPlaceLink(addText) && (
              <SavedMatches
                rows={fuzzyRank(vault.rows, addText, (r) => [
                  r.name,
                  r.city ?? "",
                  r.country ?? "",
                  r.recommended_by ?? "",
                  r.notes ?? "",
                ]).slice(0, 3)}
                onOpen={(r) => openPlace(placeFromRow(r))}
              />
            )}

            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Add or explore">
              {(
                [
                  ["add", "Add place", "link or name", Plus, "tile-fill-5", "text-primary"],
                  ["near", "Nearby map", "what's close", MapPinned, "tile-fill-2", "text-primary"],
                  ["more", "More ways", "import, share", Plus, "tile-fill-4", "text-primary"],
                ] as const
              ).map(([k, label, hint, Glyph, bg, ink]) => (
                <button
                  key={k}
                  type="button"
                  aria-expanded={k === "more" ? moreWays : undefined}
                  onClick={() => {
                    if (k === "near") setScreen({ kind: "nearby", browse: "All" });
                    else if (k === "more") setMoreWays((v) => !v);
                    else {
                      const field = document.querySelector<HTMLElement>(
                        "[data-guide=reco-add] textarea",
                      );
                      field?.scrollIntoView({ block: "center", behavior: "smooth" });
                      field?.focus();
                    }
                  }}
                  className={`${bg} recs-act flex min-h-[92px] flex-col items-start justify-center gap-0.5 rounded-[20px] border border-border px-3 py-2 text-left`}
                >
                  <span className="recs-act-ico mb-1 grid size-9 place-items-center rounded-full">
                    <Glyph className={`size-5 shrink-0 ${ink}`} aria-hidden />
                  </span>
                  <span className="whitespace-nowrap text-[15px] font-semibold leading-tight">
                    {label}
                  </span>
                  <span className="text-[13px] leading-tight text-foreground/65">{hint}</span>
                </button>
              ))}
            </div>

            <div className="empty:hidden">
              <ShareRecos
                rows={vault.rows}
                uid={user?.id ?? null}
                myName={myName}
                onKept={vault.addMany}
                request={shareAsk}
                onClose={() => setShareAsk(null)}
              />
            </div>
            {mode === "here" && busy === "here" && (
              <p className="text-[15px] text-muted-foreground">Finding where you are…</p>
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

            {mode === "trips" && (
              <TripPlacesImport
                signedIn={vault.signedIn}
                vault={vault.rows}
                onAddMany={vault.addMany}
                onSaved={() => setMode(null)}
              />
            )}

            {error && (
              <p role="alert" className="text-[14px] text-destructive">
                {error}
              </p>
            )}

            {draft && (
              <div ref={draftRef} className="rise mt-3 card-soft space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="label-caps">Check the details</p>
                    <p className="text-[13px] text-muted-foreground">
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
                    className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[13px] text-muted-foreground"
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
                  className="w-full rounded-xl bg-primary px-4 py-2 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
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
                  className="w-full rounded-xl border border-[var(--field-border)] bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
                />
                {[draft.address, draft.city, draft.country].some(Boolean) && (
                  <p className="px-1 text-[13px] text-muted-foreground">
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
                    className="w-full rounded-xl border border-[var(--field-border)] bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
                  />
                )}
                <div className="pt-1">
                  <p className="label-caps">Travel tags</p>
                  <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
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
                          className={`rounded-full border px-2.5 py-1 text-[13px] transition-colors ${
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
                      className="rounded-full border border-dashed border-border/80 px-2.5 py-1 text-[13px] text-muted-foreground"
                    >
                      {moreTags ? "Fewer tags" : "Add a tag"}
                    </button>
                  </div>
                </div>
                <div data-guide="reco-location" className="pt-1">
                  <p className="label-caps">Location on the map</p>
                  {draft.lat != null ? (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Pinned at {draft.lat.toFixed(4)}, {draft.lon?.toFixed(4)}. Search again to
                      move it.
                    </p>
                  ) : (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      No exact spot yet. Search a place or address and pick the pin yourself — Near
                      and directions need it.
                    </p>
                  )}
                  <input
                    aria-label="Search a place, street, or city"
                    value={locQuery}
                    onChange={(e) => setLocQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void findLocation();
                      }
                    }}
                    placeholder="Search a place, street, or city"
                    className="mt-2 w-full rounded-xl border border-[var(--field-border)] bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => void findLocation()}
                    disabled={busy === "location"}
                    className="mt-2 w-full rounded-xl border border-border px-4 py-2 text-[15px] font-semibold disabled:opacity-50"
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
                            <p className="text-[15px] font-semibold">{line.title}</p>
                            {line.subtitle ? (
                              <p className="text-[13px] text-muted-foreground">{line.subtitle}</p>
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
                  className="w-full rounded-xl bg-primary px-4 py-2 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy === "save" ? "Saving…" : "Save to vault"}
                </button>
                {!draft.name.trim() && (
                  <p className="text-[13px] text-muted-foreground">
                    Give it a name first — that's the only required field.
                  </p>
                )}
                {!vault.signedIn && (
                  <p className="text-[13px] text-muted-foreground">
                    Sign in on the You tab to keep this saved to your account.
                  </p>
                )}
              </div>
            )}
          </section>

          {views.length === 0 && !vault.loading ? (
            <section data-guide="reco-list">
              <EmptyVault />
            </section>
          ) : (
            <div data-guide="reco-list" className="space-y-6">
              <div
                className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
                role="group"
                aria-label="Lists"
              >
                {(
                  [
                    ["all", "All", visibleRows.length],
                    ["reco", "Recs", counts.reco],
                    ["wishlist", pinLabel.wishlist, counts.bucket],
                    ["visited", pinLabel.visited, counts.visited],
                  ] as const
                ).map(([k, label, n]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={homeList === k}
                    onClick={() => setHomeList(k)}
                    className={`recs-chip h-11 shrink-0 whitespace-nowrap rounded-full border px-4 font-display text-[18px] ${
                      homeList === k
                        ? "border-primary bg-primary text-primary-foreground"
                        : `tile-fill-${(["all", "reco", "wishlist", "visited"].indexOf(k) % 5) + 1} border-border text-foreground`
                    }`}
                  >
                    {label}
                    <span className="ms-1.5 font-sans text-[13px] opacity-70">{n}</span>
                  </button>
                ))}
              </div>

              {homeList === "all" && savedForTrip.length > 0 && nextTrip && (
                <section>
                  <RecsSectionHead
                    title={`Saved for ${(nextTrip.city ?? "").split(",")[0]}`}
                    hint="your next trip"
                  />
                  <ul className="space-y-3">
                    {savedForTrip.map((r) => (
                      <li key={r.id}>{recCard(r)}</li>
                    ))}
                  </ul>
                </section>
              )}

              {homeList === "all" ? (
                <section>
                  <RecsSectionHead
                    title="Recently saved"
                    onSeeAll={() => setScreen({ kind: "saved", list: "all" })}
                  />
                  {vault.loading && vault.rows.length === 0 && <RowListSkeleton />}
                  <ul className="recs-list">
                    {recentlySaved(visibleRows, 5).map((r) => (
                      <li key={r.id} className="flex items-center">
                        <button
                          type="button"
                          onClick={() => openPlace(placeFromRow(r))}
                          className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
                        >
                          <PlaceArt
                            place={{ name: r.name, category: r.category }}
                            className="size-14 shrink-0 rounded-2xl"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[17px] font-semibold">
                              {r.name}
                            </span>
                            <span className="block truncate text-[14px] text-muted-foreground">
                              {[r.city, r.category].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setJustSaved({ id: r.id, name: r.name })}
                          aria-label={`${r.name}: note, list, who told you`}
                          className="grid size-12 shrink-0 place-items-center"
                        >
                          <Bookmark className="size-5 text-primary" weight="fill" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <section>
                  <RecsSectionHead
                    title={homeList === "reco" ? "Recommendations" : pinLabel[homeList]}
                    onSeeAll={() => setScreen({ kind: "saved", list: homeList })}
                  />
                  {counts[homeList === "wishlist" ? "bucket" : homeList] === 0 ? (
                    <p className="py-6 text-center text-[15px] text-muted-foreground">
                      Nothing in this list yet.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {recentlySaved(
                        visibleRows.filter(
                          (r) =>
                            listOf(r) ===
                            (homeList === "wishlist"
                              ? "bucket"
                              : homeList === "visited"
                                ? "been"
                                : "recommendation"),
                        ),
                        8,
                      ).map((r) => (
                        <li key={r.id}>{recCard(r)}</li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          )}

          <nav aria-label="Explore by kind" className="grid grid-cols-5 gap-1">
            {BROWSE_KINDS.map((k, i) => {
              const Icon = KIND_ICON[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setScreen({ kind: "nearby", browse: k === "More" ? "All" : k })}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={`tile-fill-${i + 1} grid size-[60px] place-items-center rounded-full border border-border`}
                  >
                    <Icon className="size-6 text-primary" aria-hidden />
                  </span>
                  <span className="whitespace-nowrap text-center text-[13px] leading-tight tracking-tight">
                    {k}
                  </span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            data-guide="explore-nearby"
            onClick={() => setScreen({ kind: "nearby", browse: "All" })}
            className="recs-nearby grid w-full grid-cols-[1fr_118px] overflow-hidden text-left"
          >
            <span className="block p-4">
              <span className="block font-display text-[26px] leading-none">Explore nearby</span>
              <span className="mt-2 block text-[14px] leading-snug text-muted-foreground">
                Open a map of where you are and discover what's around you.
              </span>
              <span className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-primary-soft px-4 text-[15px] font-semibold text-primary">
                Open map <ArrowRight className="size-4" aria-hidden />
              </span>
            </span>
            <MapSketch />
          </button>
        </div>
      )}

      {moreWays && (
        <Sheet label="Add a place" onClose={() => setMoreWays(false)}>
          <h2 id="reco-add-menu" className="pr-10 font-display text-[27px] leading-none">
            Add a place
          </h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Or search above: a name or a pasted link works too.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(
              [
                ["trips", "From my trips", MapPinned],
                ["here", "I'm here now", LocateFixed],
                ["manual", "By hand", Hand],
                ["list", "Paste a list", ListPlus],
              ] as const
            ).map(([m, label, Icon], i) => (
              <button
                key={m}
                type="button"
                onClick={() => startMode(m)}
                className={`tile-fill-${i + 1} flex items-center gap-2 rounded-2xl border border-border px-3 py-3 text-left text-[15px] font-semibold`}
              >
                <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                {label}
              </button>
            ))}
            {(
              [
                ["picking", "Send places", Share2],
                ["opening", "Open a share", Inbox],
              ] as const
            ).map(([m, label, Icon], i) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setScreen({ kind: "home" });
                  setShareAsk((prev) => ({ mode: m, n: (prev?.n ?? 0) + 1 }));
                  setMode(null);
                  setDraft(null);
                  setMoreWays(false);
                }}
                className={`tile-fill-${i + 5 > 5 ? 1 : 5} flex items-center gap-2 rounded-2xl border border-border px-3 py-3 text-left text-[15px] font-semibold`}
              >
                <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMoreWays(false);
                setScreen({ kind: "nearby", browse: "All" });
              }}
              className="tile-fill-2 col-span-2 flex items-center gap-2 rounded-2xl border border-border px-3 py-3 text-left text-[15px] font-semibold"
            >
              <MapPinned className="size-5 shrink-0 text-primary" aria-hidden />
              Pin somewhere nearby
            </button>
          </div>
        </Sheet>
      )}

      {justSaved && (
        <SaveSheet
          key={justSaved.id}
          row={savedRow}
          fallbackName={justSaved.name}
          onUpdate={(patch) => vault.update(justSaved.id, patch)}
          onClose={() => setJustSaved(null)}
        />
      )}

      {tripSheet && (
        <AddToTripSheet
          place={tripSheet}
          trips={trips.trips}
          onClose={() => setTripSheet(null)}
          onAnother={() => {
            setTripSheet(null);
            setScreen({ kind: "home" });
          }}
        />
      )}
    </AppShell>
  );
}

function EmptyVault() {
  const settings = useBeaSettings();
  const [line] = useState(() => emptyLine({ kind: "noSavedRecommendations", settings }));
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <img src="/bea/bea-think-static.png" alt="" className="size-28 object-contain" />
      <p className="mt-2 font-display text-[22px] leading-snug">{beaLine("empty.recs").title}</p>
      <p className="mt-1 max-w-[30ch] text-[15px] text-muted-foreground">
        {line || beaLine("empty.recs").body}
      </p>
    </div>
  );
}

/** One list of saved places under its heading: collapsible, with no box of its own. */
function RecsGroup({
  title,
  hint,
  defaultOpen = true,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 text-left"
      >
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-(--t-shift) ${open ? "" : "-rotate-90"}`}
          aria-hidden
        />
        <span className="font-display text-[24px] leading-none">{title}</span>
        {hint && <span className="text-[14px] text-muted-foreground">{hint}</span>}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}

/** Your own saves matching the search field, above the map's answers. */
function SavedMatches({ rows, onOpen }: { rows: RecoRowDB[]; onOpen: (row: RecoRowDB) => void }) {
  if (rows.length === 0) return null;
  return (
    <div className="recs-box p-1.5">
      <p className="px-2.5 pt-1.5 text-[13px] font-semibold text-muted-foreground">
        In your saved places
      </p>
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onOpen(r)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left"
            >
              <PlaceArt
                place={{ name: r.name, category: r.category }}
                className="size-10 shrink-0 rounded-lg"
              />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium">{r.name}</span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {[r.city, r.category, r.recommended_by ? `from ${r.recommended_by}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A small drawing of a map for the Explore nearby card: neutral in every theme. */
function MapSketch() {
  return (
    <svg
      viewBox="0 0 118 140"
      preserveAspectRatio="xMidYMid slice"
      className="h-full min-h-[140px] w-full"
      aria-hidden
    >
      <rect width="118" height="140" fill="var(--color-elevated)" />
      <path
        d="M70 140 C 80 110, 118 100, 118 70 L118 140 Z"
        fill="color-mix(in oklch, var(--color-muted-foreground) 18%, var(--color-elevated))"
      />
      <g stroke="var(--color-card)" strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M-5 30 L 125 80" />
        <path d="M30 -5 L 60 145" />
        <path d="M-5 105 L 80 60 L 125 20" />
      </g>
      <g stroke="var(--color-border)" strokeWidth="1.5" fill="none">
        <path d="M-5 60 L 125 45" />
        <path d="M90 -5 L 75 145" />
      </g>
      <g transform="translate(59 48)">
        <path
          d="M0 22 C -9 11, -11 7, -11 0 A 11 11 0 0 1 11 0 C 11 7, 9 11, 0 22 Z"
          fill="var(--color-primary)"
        />
        <circle r="4" fill="var(--color-card)" />
      </g>
    </svg>
  );
}

/**
 * A filter as a small native menu: "City: All" until you pick one, then the
 * pick, highlighted so a narrowed list never looks like the whole vault.
 */
function FilterSelect({
  guide,
  label,
  value,
  all,
  options,
  onChange,
}: {
  guide: string;
  label: string;
  value: string;
  all: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const on = value !== all;
  return (
    <label
      data-guide={guide}
      className={`relative flex min-w-[8.5rem] flex-1 items-center gap-1 rounded-full border px-3.5 py-2.5 text-[14px] sm:flex-none ${
        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      }`}
    >
      <span className={on ? "text-primary-foreground/80" : "text-muted-foreground"}>{label}:</span>
      <span className="truncate font-semibold">{on ? value : "All"}</span>
      <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Filter by ${label.toLowerCase()}`}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === all ? `All` : o}
          </option>
        ))}
      </select>
    </label>
  );
}
