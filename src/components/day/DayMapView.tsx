import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MapPin, Maximize2 } from "@/components/icons";
import { DayMap } from "@/components/day/DayMap";
import { useBeaSays } from "@/components/day/bea-says";
import { BeaSays, LegIcon, StopArt, StopChips, StopDisc } from "@/components/day/stop-bits";
import { dayLengthLabel, dayTitle, legWords, measured } from "@/components/day/stop-words";
import type { ItineraryRow } from "@/hooks/useTrips";
import { dayTightnessNote } from "@/lib/day-shape";
import {
  dayMapCaption,
  dayMapModel,
  focusStart,
  isMapLayout,
  legEstimate,
  stepPin,
  toggleSelection,
  tonesUsed,
  type DayMapModel,
  type MapLayout,
} from "@/lib/day-map";
import { leaveBy } from "@/lib/companion";
import type { RouteLeg } from "@/lib/directions.functions";
import { mapsPlaceUrl } from "@/lib/direction-stops";
import { GEOAPIFY_ATTRIBUTION, OSM_ATTRIBUTION, OVERTURE_ATTRIBUTION } from "@/lib/geo-endpoints";
import { stayLabel } from "@/lib/planned-stay";
import { timeForRail } from "@/lib/timeline-kind";
import { placed as hasPosition } from "@/lib/trip-map";
import type { TimelineDayGroup } from "@/lib/timeline-groups";
import type { LegMode } from "@/lib/travel-mode";

const LAYOUT_KEY = "bea.mapLayout";

/** Split's map, on top of the day's list. */
const SPLIT_MAP_HEIGHT = "h-[min(44dvh,340px)] min-h-[240px]";
/** Live's map: most of a phone screen, with the stop's sheet under it. */
const LIVE_MAP_HEIGHT = "h-[min(52dvh,460px)] min-h-[280px]";

/** What the master calls the two layouts; the stored ids stay as they were. */
const LAYOUTS: { id: MapLayout; label: string }[] = [
  { id: "focus", label: "Live" },
  { id: "split", label: "Split" },
];

function readLayout(): MapLayout {
  try {
    const saved = window.localStorage.getItem(LAYOUT_KEY);
    return isMapLayout(saved) ? saved : "split";
  } catch {
    return "split";
  }
}

/** A measured leg from the page, when it has one for these two stops. */
type LegFor = (from: ItineraryRow, to: ItineraryRow) => RouteLeg | undefined;

/**
 * The chosen day on a map, two ways, as the master draws them:
 *
 * - **Live** (stored as "focus") — a big map, and under it the sheet of the
 *   stop in hand: step through the day, and the map travels to each stop.
 * - **Split** — the map on top and the day under it as a timeline, with the
 *   walk or drive between stops.
 *
 * The itinerary stays the source of truth: the pins are numbered like the
 * cards and joined by a soft arc that says "then here", never a route. A walk
 * or drive is the measured leg when the trip has one (saved or worked out
 * directions); otherwise the straight-line estimate, which says "about".
 */
