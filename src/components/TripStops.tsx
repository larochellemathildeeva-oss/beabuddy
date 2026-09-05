import { useState } from "react";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { useTripStops } from "@/hooks/useTripStops";

type Draft = {
  kind: string;
  city: string;
  country: string;
  place_name: string;
  address: string;
  lat?: number;
  lon?: number;
  arrive_on: string;
  depart_on: string;
  notes: string;
};

const EMPTY: Draft = {
  kind: "destination",
  city: "",
  country: "",
  place_name: "",
  address: "",
  arrive_on: "",
  depart_on: "",
  notes: "",
};

export function TripStops({ tripId, uid }: { tripId: string; uid: string | null }) {
  const s = useTripStops(tripId, uid);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");

  return (
    <div className="mb-3 rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label-caps text-foreground">Where you're going</p>
          <p className="text-[11px] text-muted-foreground">
            {s.stops.length === 0
              ? "Add every city — and any stopover along the way."
              : `${s.stops.length} stop${s.stops.length === 1 ? "" : "s"}${
                  s.countries.length > 1 ? ` · ${s.countries.length} countries` : ""
                }`}
          </p>
        </div>
        <button
          onClick={() => {
            setDraft(EMPTY);
            setError("");
            setAdding(!adding);
          }}
          className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
        >
          {adding ? "Cancel" : "Add a stop"}
        </button>
      </div>

      {s.countries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.countries.map((c) => (
            <span key={c} className="rounded-full bg-elevated px-2.5 py-1 text-[11px]">
              {c}
            </span>
          ))}
        </div>
      )}

      {s.stops.length > 0 && (
        <ol className="mt-3 space-y-2">
          {s.stops.map((stop, i) => (
            <li key={stop.id} className="rounded-xl bg-elevated px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">
                    {stop.kind === "layover" ? "✈️ Stopover · " : `${i + 1}. `}
                    {stop.city}
                    {stop.country ? `, ${stop.country}` : ""}
                  </p>
                  {(stop.arrive_on || stop.depart_on) && (
                    <p className="text-[11px] text-muted-foreground">
                      {[stop.arrive_on, stop.depart_on].filter(Boolean).join(" → ")}
                    </p>
                  )}
                  {stop.place_name && (
                    <p className="truncate text-[11px] text-muted-foreground">📍 {stop.place_name}</p>
                  )}
                  {stop.notes && <p className="text-[11px] text-muted-foreground">{stop.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    aria-label="Move stop earlier"
                    disabled={i === 0}
                    onClick={() => void s.moveStop(stop.id, -1)}
                    className="rounded-lg border border-border px-2 py-1 text-[11px] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    aria-label="Move stop later"
                    disabled={i === s.stops.length - 1}
                    onClick={() => void s.moveStop(stop.id, 1)}
                    className="rounded-lg border border-border px-2 py-1 text-[11px] disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => void s.removeStop(stop.id)}
                    className="rounded-lg px-1.5 py-1 text-[11px] text-muted-foreground underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {adding && (
        <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
          <div className="flex gap-1.5">
            {[
              ["destination", "Destination"],
              ["layover", "Stopover / layover"],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setDraft({ ...draft, kind: v as string })}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${
                  draft.kind === v ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <PlaceSearchInput
            value={draft.city}
            onChange={(v) => setDraft({ ...draft, city: v })}
            onPick={(p) =>
              setDraft({
                ...draft,
                city: p.city || p.name,
                country: p.country ?? draft.country,
                place_name: p.city && p.name !== p.city ? p.name : "",
                address: p.address ?? "",
                ...(p.lat != null ? { lat: p.lat } : {}),
                ...(p.lon != null ? { lon: p.lon } : {}),
              })
            }
            placeholder="Search a city or airport"
          />
          <input
            value={draft.country}
            onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            placeholder="Country (fills in automatically)"
            className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
          />
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="Arrive on"
              value={draft.arrive_on}
              onChange={(e) => setDraft({ ...draft, arrive_on: e.target.value })}
              className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
            />
            <input
              type="date"
              aria-label="Leave on"
              value={draft.depart_on}
              onChange={(e) => setDraft({ ...draft, depart_on: e.target.value })}
              className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
            />
          </div>
          <input
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder={draft.kind === "layover" ? "Layover detail (e.g. 6h, terminal 2)" : "Note"}
            className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
          />
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <button
            disabled={!draft.city.trim()}
            onClick={async () => {
              setError("");
              try {
                await s.addStop({
                  kind: draft.kind,
                  city: draft.city.trim(),
                  country: draft.country.trim(),
                  place_name: draft.place_name,
                  address: draft.address,
                  ...(draft.lat != null ? { lat: draft.lat } : {}),
                  ...(draft.lon != null ? { lon: draft.lon } : {}),
                  arrive_on: draft.arrive_on,
                  depart_on: draft.depart_on,
                  notes: draft.notes,
                });
                setDraft(EMPTY);
                setAdding(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't add that stop");
              }
            }}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            Add stop
          </button>
        </div>
      )}
    </div>
  );
}
