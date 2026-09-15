import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Link2, Plus, Search } from "lucide-react";
import { placeSuggestionLines } from "@/lib/place-label";
import { extractPastedPlaceLink, looksLikePastedPlaceLink } from "@/lib/place-paste";
import { parsePlaceLink, searchPlaces, type ParsedPlace } from "@/lib/places.functions";
import { PLACE_LOOKUP_GAP_MS } from "@/lib/world-countries";

/** Long enough that a name is worth looking up, short enough to feel live. */
const TYPE_AHEAD_MIN = 3;

export function PlaceSearchInput({
  value,
  onChange,
  onPick,
  placeholder = "Search or type a place",
  near,
  /** Off for fields where a lookup on every pause would be noise. */
  typeAhead = true,
  quickAdd,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: ParsedPlace) => void;
  placeholder?: string;
  near?: string;
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
  const [hits, setHits] = useState<ParsedPlace[]>([]);
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
          data: pasted.nameHint
            ? { url: pasted.url, nameHint: pasted.nameHint }
            : { url: pasted.url },
        });
        settled.current = place.name;
        onPick(place);
        setHits([]);
        if (place.partial) {
          setErr(
            "That link didn't give up any details. Open it in your browser and paste the long link, or type the name.",
          );
        }
        return;
      }
      const res = await search({ data: { query: near ? `${q}, ${near}` : q } });
      setHits(res);
      if (res.length === 0) setErr("No match on the map — you can still type it in.");
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
      return;
    }
    if (q === settled.current) return;
    if (looksLikePastedPlaceLink(q)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await search({ data: { query: near ? `${q}, ${near}` : q } });
        if (!cancelled) setHits(res);
      } catch {
        /* a quiet type-ahead failure should not shout; the button still reports */
      }
    }, PLACE_LOOKUP_GAP_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, near, typeAhead, search]);

  const linkPaste = looksLikePastedPlaceLink(value);

  const choose = (place: ParsedPlace) => {
    settled.current = place.name;
    onPick(place);
    setHits([]);
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
          className="flex-1 resize-none rounded-xl border border-border bg-elevated px-3 py-2.5 text-[13px]"
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
            <span className="text-[12px]">…</span>
          ) : linkPaste ? (
            <Link2 className="size-4" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
        </button>
      </div>
      {err && <p className="text-[11px] text-muted-foreground">{err}</p>}
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
                  <p className="truncate text-[13px] font-medium">{line.title}</p>
                  {line.subtitle ? (
                    <p className="truncate text-[11px] text-muted-foreground">{line.subtitle}</p>
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
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/50 px-2.5 py-1.5 text-[11px] font-semibold text-primary disabled:opacity-50"
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
    </div>
  );
}