export function DayMapView({
  groups,
  area,
  focusId,
  todayKey,
  ordinals,
  nesting = true,
  legFor,
}: {
  groups: TimelineDayGroup<ItineraryRow>[];
  /** Off: the flat view — ordinary pins, and no "In …" on the cards. */
  nesting?: boolean;
  area: string;
  /** A stop to open on, from "Locate on map" in the Timeline. */
  focusId?: string | null | undefined;
  /** Today's YYYY-MM-DD, so Live can open on what is next. */
  todayKey: string;
  /** "Day 3" for each day's key, counted across the whole trip. */
  ordinals: Record<string, string>;
  legFor?: LegFor | undefined;
}) {
  const stops = groups.flatMap((group) => group.items);
  const model = dayMapModel(stops, { nesting });
  // Flat: no stop is named as inside another.
  const titles = new Map(nesting ? stops.map((stop) => [stop.id, stop.title]) : []);
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);
  const [layout, setLayoutState] = useState<MapLayout>("split");
  const [fitSignal, setFitSignal] = useState(0);

  // Stored per device, read after mount so the server and browser agree.
  useEffect(() => setLayoutState(readLayout()), []);
  const setLayout = (next: MapLayout) => {
    setLayoutState(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  };

  // Live always has a stop in hand: the one asked for, what is next today,
  // or the first.
  useEffect(() => {
    if (layout !== "focus" || selectedId) return;
    const now = new Date();
    setSelectedId(
      focusStart(model.pins, stops, {
        requested: focusId ?? null,
        isToday: groups.length === 1 && groups[0]!.key === todayKey,
        minutesNow: now.getHours() * 60 + now.getMinutes(),
      }),
    );
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps -- on entering Live only

  const pickFromMap = (id: string) => {
    if (layout === "focus") {
      setSelectedId(id);
      return;
    }
    setSelectedId((current) => toggleSelection(current, id));
    document.getElementById(`stop-${id}`)?.scrollIntoView({ block: "nearest" });
  };
  const pickFromList = (id: string) => setSelectedId((current) => toggleSelection(current, id));

  if (model.plan.kind === "none") {
    return (
      <div className="space-y-3">
        <LayoutSwitch value={layout} onChange={setLayout} />
        <div className="plain-card space-y-1 p-4">
          <p className="font-display text-[22px] leading-snug">Nothing to put on the map yet.</p>
          <p className="text-[14px] text-muted-foreground">
            None of {area ? `your ${area} stops` : "these stops"} has a location. Add an address to
            a stop in the Timeline and it appears here.
          </p>
        </div>
      </div>
    );
  }

  const mapLabel = `Map of ${model.pins.length === 1 ? "one place" : `${model.pins.length} places`}`;
  const fitButton = (
    <MapButton
      onClick={() => setFitSignal((n) => n + 1)}
      className="absolute left-3 top-3"
      label="Fit the whole day"
    >
      <Maximize2 className="size-4" aria-hidden />
    </MapButton>
  );

  return (
    <StopTitles.Provider value={titles}>
      <div className="space-y-3">
        <LayoutSwitch value={layout} onChange={setLayout} />

        {layout === "split" &&
          // One map per day, each with only that day's pins.
          groups.map((group) => {
            const dayModel = dayMapModel(group.items, { nesting });
            const dayLabel = `Map of ${ordinals[group.key] || group.label}: ${
              dayModel.pins.length === 1 ? "one place" : `${dayModel.pins.length} places`
            }`;
            return (
              <section key={group.key || "undated"} className="space-y-3">
                {dayModel.pins.length > 0 ? (
                  <DayMap
                    pins={dayModel.pins}
                    selectedId={selectedId}
                    onSelect={pickFromMap}
                    heightClass={SPLIT_MAP_HEIGHT}
                    roundedClass="rounded-[var(--r-card)]"
                    fitSignal={fitSignal}
                    label={dayLabel}
                  >
                    {fitButton}
                    <Legend model={dayModel} />
                  </DayMap>
                ) : (
                  <div className="plain-card grid h-24 place-items-center p-4 text-center text-[13px] text-muted-foreground">
                    No stop on this day has a location yet.
                  </div>
                )}
                <SplitDay
                  group={group}
                  ordinal={ordinals[group.key] ?? ""}
                  selectedId={selectedId}
                  onSelect={pickFromList}
                  legFor={legFor}
                />
              </section>
            );
          })}

        {layout === "focus" && (
          <LiveLayout
            model={model}
            stops={stops}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPick={pickFromMap}
            mapLabel={mapLabel}
            legFor={legFor}
          />
        )}

        <MapFootnotes model={model} />
      </div>
    </StopTitles.Provider>
  );
}

/** Every stop's title by id, so a card can name the stop it is inside. */
const StopTitles = createContext<ReadonlyMap<string, string>>(new Map());

/**
 * What is nested, in the map's cards: the stop this one is inside, and what
 * to see inside it, with how many are ticked off.
 */
function NestLines({ item }: { item: ItineraryRow }) {
  const titles = useContext(StopTitles);
  const parent = item.parent_id ? titles.get(item.parent_id) : undefined;
  const inside = item.inside ?? [];
  if (!parent && inside.length === 0) return null;
  const seen = inside.filter((entry) => entry.done).length;
  return (
    <>
      {parent ? (
        <span className="mt-0.5 block text-[10.5px] font-bold uppercase tracking-wide text-primary">
          In {parent}
        </span>
      ) : null}
      {inside.length > 0 ? (
        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
          Inside: {inside.map((entry) => entry.title).join(" · ")}
          {seen > 0 ? ` (${seen} seen)` : ""}
        </span>
      ) : null}
    </>
  );
}

function LayoutSwitch({
  value,
  onChange,
}: {
  value: MapLayout;
  onChange: (layout: MapLayout) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Map layout"
      className="mx-auto flex w-full max-w-md items-center gap-1 rounded-full bg-elevated p-1"
    >
      {LAYOUTS.map((layout) => (
        <button
          key={layout.id}
          type="button"
          aria-pressed={value === layout.id}
          onClick={() => onChange(layout.id)}
          className={`min-h-10 flex-1 rounded-full text-[15px] transition-colors ${
            value === layout.id
              ? "border border-primary bg-card font-semibold text-foreground shadow-xs"
              : "border border-transparent text-muted-foreground"
          }`}
        >
          {layout.label}
        </button>
      ))}
    </div>
  );
}

/** A round button laid over the map, like its zoom buttons. */
function MapButton({
  onClick,
  className,
  children,
  label,
}: {
  onClick: () => void;
  className: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`z-[500] inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-(--journal-control) px-2.5 text-[12.5px] font-semibold text-(--journal-ink) shadow-(--journal-control-shadow) backdrop-blur-sm ${className}`}
    >
      {children}
    </button>
  );
}

/** Which colour is which, listing only the families on this map. */
function Legend({ model }: { model: DayMapModel }) {
  const tones = tonesUsed(model.pins);
  if (tones.length < 2) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-[500] space-y-1.5 rounded-2xl bg-(--journal-control) px-3 py-2.5 text-[11.5px] font-medium text-(--journal-ink) shadow-(--journal-control-shadow)">
      {tones.map(({ tone, label }) => (
        <p key={tone} className="flex items-center gap-2">
          <span className={`journal-legend-dot journal-legend-dot--${tone}`} aria-hidden />
          {label}
        </p>
      ))}
    </div>
  );
}

