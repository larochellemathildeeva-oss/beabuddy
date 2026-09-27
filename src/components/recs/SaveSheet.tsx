import { useState } from "react";
import { Check } from "@/components/icons";
import { pinColorClass, pinLabel, type PinType } from "@/data/atlas";
import type { NewReco, RecoRowDB } from "@/hooks/useRecommendations";
import { PlaceArt, Sheet } from "./RecsParts";

const LISTS: PinType[] = ["reco", "wishlist", "nexttime", "visited"];

/**
 * After a save: it is already kept, and everything here is optional — a note,
 * who told you, which list. Saved first, filled in after, as before.
 */
export function SaveSheet({
  row,
  fallbackName,
  onUpdate,
  onClose,
}: {
  /** The saved row, once the vault has it back. */
  row: RecoRowDB | undefined;
  fallbackName: string;
  onUpdate: (patch: Partial<NewReco>) => Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState(row?.notes ?? "");
  const [who, setWho] = useState(row?.recommended_by ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = (row?.pin_type ?? "reco") as PinType;
  const name = row?.name ?? fallbackName;

  const run = async (patch: Partial<NewReco>) => {
    setError("");
    try {
      await onUpdate(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update that.");
      throw e;
    }
  };

  const done = async () => {
    const patch: Partial<NewReco> = {};
    if (note.trim() !== (row?.notes ?? "")) patch.notes = note.trim();
    if (who.trim() !== (row?.recommended_by ?? "")) patch.recommended_by = who.trim();
    if (!row || Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await run(patch);
      onClose();
    } catch {
      /* the error line says so */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet label="Saved" onClose={onClose}>
      <div className="flex items-center gap-3 pr-10" aria-live="polite">
        <PlaceArt
          place={{ name, category: row?.category ?? null }}
          className="size-14 rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted-foreground">Saved to</p>
          <p className="truncate text-[16px] font-semibold">Your saved places</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-5" aria-hidden />
        </span>
      </div>

      <label className="mt-5 block">
        <span className="text-[15px] font-semibold">Add a note</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. great for brunch"
          className="mt-2 w-full rounded-xl border border-border bg-card px-3.5 py-3 text-[15px] outline-none focus:border-primary"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-[15px] font-semibold">Who told you</span>
        <input
          value={who}
          onChange={(e) => setWho(e.target.value)}
          placeholder="A friend, a guide, a stranger…"
          className="mt-2 w-full rounded-xl border border-border bg-card px-3.5 py-3 text-[15px] outline-none focus:border-primary"
        />
      </label>

      <div className="mt-5">
        <p className="text-[15px] font-semibold">Add to a list</p>
        <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
          {LISTS.map((t) => {
            const on = list === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!row}
                onClick={() => void run({ pin_type: t }).catch(() => {})}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-[15px] disabled:opacity-60"
              >
                <span
                  className={`size-2.5 shrink-0 rounded-full ${pinColorClass[t]}`}
                  aria-hidden
                />
                <span className="flex-1">{pinLabel[t]}</span>
                <span
                  className={`grid size-5 place-items-center rounded-md border ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                  aria-hidden
                >
                  {on && <Check className="size-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}

      <button
        type="button"
        onClick={() => void done()}
        disabled={busy}
        className="btn-primary mt-5 w-full disabled:opacity-60"
      >
        {busy ? "Saving…" : "Done"}
      </button>
    </Sheet>
  );
}
