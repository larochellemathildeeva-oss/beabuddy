import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { placeSuggestionLines } from "@/lib/place-label";
import { extractPastedPlaceLink, looksLikePastedPlaceLink } from "@/lib/place-paste";
import { parsePlaceLink, searchPlaces, type ParsedPlace } from "@/lib/places.functions";

export function PlaceSearchInput({
  value,
  onChange,
  onPick,
  placeholder = "Search a hotel, restaurant or landmark",
  near,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: ParsedPlace) => void;
  placeholder?: string;
  near?: string;
}) {
  const search = useServerFn(searchPlaces);
  const parseLink = useServerFn(parsePlaceLink);
  const [hits, setHits] = useState<ParsedPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
        onPick(place);
        setHits([]);
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

  const linkPaste = looksLikePastedPlaceLink(value);

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
          }}
          rows={linkPaste ? 2 : 1}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || (!linkPaste && value.trim().length < 2)}
          className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold disabled:opacity-50"
        >
          {busy ? "…" : linkPaste ? "Read link" : "Find on map"}
        </button>
      </div>
      {err && <p className="text-[11px] text-muted-foreground">{err}</p>}
      {hits.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-border bg-elevated p-1.5">
          {hits.slice(0, 5).map((h, i) => {
            const line = placeSuggestionLines(h);
            return (
              <li key={`${h.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(h);
                    setHits([]);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left"
                >
                  <p className="text-[13px] font-medium">{line.title}</p>
                  {line.subtitle ? (
                    <p className="truncate text-[11px] text-muted-foreground">{line.subtitle}</p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
