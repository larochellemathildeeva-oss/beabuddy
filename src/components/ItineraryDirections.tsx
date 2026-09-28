import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { legsToTimelineItems, placedFromLegs, type DirectionStop } from "@/lib/timeline-directions";
import { savedAgoLabel, savedIsStale } from "@/lib/offline-directions";
import { BeaRunning } from "@/components/BeaRunning";
import { toast } from "sonner";

type TimelineAdd = {
  day_date?: string;
  time_label?: string;
  kind: string;
  title: string;
  detail?: string;
  address?: string;
  lat?: number;
  lon?: number;
};

/** The two boxes remember how they were last left, on this phone only. */
const CHOICE_KEY = "bea:directions-choice";

function readChoice(): { timeline: boolean; phone: boolean } {
  try {
    const raw = window.localStorage.getItem(CHOICE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { timeline?: unknown; phone?: unknown };
      return { timeline: parsed.timeline !== false, phone: parsed.phone === true };
    }
  } catch {
    // Private windows and blocked storage: fall back to the defaults.
  }
  return { timeline: true, phone: false };
}

function writeChoice(choice: { timeline: boolean; phone: boolean }) {
  try {
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify(choice));
  } catch {
    // Not remembering the boxes is fine.
  }
}

/**
 * Directions between stops, asked from the signpost on a day's header.
 *
 * It opens as a sheet with two boxes — add the walks and drives to the
 * timeline, keep them on this phone — so the choice is made once, before the
 * work, instead of in a panel at the foot of the list after it. The same
 * sheet takes them away again.
 */
