import { useState } from "react";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { useRecommendations } from "@/hooks/useRecommendations";
import type { ParsedPlace } from "@/lib/places.functions";
import type { PinType } from "@/data/atlas";

const types: { type: PinType; label: string }[] = [
  { type: "visited", label: "Been there" },
  { type: "wishlist", label: "Wishlist" },
  { type: "nexttime", label: "Next time" },
];

/**
 * Lets someone type a city by hand, pick it off the map and drop it on the
 * globe — no photos or trips required.
 */
export function AddVisitedCity({ onSaved }: { onSaved?: () => void }) {
  const vault = useRecommendations();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ParsedPlace | null>(null);
  const [type, setType] = useState<PinType>("visited");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const save = async () => {
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

  return (
    <section className="rounded-2xl border border-border bg-card p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="add-city-body"
        className="flex w-full items-center justify-between text-left"
      >
        <span className="label-caps text-foreground">Add a city by hand</span>
        <span className={`text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
      </button>

      {open && (
        <div id="add-city-body" className="mt-3 space-y-3">
          <p className="text-[12px] text-muted-foreground">
            Type a city, pick it from the list, and it appears on the globe straight away.
          </p>

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

          {err && <p className="text-[12px] text-destructive">{err}</p>}
          {msg && <p className="text-[12px] text-muted-foreground">{msg}</p>}

          <button
            onClick={() => void save()}
            disabled={busy || !picked}
            className="w-full rounded-full bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add to my globe"}
          </button>
        </div>
      )}
    </section>
  );
}
