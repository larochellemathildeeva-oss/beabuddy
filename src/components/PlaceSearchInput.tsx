import { useServerFn } from "@tanstack/react-start";
import { hostOf, linkFailureMessage, unlocatedMessage } from "@/lib/link-failure";
import { useEffect, useRef, useState } from "react";
import { Link2, Plus, Search } from "lucide-react";
import { placeSuggestionLines } from "@/lib/place-label";
import { extractPastedPlaceLink, looksLikePastedPlaceLink } from "@/lib/place-paste";
import { hitsSpanCountries } from "@/lib/place-search-near";
import {
  parsePlaceLink,
  searchPlaces,
  suggestPlaces,
  type ParsedPlace,
} from "@/lib/places.functions";
import { PLACE_LOOKUP_GAP_MS } from "@/lib/world-countries";

/** Long enough that a name is worth looking up, short enough to feel live. */
const TYPE_AHEAD_MIN = 3;

export function PlaceSearchInput({
  value,
  onChange,
  onPick,
  placeholder = "Search or type a place",
  near,
  center,
  areas = false,
  onSaveTyped,
  /**
   * Where the person is, when it is known.
   *
   * A search for a chain — "harveys", "subway", "pret" — names thousands of
   * identical shops, and without this the lookup covers the planet and
   * answers with none of them. The one they mean is the one they can walk to.
   */
  at,
  /**
   * Called when an empty result offers to search nearby. The parent asks for
   * the position and passes it back as `at`, which re-runs the search.
   */
  onLocate,
  /** Off for fields where a lookup on every pause would be noise. */
  typeAhead = true,
  quickAdd,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: ParsedPlace) => void;
  placeholder?: string;
  near?: string;
  /** The middle of the trip: where a chain or "coffee" is looked for when `at` is unknown. */
  center?: { lat: number; lon: number } | null | undefined;
  /** Choosing a destination: countries and towns first, never shops or restaurants. */
  areas?: boolean;
  /**
   * Keep what was typed when the search cannot find it. Offered under every
   * answer, so a place the map does not know is never a dead end.
   */
  onSaveTyped?: ((text: string) => void) | undefined;
  at?: { lat: number; lon: number } | null | undefined;
  onLocate?: (() => void) | undefined;
  typeAhead?: boolean;
  /**
   * A second action on each suggestion: take this one straight away, rather
   * than filling the form and making the user confirm. Tapping the row still
   * fills the form for anyone who wants to set things first.
   */
  quickAdd?:
    { label: string; busyLabel?: string; onAdd: (place: ParsedPlace) => Promise<void> } | undefined;
}) {
  const search = useServerFn(searchPlaces);
  const parseLink = useServerFn(parsePlaceLink);
  const suggest = useServerFn(suggestPlaces);
  const [hits, setHits] = useState<ParsedPlace[]>([]);
  /** Close spellings offered when a search finds nothing: "Did you mean Miyajima?" */
  const [suggestions, setSuggestions] = useState<ParsedPlace[]>([]);
  /** The query suggestions were last asked for, so an empty answer is asked once. */
  const suggestedFor = useRef("");

  /**
   * After an empty answer, look for close spellings. Once per query: the
   * type-ahead and the Search button can both come back empty for it.
   */
  const offerSuggestions = async (q: string, isCurrent: () => boolean = () => true) => {
    if (q.length < 4 || suggestedFor.current === q) return;
    suggestedFor.current = q;
    try {
      const res = await suggest({
        data: { query: q, ...(near ? { near } : {}), ...(center ? { center } : {}) },
      });
      if (isCurrent()) setSuggestions(res);
    } catch {
      // Nothing to suggest is what the empty search already said.
    }
  };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /** Bumped on pick/clear so type-ahead does not immediately re-open. */
  const settled = useRef("");
  const [addingIndex, setAddingIndex] = useState(-1);

  const run = async () => {
    const q = value.trim();
    if (q.length < 2 && !looksLikePastedPlaceLink(q)) return;
    setBusy(true);
    setErr("");
    try {
      const pasted = extractPastedPlaceLink(q);
      if (pasted) {
        const place = await parseLink({
          data: {
            url: pasted.url,
            ...(pasted.nameHint ? { nameHint: pasted.nameHint } : {}),
            ...(pasted.addressHint ? { addressHint: pasted.addressHint } : {}),
          },
        });
        settled.current = place.name;
        onPick(place);
        setHits([]);
        if (place.partial) {
          setErr(linkFailureMessage(place.partialReason, hostOf(place.url)));
        } else if (place.unlocated) {
          setErr(unlocatedMessage(place.name));
        }
        return;
      }
      const res = await search({
        data: {
          query: q,
          ...(near ? { near } : {}),
          ...(at ? { at } : {}),
          ...(center ? { center } : {}),
          ...(areas ? { areas: true } : {}),
        },
      });
      setHits(res);
      setSuggestions([]);
      if (res.length === 0) {
        void offerSuggestions(q);
        // Say which of the two happened. "No match" while Béa was looking at
        // the whole world reads as "this place does not exist", and the fix
        // is one tap away rather than a rephrasing.
        setErr(
          at || near
            ? "No match on the map — you can still type it in."
            : "No match — Béa searched the whole world. Try adding the city, or look near you.",
        );
      }
    } catch {
      setErr(
        looksLikePastedPlaceLink(q)
          ? "Couldn't read that link just now."
          : "Couldn't reach the map right now.",
      );
    } finally {
      setBusy(false);
    }
  };

  // Look the name up once typing pauses, so finding a place is just typing it.
  // Gated on the same gap the rest of the app uses to stay inside Nominatim's
  // usage policy, and skipped for pasted links (those need the Read button, or
  // Enter, so a half-pasted URL is never fetched).
  useEffect(() => {
    if (!typeAhead) return;
    const q = value.trim();
    if (q.length < TYPE_AHEAD_MIN) {
      setHits([]);
      setSuggestions([]);
      setErr("");
      return;
    }
    if (q === settled.current) return;
    if (looksLikePastedPlaceLink(q)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await search({
          data: {
            query: q,
            ...(near ? { near } : {}),
            ...(at ? { at } : {}),
            ...(center ? { center } : {}),
            ...(areas ? { areas: true } : {}),
          },
        });
        if (cancelled) return;
        setHits(res);
        setSuggestions([]);
        // Type-ahead used to go quiet on an empty answer, so a search that
        // needed "near me" looked like the box was broken — no list, no
        // message, no button. Say so the same way the Search tap does.
        if (res.length === 0) {
          void offerSuggestions(q, () => !cancelled);
          setErr(
            at || near
              ? "No match on the map — you can still type it in."
              : "No match — Béa searched the whole world. Try adding the city, or look near you.",
          );
        } else {
          setErr("");
        }
      } catch {
        /* a quiet type-ahead failure should not shout; the button still reports */
      }
    }, PLACE_LOOKUP_GAP_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // offerSuggestions reads the same props; listing it would re-run the
    // lookup on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, near, at, center, areas, typeAhead, search]);

  /**
   * A position arriving is an answer to the search that just failed, so run
   * it again rather than making the person press the button a second time.
   */
  const locatedOnce = useRef(false);
  useEffect(() => {
    if (!at || locatedOnce.current) return;
    locatedOnce.current = true;
    if (value.trim().length >= TYPE_AHEAD_MIN) void run();
    // `run` reads current state each call; adding it here would re-run on
    // every keystroke instead of only when the position lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  const linkPaste = looksLikePastedPlaceLink(value);

  const choose = (place: ParsedPlace) => {
    settled.current = place.name;
    onPick(place);
    setHits([]);
    setSuggestions([]);
    setErr("");
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run();
            }
            if (e.key === "Escape") setHits([]);
          }}
          rows={linkPaste ? 3 : 1}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || (!linkPaste && value.trim().length < 2)}
          aria-label={linkPaste ? "Read this link" : "Find on the map"}
          title={linkPaste ? "Read this link" : "Find on the map"}
          className="grid size-[42px] shrink-0 place-items-center rounded-xl border border-border disabled:opacity-50"
        >
          {busy ? (
            <span className="text-[13px]">…</span>
          ) : linkPaste ? (
            <Link2 className="size-4" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
        </button>
      </div>
      {err && <p className="text-[12px] text-muted-foreground">{err}</p>}
      {hits.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">Did you mean</span>
          {suggestions.map((place, i) => {
            const line = placeSuggestionLines(place);
            return (
              <button
                key={`${place.name}-${i}`}
                type="button"
                onClick={() => choose(place)}
                title={line.subtitle ?? line.title}
                className="rounded-full border border-primary/50 px-2.5 py-1 text-[12.5px] font-semibold text-primary"
              >
                {place.name}
                {place.city && place.city !== place.name ? (
                  <span className="font-normal text-muted-foreground"> · {place.city}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      {/* Offered on every answer while Béa does not know where you are. It
          used to wait for an empty list or one spanning countries, and so
          hid itself for "subway" when both answers were in Quebec — just not
          the Quebec you are standing in. */}
      {onLocate && !at && !near && (hits.length > 0 || Boolean(err)) && (
        <div className="space-y-1.5">
          {hits.length > 0 && (
            <p className="text-[12px] text-muted-foreground">
              {hitsSpanCountries(hits)
                ? "These are around the world. Search near you for the one on your street."
                : "Not the one you meant? Search near you."}
            </p>
          )}
          <button
            type="button"
            onClick={onLocate}
            className="min-h-11 w-full rounded-xl border border-primary px-3 py-2 text-[13px] font-semibold text-primary"
          >
            Search near me
          </button>
        </div>
      )}
      {at && !near && hits.length > 0 && (
        <p className="text-[12px] text-muted-foreground">Nearest to you first.</p>
      )}
      {hits.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-border bg-elevated p-1.5">
          {hits.slice(0, 5).map((h, i) => {
            const line = placeSuggestionLines(h);
            return (
              <li key={`${h.name}-${i}`} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => choose(h)}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
                >
                  <p className="truncate text-[14.5px] font-medium">{line.title}</p>
                  {line.subtitle ? (
                    <p className="truncate text-[12px] text-muted-foreground">{line.subtitle}</p>
                  ) : null}
                </button>
                {quickAdd && (
                  <button
                    type="button"
                    disabled={addingIndex >= 0}
                    aria-label={`${quickAdd.label}: ${line.title}`}
                    onClick={() => {
                      setAddingIndex(i);
                      void quickAdd
                        .onAdd(h)
                        .then(() => {
                          settled.current = h.name;
                          setHits([]);
                        })
                        .finally(() => setAddingIndex(-1));
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/50 px-2.5 py-1.5 text-[12px] font-semibold text-primary disabled:opacity-50"
                  >
                    {addingIndex === i ? (
                      (quickAdd.busyLabel ?? "Adding…")
                    ) : (
                      <>
                        <Plus className="size-3.5" aria-hidden />
                        {quickAdd.label}
                      </>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {onSaveTyped &&
        value.trim().length >= 2 &&
        !looksLikePastedPlaceLink(value.trim()) &&
        !busy &&
        (hits.length > 0 || Boolean(err)) && (
          <button
            type="button"
            onClick={() => onSaveTyped(value.trim())}
            className="min-h-10 w-full rounded-xl border border-dashed border-border px-3 py-2 text-left text-[13px] text-muted-foreground"
          >
            {hits.length > 0 ? "Not in the list? " : ""}
            <span className="font-semibold text-foreground">Save “{value.trim()}” as typed</span>
            <span className="block text-[12px]">
              It opens in Maps by name; add the spot later if you like.
            </span>
          </button>
        )}
    </div>
  );
}