export function ItineraryDirections({
  open,
  onClose,
  stops,
  area,
  existingTitles = [],
  onAddToTimeline,
  onKeepOffline,
  onPlaced,
  onLegs,
  savedSignature,
  savedAt,
  onBusy,
  timelineCount = 0,
  onRemoveFromTimeline,
  onForgetOffline,
}: {
  open: boolean;
  onClose: () => void;
  stops: DirectionStop[];
  area?: string;
  existingTitles?: string[];
  onAddToTimeline?: (items: TimelineAdd[]) => Promise<void>;
  /** Keep the legs just worked out for offline use. Returns false if storage failed. */
  onKeepOffline?: (
    result: { legs: RouteLeg[]; unresolved: string[]; deferred?: string[] },
    stops: DirectionStop[],
  ) => boolean;
  /**
   * Keep the coordinates the router resolved. Working out a route geocodes
   * every stop, so this hands back what it learned instead of discarding it.
   */
  onPlaced?: ((placed: { id: string; lat: number; lon: number }[]) => void) | undefined;
  /** Hand the legs to the timeline, which draws each one between the two stops it connects. */
  onLegs?: ((legs: RouteLeg[]) => void) | undefined;
  savedSignature?: string | undefined;
  savedAt?: string | undefined;
  onBusy?: ((busy: boolean) => void) | undefined;
  /** How many walks and drives are saved on the timeline now. */
  timelineCount?: number;
  onRemoveFromTimeline?: (() => Promise<void>) | undefined;
  onForgetOffline?: (() => void) | undefined;
}) {
  const run = useServerFn(buildRoutes);
  const [choice, setChoice] = useState(() => ({ timeline: true, phone: false }));
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [deferred, setDeferred] = useState<string[]>([]);
  const [found, setFound] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setChoice(readChoice());
  }, []);
  const onBusyRef = useRef(onBusy);
  onBusyRef.current = onBusy;
  useEffect(() => {
    onBusyRef.current?.(busy);
  }, [busy]);

  const pick = (key: "timeline" | "phone", on: boolean) => {
    const next = { ...choice, [key]: on };
    setChoice(next);
    writeChoice(next);
  };

  const load = async () => {
    setBusy(true);
    setError("");
    setFound(null);
    try {
      const result = (await run({
        data: { stops, ...(area ? { area } : {}) },
      })) as { legs: RouteLeg[]; unresolved: string[]; deferred?: string[] };
      setUnresolved(result.unresolved);
      setDeferred(result.deferred ?? []);
      setFound(result.legs.length);
      onLegs?.(result.legs);
      const placed = placedFromLegs(result.legs, stops);
      if (placed.length > 0) onPlaced?.(placed);
      if (result.legs.length === 0) {
        toast.message("Béa couldn't place these stops on the map yet", {
          description: "Add an address to them and try again.",
        });
        return;
      }

      const saved: string[] = [];
      if (choice.timeline && onAddToTimeline) {
        const items = legsToTimelineItems(result.legs, stops, existingTitles);
        if (items.length > 0) await onAddToTimeline(items);
        saved.push("added to the timeline");
      }
      if (choice.phone && onKeepOffline) {
        const ok = onKeepOffline(
          {
            legs: result.legs,
            unresolved: result.unresolved,
            ...(result.deferred?.length ? { deferred: result.deferred } : {}),
          },
          stops,
        );
        if (ok) saved.push("kept on this phone");
        else setError("This phone is out of room to keep them. They're still on screen.");
      }
      toast.success(
        saved.length ? `Directions ${saved.join(" and ")}` : "Directions are on screen",
        {
          description: saved.length
            ? "Each walk or drive sits under the stop it leaves from."
            : "Not saved — they'll go when you leave this trip.",
        },
      );
      // Anything Béa couldn't find is worth reading, so the sheet stays open for it.
      if (result.unresolved.length === 0) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't work out the directions.");
    } finally {
      setBusy(false);
    }
  };

  const removeFromTimeline = async () => {
    if (!onRemoveFromTimeline) return;
    setRemoving(true);
    setError("");
    try {
      await onRemoveFromTimeline();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove them.");
    } finally {
      setRemoving(false);
    }
  };

  if (stops.length < 2) return null;

  const stale = savedIsStale(savedSignature, stops);
  const offlineNote = !savedAt
    ? null
    : stale
      ? `${savedAgoLabel(savedAt)} on this phone — your stops have changed since.`
      : `${savedAgoLabel(savedAt)} on this phone.`;
  const canRemove = (timelineCount > 0 && onRemoveFromTimeline) || (savedAt && onForgetOffline);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Directions between stops"
      hint="Walks and drives for every day of the trip."
      width="sm"
    >
      <div data-guide="itinerary-directions" className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="label-caps mb-1 text-foreground">Once they're worked out</legend>
          {onAddToTimeline && (
            <Choice
              checked={choice.timeline}
              onChange={(on) => pick("timeline", on)}
              label="Add to timeline"
              detail="Each walk or drive sits between its two stops, steps folded under it."
            />
          )}
          {onKeepOffline && (
            <Choice
              checked={choice.phone}
              onChange={(on) => pick("phone", on)}
              label="Keep on this phone"
              detail="With the map around each day's stops, for when the signal drops."
            />
          )}
        </fieldset>

        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="w-full rounded-xl bg-primary px-3 py-2.5 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Working…" : "Get directions"}
        </button>

        {busy && <BeaRunning moment="plan.locating" status="Working out the walks and drives" />}

        {error && <p className="text-[13px] text-destructive">{error}</p>}

        {found === 0 && !busy && (
          <p className="text-[13px] text-muted-foreground">
            Béa couldn't place these stops on the map yet — add an address to them and try again.
          </p>
        )}
        {unresolved.length > 0 && !busy && (
          <p className="text-[12.5px] text-muted-foreground">
            Couldn't find: {unresolved.join(", ")}. Add an address to them and try again.
          </p>
        )}
        {deferred.length > 0 && !busy && (
          <p className="text-[12.5px] text-muted-foreground">
            Later stretches open in maps — Béa stops looking after a long list so the rest of the
            trip stays usable.
          </p>
        )}

        {canRemove && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="label-caps text-foreground">Remove directions</p>
            {timelineCount > 0 && onRemoveFromTimeline && (
              <button
                type="button"
                disabled={removing || busy}
                onClick={() => void removeFromTimeline()}
                className="w-full rounded-xl border border-border px-3 py-2 text-left text-[13.5px] font-semibold disabled:opacity-50"
              >
                {removing
                  ? "Removing…"
                  : `Remove from timeline (${timelineCount} ${timelineCount === 1 ? "walk or drive" : "walks and drives"})`}
              </button>
            )}
            {savedAt && onForgetOffline && (
              <div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onForgetOffline}
                  className="w-full rounded-xl border border-border px-3 py-2 text-left text-[13.5px] font-semibold disabled:opacity-50"
                >
                  Delete from this phone
                </button>
                {offlineNote && (
                  <p className="mt-1 text-[12px] text-muted-foreground">Saved {offlineNote}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Choice({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-elevated p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
        }`}
      >
        {checked ? <Check className="size-3.5" /> : null}
      </span>
      <span>
        <span className="block text-[14px] font-medium">{label}</span>
        <span className="block text-[12.5px] text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}
