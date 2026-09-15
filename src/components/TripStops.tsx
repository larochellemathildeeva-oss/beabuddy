import { useState } from "react";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { useTripStops, type StopRow } from "@/hooks/useTripStops";
import { filledFromMapSummary, stopKindForPlace } from "@/lib/place-kind";
import { useUndo } from "@/hooks/useUndo";
import { SavedPlacePicker } from "@/components/SavedPlacePicker";
import { toNewStop, type CapturedPlace } from "@/lib/captured-place";

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
  /** What the last map pick filled in, shown once and never saved. */
  filled?: string;
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

/** The fields needed to put a removed stop back. */
function stopFields(stop: StopRow) {
  return {
    kind: stop.kind,
    city: stop.city,
    country: stop.country ?? "",
    place_name: stop.place_name ?? "",
    address: stop.address ?? "",
    ...(stop.lat != null ? { lat: stop.lat } : {}),
    ...(stop.lon != null ? { lon: stop.lon } : {}),
    arrive_on: stop.arrive_on ?? "",
    depart_on: stop.depart_on ?? "",
    notes: stop.notes ?? "",
  };
}

function draftFromStop(stop: StopRow): Draft {
  return {
    kind: stop.kind,
    city: stop.city,
    country: stop.country ?? "",
    place_name: stop.place_name ?? "",
    address: stop.address ?? "",
    ...(stop.lat != null ? { lat: stop.lat } : {}),
    ...(stop.lon != null ? { lon: stop.lon } : {}),
    arrive_on: stop.arrive_on ?? "",
    depart_on: stop.depart_on ?? "",
    notes: stop.notes ?? "",
  };
}

export function TripStops({ tripId, uid }: { tripId: string; uid: string | null }) {
  const s = useTripStops(tripId, uid);
  const { removeWithUndo } = useUndo();
  const [adding, setAdding] = useState(false);
  /** Stop id being edited, or "" while adding a new one. */
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickingSaved, setPickingSaved] = useState(false);

  const close = () => {
    setAdding(false);
    setEditingId("");
    setDraft(EMPTY);
    setError("");
  };

  const openForNew = () => {
    if (adding && !editingId) {
      close();
      return;
    }
    setDraft(EMPTY);
    setError("");
    setEditingId("");
    setAdding(true);
  };

  const openForEdit = (stop: StopRow) => {
    if (editingId === stop.id) {
      close();
      return;
    }
    setDraft(draftFromStop(stop));
    setError("");
    setEditingId(stop.id);
    setAdding(true);
  };

  /** A saved rec becomes a stop, keeping its city, address and map pin. */
  const addSaved = async (place: CapturedPlace) => {
    setError("");
    try {
      await s.addStop(toNewStop(place));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that one");
    }
  };

  const save = async () => {
    const city = draft.city.trim();
    if (!city) return;
    setBusy(true);
    setError("");
    try {
      if (editingId) {
        await s.updateStop(editingId, {
          kind: draft.kind,
          city,
          country: draft.country.trim(),
          place_name: draft.place_name,
          address: draft.address,
          lat: draft.lat ?? null,
          lon: draft.lon ?? null,
          arrive_on: draft.arrive_on,
          depart_on: draft.depart_on,
          notes: draft.notes,
        });
      } else {
        await s.addStop({
          kind: draft.kind,
          city,
          country: draft.country.trim(),
          place_name: draft.place_name,
          address: draft.address,
          ...(draft.lat != null ? { lat: draft.lat } : {}),
          ...(draft.lon != null ? { lon: draft.lon } : {}),
          arrive_on: draft.arrive_on,
          depart_on: draft.depart_on,
          notes: draft.notes,
        });
      }
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that stop");
    } finally {
      setBusy(false);
    }
  };

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
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={openForNew}
            className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
          >
            {adding && !editingId ? "Cancel" : "Add a stop"}
          </button>
          <button
            type="button"
            onClick={() => setPickingSaved((v) => !v)}
            className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
          >
            {pickingSaved ? "Close saved" : "From saved"}
          </button>
        </div>
      </div>

      {pickingSaved && (
        <div className="mt-3">
          <SavedPlacePicker
            alreadyHere={s.stops.map((stop) => ({
              name: stop.place_name || stop.city,
              city: stop.city,
              ...(stop.lat != null ? { lat: stop.lat } : {}),
              ...(stop.lon != null ? { lon: stop.lon } : {}),
            }))}
            onPick={addSaved}
            onClose={() => setPickingSaved(false)}
          />
        </div>
      )}

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
                    <p className="truncate text-[11px] text-muted-foreground">
                      📍 {stop.place_name}
                    </p>
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
                    aria-label={`Edit ${stop.city}`}
                    onClick={() => openForEdit(stop)}
                    className="rounded-lg border border-border px-2 py-1 text-[11px]"
                  >
                    {editingId === stop.id ? "Close" : "Edit"}
                  </button>
                  <button
                    onClick={() =>
                      void removeWithUndo({
                        label: stop.city,
                        remove: () => s.removeStop(stop.id),
                        // Position is not restored: the stop returns at the end
                        // of the list, where the arrows can move it back.
                        restore: () => s.addStop(stopFields(stop)),
                      })
                    }
                    className="rounded-lg px-1.5 py-1 text-[11px] text-muted-foreground underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {editingId === stop.id && (
                <StopDraftForm
                  draft={draft}
                  setDraft={setDraft}
                  error={error}
                  busy={busy}
                  submitLabel="Save changes"
                  onSubmit={save}
                  onCancel={close}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {adding && !editingId && (
        <div className="mt-3">
          <StopDraftForm
            draft={draft}
            setDraft={setDraft}
            error={error}
            busy={busy}
            submitLabel="Add stop"
            onSubmit={save}
            onCancel={close}
          />
        </div>
      )}
    </div>
  );
}

