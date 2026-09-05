import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { searchPlaces, type ParsedPlace } from "@/lib/places.functions";

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
  const [hits, setHits] = useState<ParsedPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    const q = value.trim();
    if (q.length < 2) return;
    setBusy(true);
    setErr("");
    try {
      const res = await search({ data: { query: near ? `${q}, ${near}` : q } });
      setHits(res);
      if (res.length === 0) setErr("No match on the map — you can still type it in.");
    } catch {
      setErr("Couldn't reach the map right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void run();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || value.trim().length < 2}
          className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold disabled:opacity-50"
        >
          {busy ? "…" : "Find on map"}
        </button>
      </div>
      {err && <p className="text-[11px] text-muted-foreground">{err}</p>}
      {hits.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-border bg-elevated p-1.5">
          {hits.slice(0, 5).map((h, i) => (
            <li key={`${h.name}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(h);
                  setHits([]);
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left"
              >
                <p className="text-[13px] font-medium">{h.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{h.address ?? ""}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