function MapFootnotes({ model }: { model: DayMapModel }) {
  const caption = dayMapCaption(model);
  return (
    <div className="space-y-1 px-1">
      {caption && <p className="text-[12px] leading-snug text-muted-foreground">{caption}</p>}
      {/* The credit ODbL asks for, next to the data it applies to. */}
      <p className="text-[10.5px] text-muted-foreground/80">
        {OSM_ATTRIBUTION} · {GEOAPIFY_ATTRIBUTION} · {OVERTURE_ATTRIBUTION}
      </p>
    </div>
  );
}

/** The journey between two stops: the measured leg, else "about" as the crow flies. */
function between(
  from: ItineraryRow,
  to: ItineraryRow,
  legFor: LegFor | undefined,
): { walking: boolean; mode?: LegMode; text: string } | null {
  const leg = legFor?.(from, to);
  if (measured(leg)) {
    const words = legWords(leg);
    return {
      walking: words.walking,
      mode: words.mode,
      text: `${words.time}${words.mode === "driving" ? "" : ` ${words.how}`} · ${words.distance}`,
    };
  }
  if (!hasPosition(from) || !hasPosition(to)) return null;
  const guess = legEstimate(from, to);
  return { walking: guess.walkMinutes !== null, text: guess.label };
}

/**
 * Split's list: "Day 1 · Thu, Oct 1" with its size, Béa's note when the plan
 * is tighter than the walking, and the stops on a coloured line with the walk
 * or drive between them.
 */