function StopDraftForm({
  draft,
  setDraft,
  error,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
  error: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}) {
  // The country field used to sit there permanently, labelled "fills in
  // automatically" — an empty box that reads as pending work even once the
  // place search has already answered it. Now it only appears when it has to.
  const [forceCountry, setForceCountry] = useState(false);
  /** A hand-picked kind must survive a later map pick. */
  const [kindTouched, setKindTouched] = useState(false);
  const showCountry = forceCountry || !draft.country.trim();

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border p-3">
      <div className="flex gap-1.5">
        {[
          ["destination", "Destination"],
          ["layover", "Stopover / layover"],
        ].map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={draft.kind === v}
            onClick={() => {
              setKindTouched(true);
              setDraft({ ...draft, kind: v as string });
            }}
            className={`rounded-full border px-3 py-1.5 text-[12px] ${
              draft.kind === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border"
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
            // An airport or station picked off the map is a stopover, not a
            // destination — unless the kind was already chosen by hand.
            kind: kindTouched
              ? draft.kind
              : stopKindForPlace({
                  ...(p.placeType ? { placeType: p.placeType } : {}),
                  ...(p.category ? { category: p.category } : {}),
                  name: p.name,
                }),
            filled: filledFromMapSummary({
              address: p.address ?? "",
              city: p.city ?? p.country ?? "",
              ...(p.lat != null ? { lat: p.lat } : {}),
            }),
          })
        }
        placeholder="Type a city, airport or hotel name"
      />
      {draft.filled && (
        <p aria-live="polite" className="px-1 text-[11px] text-muted-foreground">
          {draft.filled}
          {draft.kind === "layover" && !kindTouched ? " Marked as a stopover." : ""}
        </p>
      )}

      {showCountry ? (
        <input
          value={draft.country}
          onChange={(e) => setDraft({ ...draft, country: e.target.value })}
          placeholder="Country"
          aria-label="Country"
          className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
        />
      ) : (
        <p className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
          <span>Country: {draft.country}</span>
          <button type="button" onClick={() => setForceCountry(true)} className="underline">
            Change
          </button>
        </p>
      )}

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
          {...(draft.arrive_on ? { min: draft.arrive_on } : {})}
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
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!draft.city.trim() || busy}
          onClick={() => void onSubmit()}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
