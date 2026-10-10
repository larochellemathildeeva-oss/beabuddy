import { useEffect, useRef, useState } from "react";
import { friendlyError } from "@/lib/friendly-error";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { legsToTimelineItems, placedFromLegs, type DirectionStop } from "@/lib/timeline-directions";
import { directionsToAsk, mergeLegs, type KnownLeg } from "@/lib/directions-reuse";
import { hasCoords, legMapsUrl } from "@/lib/direction-stops";
import { savedAgoLabel, savedIsStale } from "@/lib/offline-directions";
import {
  TRAVEL_CHOICES,
  parseTravelRules,
  travelRulesKey,
  travelRulesSummary,
  type LegMode,
  type TravelChoice,
  type TravelRules,
} from "@/lib/travel-mode";
import { readLastTravelRules } from "@/lib/travel-choice-store";
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
 * It opens as a sheet that asks how the traveller gets around — walking,
 * transit, a car — and has two boxes — add the journeys to the timeline,
 * keep them on this phone — so the choice is made once, before the work,
 * instead of in a panel at the foot of the list after it. The same sheet
 * takes them away again.
 */
export function ItineraryDirections({
  open,
  onClose,
  stops,
  known = [],
  area,
  travel = "auto",
  onTravel,
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
  /**
   * Journeys already worked out, by leg (leg `i` runs from stop `i` to stop
   * `i + 1`). Those that still hold are kept, so adding a stop asks only for
   * the journeys into and out of it, not the whole trip again.
   */
  known?: (KnownLeg | undefined)[];
  area?: string;
  /** How the traveller gets around on this trip; asked here, kept per trip. */
  travel?: TravelChoice;
  onTravel?: ((choice: TravelChoice) => void) | undefined;
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
  /** How many journeys are saved on the timeline now. */
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
      const { keep, ask } = directionsToAsk(stops, known, travel);
      const partial = ask.length < stops.length - 1;
      const answer = (await run({
        data: { stops, ...(area ? { area } : {}), travel, ...(partial ? { legs: ask } : {}) },
      })) as { legs: RouteLeg[]; at?: number[]; unresolved: string[]; deferred?: string[] };
      const merged = partial ? mergeLegs(keep, answer.at ?? ask, answer.legs) : answer.legs;
      if (!merged) throw new Error("Couldn't work out the directions.");
      // Maps starts from the phone: a journey read back from the timeline has
      // no link of its own, and an older one began at the stop before.
      const legs = merged.map((leg, i) => ({
        ...leg,
        mapUrl: legMapsUrl(leg, stops[i + 1]!, area ?? ""),
      }));
      // Stops a kept journey still couldn't place are still worth naming.
      const stillMissing = keep.flatMap((k, i) =>
        k?.leg.unknownSpot
          ? [stops[i]!, stops[i + 1]!].filter((s) => !hasCoords(s)).map((s) => s.title)
          : [],
      );
      const result = {
        legs,
        unresolved: [...new Set([...answer.unresolved, ...stillMissing])],
        ...(answer.deferred?.length ? { deferred: answer.deferred } : {}),
      };
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
        // Journeys already on the timeline stay as they are.
        const items = legsToTimelineItems(result.legs, stops, existingTitles).filter(
          (_, i) => !keep[i]?.onTimeline,
        );
        if (items.length > 0) await onAddToTimeline(items);
        saved.push("added to the timeline");
      }
      if (choice.phone && onKeepOffline) {
        // The stops just found are saved with their new pins, so the copy
        // must be signed with those pins too — else it reads as out of date
        // the moment it is kept.
        const pins = new Map(placed.map((p) => [p.id, p] as const));
        const signed = stops.map((stop) => {
          const pin = stop.id ? pins.get(stop.id) : undefined;
          return pin ? { ...stop, lat: pin.lat, lon: pin.lon } : stop;
        });
        const ok = onKeepOffline(
          {
            legs: result.legs,
            unresolved: result.unresolved,
            ...(result.deferred?.length ? { deferred: result.deferred } : {}),
          },
          signed,
        );
        if (ok) saved.push("kept on this phone");
        else setError("This phone is out of room to keep them. They're still on screen.");
      }
      toast.success(
        saved.length ? `Directions ${saved.join(" and ")}` : "Directions are on screen",
        {
          description: saved.length
            ? "Each journey sits under the stop it leaves from."
            : "Not saved — they'll go when you leave this trip.",
        },
      );
      // Anything Béa couldn't find is worth reading, so the sheet stays open for it.
      if (result.unresolved.length === 0) onClose();
    } catch (e) {
      setError(friendlyError(e, "Couldn't work out the directions."));
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
      setError(friendlyError(e, "Couldn't remove them."));
    } finally {
      setRemoving(false);
    }
  };

  if (stops.length < 2) return null;

  const rules = parseTravelRules(travel);

  const stale = savedIsStale(savedSignature, stops);
  const offlineNote = !savedAt
    ? null
    : stale
      ? `${savedAgoLabel(savedAt)} on this phone — your stops have changed since.`
      : `${savedAgoLabel(savedAt)} on this phone.`;
  const canRemove = (timelineCount > 0 && onRemoveFromTimeline) || (savedAt && onForgetOffline);

  const transitNote = travel === "transit" || rules?.mid === "transit" || rules?.far === "transit";

  // As Figma "Get directions" (118:2091): one column of choices with a dot,
  // the two "once they're worked out" boxes, Get directions and Cancel, then
  // what is kept (118:2185) with its own buttons.
  return (
    <Sheet open={open} onClose={onClose} title="Get directions" width="sm">
      <div data-guide="itinerary-directions" className="dir-sheet">
        {onTravel && (
          <fieldset className="dir-group">
            <legend className="sr-only">Getting around</legend>
            <div role="radiogroup" aria-label="Getting around" className="dir-group">
              {TRAVEL_CHOICES.map((option) => (
                <ChoiceRow
                  key={option.id}
                  on={option.id === travel}
                  label={option.label}
                  detail={option.detail}
                  onClick={() => onTravel(option.id)}
                />
              ))}
              <ChoiceRow
                on={Boolean(rules)}
                label="Your own rules"
                detail={
                  rules
                    ? travelRulesSummary(rules)
                    : "Choose by distance: walk under one, ride or drive past it."
                }
                onClick={() => {
                  if (!rules) onTravel(travelRulesKey(readLastTravelRules()));
                }}
              />
            </div>
            {rules && (
              <TravelRulesEditor rules={rules} onChange={(r) => onTravel(travelRulesKey(r))} />
            )}
          </fieldset>
        )}

        {(onAddToTimeline || onKeepOffline) && (
          <fieldset className="dir-group">
            <legend className="trip-rule-label mb-3 w-full">Once they're worked out</legend>
            {onAddToTimeline && (
              <Choice
                checked={choice.timeline}
                onChange={(on) => pick("timeline", on)}
                label="Add to timeline"
                detail="Each journey sits between its two stops, steps folded under it."
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
        )}

        <div className="dir-group">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="trip-primary"
          >
            {busy ? "Working…" : "Get directions"}
          </button>
          <button type="button" onClick={onClose} className="trip-secondary">
            Cancel
          </button>
        </div>

        {transitNote && (
          <p className="dir-note">
            Transit estimates are not timetables. Each journey opens in Maps for the lines and
            departures.
          </p>
        )}

        {busy && <BeaRunning moment="plan.locating" status="Working out the journeys" />}

        {error && (
          <p role="alert" className="text-[14px] text-destructive">
            {error}
          </p>
        )}

        {found === 0 && !busy && (
          <p className="dir-note">
            Béa couldn't place these stops on the map yet. Add an address to them and try again.
          </p>
        )}
        {unresolved.length > 0 && !busy && (
          <p className="dir-note">
            Couldn't find: {unresolved.join(", ")}. Add an address to them and try again.
          </p>
        )}
        {deferred.length > 0 && !busy && (
          <p className="dir-note">
            Later stretches open in maps — Béa stops looking after a long list so the rest of the
            trip stays usable.
          </p>
        )}

        {canRemove && (
          <section className="dir-group" aria-label="Directions you kept">
            <h3 className="trip-rule-label">Directions you kept</h3>
            {timelineCount > 0 && (
              <div className="dir-row">
                <span className="dir-row-title">On the timeline</span>
                <span className="dir-row-note">
                  {timelineCount} {timelineCount === 1 ? "journey" : "journeys"}
                </span>
              </div>
            )}
            {savedAt && offlineNote ? (
              <div className="dir-row">
                <span className="dir-row-title">On this phone</span>
                <span className="dir-row-note">{offlineNote}</span>
              </div>
            ) : null}
            {timelineCount > 0 && onRemoveFromTimeline && (
              <button
                type="button"
                disabled={removing || busy}
                onClick={() => void removeFromTimeline()}
                className="trip-secondary"
              >
                {removing ? "Removing…" : "Remove from timeline"}
              </button>
            )}
            {savedAt && onForgetOffline && (
              <button
                type="button"
                disabled={busy}
                onClick={onForgetOffline}
                className="trip-secondary"
              >
                Forget offline copy
              </button>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}

/** One way of getting around: a dot and a word, as the design's choice rows. */
function ChoiceRow({
  on,
  label,
  detail,
  onClick,
}: {
  on: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      title={detail}
      onClick={onClick}
      className="dir-choice"
    >
      <span aria-hidden className="dir-dot" />
      <span className="min-w-0">
        <span className="block">{label}</span>
        {on ? <span className="dir-choice-note">{detail}</span> : null}
      </span>
    </button>
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
    <label className="dir-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`dir-box peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
          checked ? "is-on" : ""
        }`}
      >
        {checked ? <Check className="size-3.5" /> : null}
      </span>
      <span>
        <span className="dir-row-title block">{label}</span>
        <span className="dir-row-note block">{detail}</span>
      </span>
    </label>
  );
}

const MODE_LABEL: Record<LegMode, string> = {
  walking: "Walk",
  transit: "Public transit",
  driving: "Car",
};

/**
 * The traveller's own distance rules: walk under one distance, one way up to
 * a second, another beyond. Distances are as the crow flies between two
 * stops, the same measure every other choice uses.
 */
function TravelRulesEditor({
  rules,
  onChange,
}: {
  rules: TravelRules;
  onChange: (rules: TravelRules) => void;
}) {
  // As Figma "Your travel rules" (118:2125): four labelled fields.
  return (
    <div className="dir-rules">
      <label className="dir-field">
        <span>Walk for distances under</span>
        <KmInput
          label="Walk under this many kilometres"
          value={rules.walkKm}
          onCommit={(walkKm) => onChange({ ...rules, walkKm })}
        />
      </label>
      <label className="dir-field">
        <span>For distances up to</span>
        <KmInput
          label="Up to this many kilometres"
          value={rules.farKm}
          onCommit={(farKm) => onChange({ ...rules, farKm })}
        />
      </label>
      <label className="dir-field">
        <span>Intermediate travel mode</span>
        <select
          aria-label="How to go up to that distance"
          value={rules.mid}
          onChange={(e) => onChange({ ...rules, mid: e.target.value as LegMode })}
          className="dir-input"
        >
          {(["transit", "driving", "walking"] as const).map((mode) => (
            <option key={mode} value={mode}>
              {MODE_LABEL[mode]}
            </option>
          ))}
        </select>
      </label>
      <label className="dir-field">
        <span>Beyond that</span>
        <select
          aria-label="How to go further than that"
          value={rules.far}
          onChange={(e) => onChange({ ...rules, far: e.target.value as TravelRules["far"] })}
          className="dir-input"
        >
          {(["transit", "driving"] as const).map((mode) => (
            <option key={mode} value={mode}>
              {MODE_LABEL[mode]}
            </option>
          ))}
        </select>
      </label>
      <p className="dir-note">
        Distances are straight lines between two stops. Walking stops at 15 km; set both to the same
        number for a single cut-off.
      </p>
    </div>
  );
}

/** A distance box that lets "1." be typed on the way to "1.5". */
function KmInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (km: number) => void;
}) {
  const [text, setText] = useState(String(value));
  // While typing, the box keeps what was typed ("1" on the way to "15"),
  // even when the rules tidied it; leaving the box shows what was kept.
  const typing = useRef(false);
  useEffect(() => {
    if (!typing.current) setText(String(value));
  }, [value]);
  return (
    <span className="dir-input flex items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.5}
        aria-label={label}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const km = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(km) && km >= 0) onCommit(km);
        }}
        onFocus={() => {
          typing.current = true;
        }}
        onBlur={() => {
          typing.current = false;
          setText(String(value));
        }}
        className="w-full min-w-0 bg-transparent outline-none"
      />
      <span>km</span>
    </span>
  );
}