function SplitDay({
  group,
  ordinal,
  selectedId,
  onSelect,
  legFor,
}: {
  group: TimelineDayGroup<ItineraryRow>;
  ordinal: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  legFor: LegFor | undefined;
}) {
  const note = dayTightnessNote(group.items);
  const length = dayLengthLabel(group.items, legFor);
  return (
    <div className="plain-card px-3.5 pb-2 pt-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border pb-3">
        <h2 className="font-display text-[27px] leading-none">
          {dayTitle(group.key, ordinal, group.label)}
        </h2>
        <p className="text-[13.5px] text-muted-foreground">
          {group.items.length} {group.items.length === 1 ? "stop" : "stops"}
          {length ? ` · ${length}` : ""}
        </p>
      </header>

      {note && (
        <div className="mb-3 rounded-2xl bg-primary-soft px-3.5 py-2.5">
          <p className="text-[12px] font-semibold text-primary">Béa’s note</p>
          <p className="mt-0.5 text-[13px] leading-snug">{note}</p>
        </div>
      )}

      <ol>
        {group.items.map((item, i) => {
          const next = group.items[i + 1];
          const leg = next ? between(item, next, legFor) : null;
          return (
            <li key={item.id} className="relative">
              <SplitStop
                item={item}
                number={i + 1}
                selected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
              />
              {next && (
                <div className="relative flex min-h-9 items-center gap-2 border-b border-border/70 pl-[3.25rem] text-[13px] text-muted-foreground">
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-[13px] top-0 border-l-2 border-dashed border-primary/40"
                  />
                  {leg ? (
                    <>
                      <LegIcon
                        walking={leg.walking}
                        mode={leg.mode}
                        className="size-4 shrink-0 text-foreground"
                      />
                      {leg.text}
                    </>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SplitStop({
  item,
  number,
  selected,
  onSelect,
}: {
  item: ItineraryRow;
  number: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const time = timeForRail(item.time_label);
  const placed = hasPosition(item);
  const body = (
    <span className="flex items-start gap-2.5 py-2.5">
      <span className="relative z-10 flex w-7 shrink-0 justify-center pt-0.5">
        <StopDisc number={number} />
      </span>
      <span
        className={`w-12 shrink-0 pt-1 text-[14px] font-bold tabular-nums ${time ? "text-primary" : "text-muted-foreground"}`}
      >
        {time || "–"}
      </span>
      <StopArt item={item} className="h-[62px] w-[78px] rounded-xl" />
      <span className="block min-w-0 flex-1">
        <span className="block break-words font-display text-[18px] leading-tight">
          {item.title}
        </span>
        {item.planned_stay_minutes ? (
          <span className="block text-[12.5px] text-muted-foreground">
            {stayLabel(item.planned_stay_minutes)}
          </span>
        ) : null}
        {selected && item.address?.trim() ? (
          <span className="block text-[12px] leading-snug text-muted-foreground">
            {item.address}
          </span>
        ) : null}
        <NestLines item={item} />
        <StopChips
          item={item}
          extra={
            !placed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <MapPin className="size-3" aria-hidden />
                Not on the map yet
              </span>
            ) : null
          }
        />
      </span>
      <ChevronRight
        className={`mt-5 size-5 shrink-0 text-muted-foreground transition-transform ${selected ? "rotate-90" : ""}`}
        aria-hidden
      />
    </span>
  );

  return (
    <div
      id={`stop-${item.id}`}
      className={`relative rounded-2xl transition-colors ${selected ? "bg-primary-soft/60" : ""}`}
    >
      {placed ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="block w-full text-left"
        >
          {body}
          <span className="sr-only">Show on the map</span>
        </button>
      ) : (
        body
      )}
      {selected && placed && (
        <div className="pb-2 pl-[3.25rem]">
          <a
            href={mapsPlaceUrl(item.title, { lat: item.lat, lon: item.lon }, item.address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-primary"
          >
            <MapPin className="size-4" aria-hidden />
            Open in maps
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Live: a big map, and the stop in hand on a sheet under it. Arrows, a swipe
 * on the sheet, the numbered strip or a pin all move to another stop, and the
 * map travels there.
 */
function LiveLayout({
  model,
  stops,
  selectedId,
  onSelect,
  onPick,
  mapLabel,
  legFor,
}: {
  model: DayMapModel;
  stops: ItineraryRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPick: (id: string) => void;
  mapLabel: string;
  legFor: LegFor | undefined;
}) {
  const pins = model.pins;
  const at = pins.findIndex((pin) => pin.id === selectedId);
  const pin = at === -1 ? null : pins[at]!;
  const stop = pin ? stops.find((item) => item.id === pin.id) : undefined;
  const nextPin = at === -1 ? null : (pins[at + 1] ?? null);
  const next = nextPin ? stops.find((item) => item.id === nextPin.id) : undefined;
  const step = (by: 1 | -1) => onSelect(stepPin(pins, selectedId, by));

  // A horizontal swipe on the sheet steps; a vertical one is left to the page.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current
      ?.querySelector<HTMLElement>('[aria-current="step"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selectedId]);

  const realLeg = stop && next ? legFor?.(stop, next) : undefined;
  const leg = measured(realLeg) ? realLeg : null;
  const leave = next && leg ? leaveBy(next.time_label, leg) : null;
  const trip = stop && next ? between(stop, next, legFor) : null;
  const says = useBeaSays(stop ?? null, next ?? null, leave);
  const current = stop ? Boolean(stop.arrived_at) && !stop.left_at : false;
  const time = stop ? timeForRail(stop.time_label) : "";

  return (
    <div>
      <DayMap
        pins={pins}
        selectedId={selectedId}
        onSelect={onPick}
        heightClass={LIVE_MAP_HEIGHT}
        roundedClass="rounded-t-[var(--r-card)] rounded-b-none"
        follow
        label={mapLabel}
      >
        {/* The day as a strip of numbers, to jump anywhere in it. */}
        <div
          ref={strip}
          className="no-scrollbar absolute inset-x-3 top-3 z-[500] mr-12 flex gap-1.5 overflow-x-auto"
        >
          <MapButton onClick={() => onSelect(null)} className="shrink-0" label="Fit the whole day">
            <Maximize2 className="size-4" aria-hidden />
          </MapButton>
          {pins.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-current={p.id === selectedId ? "step" : undefined}
              aria-label={`${p.number}. ${p.title}`}
              className={`grid size-11 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums shadow-(--journal-control-shadow) ${
                p.id === selectedId
                  ? "bg-primary text-primary-foreground"
                  : "bg-(--journal-control) text-(--journal-ink)"
              }`}
            >
              {p.number}
            </button>
          ))}
        </div>
      </DayMap>

      {pin && stop ? (
        <div
          className="relative z-10 -mt-5 touch-pan-y rounded-[var(--r-card)] border border-border bg-card p-3.5 shadow-lg"
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const start = swipe.current;
            swipe.current = null;
            if (!start) return;
            const dx = e.clientX - start.x;
            if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
              step(dx < 0 ? 1 : -1);
            }
          }}
        >
          <span
            aria-hidden
            className="mx-auto -mt-1.5 mb-2 block h-1 w-10 rounded-full bg-border"
          />
          <article aria-live="polite" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-2 text-[13px]">
                <StopDisc number={pin.number} className="size-8 text-[13px]" />
                <span className="font-bold uppercase tracking-wide text-primary">
                  {current ? "Current stop" : "Stop"}
                </span>
                {time && <span className="tabular-nums">· {time}</span>}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous stop"
                  className="grid size-10 place-items-center rounded-full bg-elevated"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <span className="min-w-10 text-center text-[13px] tabular-nums">
                  {at + 1}/{pins.length}
                </span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next stop"
                  className="grid size-10 place-items-center rounded-full bg-elevated"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <StopArt item={stop} className="aspect-[4/3] w-[36%] max-w-[170px] rounded-2xl" />
              <div className="min-w-0 flex-1">
                <h3 className="break-words font-display text-[23px] leading-[1.05]">
                  {stop.title}
                </h3>
                {stop.address?.trim() && (
                  <p className="mt-1 flex items-start gap-1 text-[12.5px] leading-snug text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="line-clamp-2 min-w-0">{stop.address.trim()}</span>
                  </p>
                )}
                <NestLines item={stop} />
                <StopChips
                  item={stop}
                  extra={
                    stop.planned_stay_minutes ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-muted-foreground">
                        ~{stayLabel(stop.planned_stay_minutes)} stay
                      </span>
                    ) : null
                  }
                />
              </div>
            </div>

            {says && <BeaSays line={says} />}

            <div className="flex items-center gap-3 rounded-2xl bg-primary-soft px-3 py-2">
              {leave?.kind === "time" ? (
                <span className="leading-tight">
                  <span className="block text-[12px] text-primary">Leave by</span>
                  <span className="block text-[22px] font-bold tabular-nums leading-none text-primary">
                    {leave.at}
                  </span>
                </span>
              ) : null}
              {leave?.kind === "time" && trip ? (
                <span aria-hidden className="h-8 w-px shrink-0 bg-border" />
              ) : null}
              <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
                {trip ? (
                  <>
                    <LegIcon walking={trip.walking} mode={trip.mode} className="size-5 shrink-0" />
                    <span className="min-w-0 leading-tight">
                      {next ? <span className="block truncate">Then {next.title}</span> : null}
                      <span className="block text-muted-foreground">{trip.text}</span>
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {next ? `Then ${next.title}` : "Last stop of the day"}
                  </span>
                )}
              </span>
              <a
                href={mapsPlaceUrl(stop.title, { lat: stop.lat, lon: stop.lon }, stop.address)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 text-[13.5px] font-semibold text-primary-foreground"
              >
                Navigate
                <ChevronRight className="size-4" aria-hidden />
                <span className="sr-only">: open {stop.title} in maps</span>
              </a>
            </div>

            {next && nextPin ? (
              <button
                type="button"
                onClick={() => step(1)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border p-2.5 text-left"
              >
                <StopArt item={next} className="h-14 w-[72px] rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Next stop
                    {timeForRail(next.time_label) ? (
                      <span className="ml-1.5 font-bold text-primary">
                        · {timeForRail(next.time_label)}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate font-display text-[18px] leading-tight">
                    {next.title}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ) : null}
          </article>
        </div>
      ) : (
        <div className="relative z-10 -mt-5 rounded-[var(--r-card)] border border-border bg-card p-4 text-[13.5px] text-muted-foreground shadow-lg">
          The whole day is on the map. Tap a number or a pin to look at one stop.
        </div>
      )}
    </div>
  );
}
