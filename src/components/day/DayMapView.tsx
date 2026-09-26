import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Footprints,
  MapPin,
  Maximize2,
  Route,
} from "lucide-react";
import { DayMap } from "@/components/day/DayMap";
import { TimelineGlyphMark } from "@/components/TimelineGlyph";
import type { ItineraryRow } from "@/hooks/useTrips";
import { isBooked } from "@/lib/bookings";
import { dayTightnessNote } from "@/lib/day-shape";
import {
  MAP_LAYOUTS,
  dayDistance,
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
import { mapsPlaceUrl } from "@/lib/direction-stops";
import { formatMetres } from "@/lib/geo";
import { GEOAPIFY_ATTRIBUTION, OSM_ATTRIBUTION } from "@/lib/geo-endpoints";
import { stayLabel } from "@/lib/planned-stay";
import { timeForRail } from "@/lib/timeline-kind";
import { placed as hasPosition } from "@/lib/trip-map";
import type { TimelineDayGroup } from "@/lib/timeline-groups";

const LAYOUT_KEY = "bea.mapLayout";

/**
 * Split and Focus are panels of their own height, so the list and the map
 * each scroll or pan inside them instead of the whole page moving under a
 * map. Tall enough to be the screen on a phone once the banner scrolls away.
 */
const PANEL_HEIGHT = "h-[calc(100dvh-18rem)] min-h-[26rem] max-h-[56rem]";
/**
 * Focus's map fills what is left of a phone screen under the trip banner and
 * above the tab bar, so the card over its foot is in view without scrolling.
 */
const FOCUS_MAP_HEIGHT = "h-[calc(100dvh-18rem)] min-h-[24rem] max-h-[52rem]";
/** The stop card in Focus covers about this much of the map's foot. */
const FOCUS_CARD_INSET = 180;

function readLayout(): MapLayout {
  try {
    const saved = window.localStorage.getItem(LAYOUT_KEY);
    return isMapLayout(saved) ? saved : "split";
  } catch {
    return "split";
  }
}

/**
 * The chosen day on a map, two ways:
 *
 * - **Split** — the day as a timeline beside its map, the way a guidebook
 *   lays a walk out: times on a rail, roughly how far each next stop is,
 *   and the map framing the whole day.
 * - **Focus** — the map first, one stop's card laid over it. Step or swipe
 *   through the day and the map travels to each stop.
 *
 * The itinerary stays the source of truth in both: the map draws the
 * stops, numbered like their cards, and joins them with a soft arc that
 * says "then here", never a route to follow. Distances between stops are
 * as the crow flies and say "about" — nothing here is routed or paid for.
 *
 * With every day shown, the stops are numbered straight through rather than
 * restarting each day: the pins share one map, and two pins both saying "1"
 * would leave the reader to work out which card each belongs to.
 */
export function DayMapView({
  groups,
  area,
  focusId,
  todayKey,
  ordinals,
}: {
  groups: TimelineDayGroup<ItineraryRow>[];
  area: string;
  /** A stop to open on, from "Locate on map" in the Timeline. */
  focusId?: string | null | undefined;
  /** Today's YYYY-MM-DD, so Focus can open on what is next. */
  todayKey: string;
  /** "Day 3" for each day's key, counted across the whole trip. */
  ordinals: Record<string, string>;
}) {
  // Recomputed each render: `groups` is rebuilt upstream every time, and a
  // day's worth of stops costs nothing to walk.
  const stops = groups.flatMap((group) => group.items);
  const model = dayMapModel(stops);
  const titles = new Map(stops.map((stop) => [stop.id, stop.title]));
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

  // Focus always has a stop in hand: the one asked for, what is next today,
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
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps -- on entering Focus only

  const pickFromMap = (id: string) => {
    if (layout === "focus") {
      setSelectedId(id);
      return;
    }
    setSelectedId((current) => toggleSelection(current, id));
    // "nearest" leaves the list alone when the card is already in view.
    document.getElementById(`stop-${id}`)?.scrollIntoView({ block: "nearest" });
  };
  const pickFromList = (id: string) => setSelectedId((current) => toggleSelection(current, id));

  if (model.plan.kind === "none") {
    return (
      <div className="card-soft space-y-1 p-4">
        <p className="font-display text-[19px] leading-snug">Nothing to put on the map yet.</p>
        <p className="text-[14px] text-muted-foreground">
          None of {area ? `your ${area} stops` : "these stops"} has a location. Add an address to a
          stop in the Timeline Editor and it appears here.
        </p>
      </div>
    );
  }

  const mapLabel = `Map of ${model.pins.length === 1 ? "one place" : `${model.pins.length} places`}`;
  const fitButton = (
    <MapButton onClick={() => setFitSignal((n) => n + 1)} className="absolute left-3 top-3">
      <Maximize2 className="size-3.5" aria-hidden />
      Fit route
    </MapButton>
  );

  return (
    <StopTitles.Provider value={titles}>
      <div className="space-y-3">
        <LayoutSwitch value={layout} onChange={setLayout} />

        {layout === "split" && (
          <div
            className={`grid overflow-hidden rounded-3xl border border-border/70 bg-card shadow-2xs max-md:grid-rows-[minmax(0,45fr)_minmax(0,55fr)] md:grid-cols-[minmax(0,46fr)_minmax(0,54fr)] ${PANEL_HEIGHT}`}
          >
            <div className="order-2 min-h-0 overflow-y-auto overscroll-contain px-3.5 pb-6 pt-4 md:order-1 md:px-5">
              <RailList
                groups={groups}
                area={area}
                ordinals={ordinals}
                selectedId={selectedId}
                onSelect={pickFromList}
              />
            </div>
            <div className="order-1 min-h-0 md:order-2">
              <DayMap
                pins={model.pins}
                selectedId={selectedId}
                onSelect={pickFromMap}
                heightClass="h-full"
                roundedClass="rounded-none"
                fitSignal={fitSignal}
                label={mapLabel}
              >
                {fitButton}
                <Legend model={model} />
              </DayMap>
            </div>
          </div>
        )}

        {layout === "focus" && (
          <FocusLayout
            model={model}
            stops={stops}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPick={pickFromMap}
            mapLabel={mapLabel}
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
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div
        role="group"
        aria-label="Map layout"
        className="flex items-center gap-0.5 rounded-xl border border-border bg-elevated p-0.5"
      >
        {MAP_LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            type="button"
            aria-pressed={value === layout.id}
            onClick={() => onChange(layout.id)}
            className={`min-h-9 rounded-lg px-3 text-[12.5px] transition-colors ${
              value === layout.id
                ? "bg-card font-bold text-foreground shadow-xs ring-1 ring-primary/20"
                : "font-semibold text-muted-foreground"
            }`}
          >
            {layout.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A quiet pill laid over the map, like its zoom buttons. */
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
      className={`z-[500] inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[rgb(248_245_241/0.95)] px-3 text-[12.5px] font-semibold text-[#443d36] shadow-[0_1px_3px_rgb(68_61_54/0.16)] backdrop-blur-sm ${className}`}
    >
      {children}
    </button>
  );
}

/** Which colour is which, listing only the families on this map. */
function Legend({ model }: { model: DayMapModel }) {
  const tones = tonesUsed(model.pins);
  if (tones.length < 2 && model.pins.length < 2) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-[500] space-y-1.5 rounded-2xl bg-[rgb(248_245_241/0.94)] px-3 py-2.5 text-[11.5px] font-medium text-[#443d36] shadow-[0_1px_3px_rgb(68_61_54/0.16)]">
      {tones.length > 1 &&
        tones.map(({ tone, label }) => (
          <p key={tone} className="flex items-center gap-2">
            <span className={`journal-legend-dot journal-legend-dot--${tone}`} aria-hidden />
            {label}
          </p>
        ))}
      {model.pins.length > 1 && (
        <p className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-2.5 border-t-2 border-dotted border-[#d96b43]"
          />
          In order
        </p>
      )}
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
        {OSM_ATTRIBUTION} · {GEOAPIFY_ATTRIBUTION}
      </p>
    </div>
  );
}

/** Offsets so numbering runs across the days shown, matching the pins. */
function numberOffsets(groups: TimelineDayGroup<ItineraryRow>[]): number[] {
  return groups.reduce<number[]>(
    (acc, group, i) => [...acc, i === 0 ? 0 : acc[i - 1]! + groups[i - 1]!.items.length],
    [],
  );
}

function kicker(
  group: TimelineDayGroup<ItineraryRow>,
  ordinals: Record<string, string>,
  many: boolean,
): string {
  return ordinals[group.key] || (many ? "Undated" : "The day");
}

/**
 * Split's list: the day as a guidebook page. A heading with the day's size,
 * Béa's note when the plan is tighter than the walking, and each stop on a
 * time rail with roughly how far the next one is.
 */
function RailList({
  groups,
  area,
  ordinals,
  selectedId,
  onSelect,
}: {
  groups: TimelineDayGroup<ItineraryRow>[];
  area: string;
  ordinals: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const offsets = numberOffsets(groups);
  const place = area.split(",")[0]?.trim();
  return (
    <div className="space-y-9">
      {groups.map((group, g) => {
        const placedStops = group.items.filter((item) => hasPosition(item));
        const distance = dayDistance(placedStops);
        const note = dayTightnessNote(group.items);
        return (
          <section key={group.key || "undated"} aria-label={group.label}>
            <header className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                {kicker(group, ordinals, groups.length > 1)}
              </p>
              <h2 className="mt-1 font-display text-[30px] leading-[1.05] tracking-tight">
                {place || group.label}
              </h2>
              <p className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-muted-foreground">
                {place && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" aria-hidden />
                    {group.label}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden />
                  {group.items.length} {group.items.length === 1 ? "stop" : "stops"}
                </span>
                {distance > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Route className="size-3.5" aria-hidden />
                    about {formatMetres(distance)}
                  </span>
                )}
              </p>
            </header>

            {note && (
              <div className="mb-4 rounded-2xl border border-primary/15 bg-primary-soft/60 px-3.5 py-2.5">
                <p className="text-[12px] font-semibold text-primary">Béa’s note</p>
                <p className="mt-0.5 text-[13px] leading-snug">{note}</p>
              </div>
            )}

            <ol className="relative">
              {group.items.map((item, i) => {
                const next = group.items[i + 1];
                const leg =
                  next && hasPosition(item) && hasPosition(next) ? legEstimate(item, next) : null;
                return (
                  <li key={item.id} className="relative">
                    <RailStop
                      item={item}
                      number={offsets[g]! + i + 1}
                      selected={item.id === selectedId}
                      onSelect={() => onSelect(item.id)}
                      last={!next}
                    />
                    {next && (
                      <div className="flex min-h-8 items-center gap-1.5 py-1 pl-[3.75rem] text-[11.5px] text-muted-foreground">
                        {leg ? (
                          <>
                            {leg.walkMinutes !== null && (
                              <Footprints className="size-3.5 shrink-0" aria-hidden />
                            )}
                            {leg.label}
                          </>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function RailStop({
  item,
  number,
  selected,
  onSelect,
  last,
}: {
  item: ItineraryRow;
  number: number;
  selected: boolean;
  onSelect: () => void;
  last: boolean;
}) {
  const time = timeForRail(item.time_label);
  const placed = hasPosition(item);
  const address = item.address?.trim();
  const body = (
    <span className="flex items-start gap-2.5 p-2.5">
      <TimelineGlyphMark item={item} />
      <span className="block min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="break-words text-[14.5px] font-semibold leading-snug">{item.title}</span>
          {isBooked(item) && (
            <span className="rounded-full bg-nexttime/12 px-1.5 py-0.5 text-[10.5px] font-semibold text-nexttime">
              Booked
            </span>
          )}
        </span>
        {address && (
          <span
            className={`mt-0.5 block text-[12px] leading-snug text-muted-foreground ${selected ? "" : "line-clamp-1"}`}
          >
            {address}
          </span>
        )}
        <NestLines item={item} />
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.planned_stay_minutes ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              {stayLabel(item.planned_stay_minutes)}
            </span>
          ) : null}
          {!placed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              <MapPin className="size-3" aria-hidden />
              Not on the map yet
            </span>
          )}
        </span>
      </span>
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-colors ${
          selected
            ? "bg-primary text-primary-foreground shadow-sm"
            : placed
              ? "bg-primary/12 text-primary"
              : "text-muted-foreground"
        }`}
      >
        {number}
      </span>
    </span>
  );

  return (
    <div id={`stop-${item.id}`} className="flex gap-2.5">
      {/* The time rail: the hour, and a thread down to the next stop. */}
      <div className="relative flex w-11 shrink-0 flex-col items-center pt-3">
        <span
          className={`text-[12px] font-bold tabular-nums leading-none ${time ? "text-primary" : "text-muted-foreground"}`}
        >
          {time || "–"}
        </span>
        <span className="mt-1.5 size-1.5 rounded-full bg-primary/40" aria-hidden />
        {!last && (
          <span
            className="absolute bottom-[-2.75rem] top-[2.1rem] w-px bg-primary/20"
            aria-hidden
          />
        )}
      </div>
      <div
        className={`min-w-0 flex-1 overflow-hidden rounded-2xl border bg-card transition-colors ${
          selected ? "border-primary/45 shadow-sm ring-1 ring-primary/15" : "border-border/60"
        }`}
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
          <div className="border-t border-border/60 px-2.5 py-1.5">
            <a
              href={mapsPlaceUrl(item.title, { lat: item.lat, lon: item.lon }, item.address)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-semibold text-primary"
            >
              <MapPin className="size-3.5" aria-hidden />
              Open in maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Focus: the map is the page, and one stop's card sits on it. Arrows, a
 * swipe on the card, the numbered strip or a pin all move to another stop,
 * and the map travels there.
 */
function FocusLayout({
  model,
  stops,
  selectedId,
  onSelect,
  onPick,
  mapLabel,
}: {
  model: DayMapModel;
  stops: ItineraryRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPick: (id: string) => void;
  mapLabel: string;
}) {
  const pins = model.pins;
  const at = pins.findIndex((pin) => pin.id === selectedId);
  const pin = at === -1 ? null : pins[at]!;
  const stop = pin ? stops.find((item) => item.id === pin.id) : undefined;
  const nextPin = at === -1 ? null : (pins[at + 1] ?? null);
  const leg = pin && nextPin ? legEstimate(pin, nextPin) : null;
  const step = (by: 1 | -1) => onSelect(stepPin(pins, selectedId, by));

  // A horizontal swipe on the card steps; a vertical one is left to the page.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current
      ?.querySelector<HTMLElement>('[aria-current="step"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selectedId]);

  return (
    <div className="relative">
      <DayMap
        pins={pins}
        selectedId={selectedId}
        onSelect={onPick}
        heightClass={FOCUS_MAP_HEIGHT}
        follow
        insetBottom={FOCUS_CARD_INSET}
        label={mapLabel}
      >
        {/* The day as a strip of numbers, to jump anywhere in it. */}
        <div
          ref={strip}
          className="no-scrollbar absolute inset-x-3 top-3 z-[500] mr-12 flex gap-1.5 overflow-x-auto"
        >
          <MapButton onClick={() => onSelect(null)} className="shrink-0" label="Fit the whole day">
            <Maximize2 className="size-3.5" aria-hidden />
            <span className="max-sm:sr-only">Whole day</span>
          </MapButton>
          {pins.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-current={p.id === selectedId ? "step" : undefined}
              aria-label={`${p.number}. ${p.title}`}
              className={`grid size-9 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold tabular-nums shadow-[0_1px_3px_rgb(68_61_54/0.16)] ${
                p.id === selectedId
                  ? "bg-primary text-primary-foreground"
                  : "bg-[rgb(248_245_241/0.95)] text-[#443d36]"
              }`}
            >
              {p.number}
            </button>
          ))}
        </div>
      </DayMap>

      {/* The stop's card sits over the foot of the map, and sticks to the
          bottom of the screen when the map runs past it: laid inside the
          map, it was cut off below the fold on a phone. */}
      {pin && stop && (
        <div
          className="sticky bottom-3 z-20 mx-3 -mt-28 touch-pan-y"
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
          <article
            aria-live="polite"
            className="rounded-3xl border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11.5px] font-semibold tabular-nums text-primary-foreground">
                  {pin.number}
                </span>
                {timeForRail(stop.time_label) && (
                  <span className="font-bold tabular-nums text-primary">
                    {timeForRail(stop.time_label)}
                  </span>
                )}
                {stop.planned_stay_minutes ? (
                  <span className="text-muted-foreground">
                    ~{stayLabel(stop.planned_stay_minutes)} stay
                  </span>
                ) : null}
                {isBooked(stop) && (
                  <span className="rounded-full bg-nexttime/12 px-1.5 py-0.5 text-[10.5px] font-semibold text-nexttime">
                    Booked
                  </span>
                )}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous stop"
                  className="grid size-9 place-items-center rounded-xl border border-border bg-elevated"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <span className="min-w-9 text-center text-[11.5px] tabular-nums text-muted-foreground">
                  {at + 1}/{pins.length}
                </span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next stop"
                  className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="mt-1.5 flex items-start gap-2.5">
              <TimelineGlyphMark item={stop} />
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 break-words font-display text-[19px] leading-tight">
                  {stop.title}
                </h3>
                {stop.address?.trim() && (
                  <p className="mt-0.5 line-clamp-1 text-[12px] leading-snug text-muted-foreground">
                    {stop.address.trim()}
                  </p>
                )}
                <p className="leading-none">
                  <NestLines item={stop} />
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              {leg && nextPin ? (
                <p className="flex min-w-0 flex-1 items-start gap-1.5 rounded-xl bg-elevated px-2.5 py-1.5 text-[12px] text-muted-foreground">
                  {leg.walkMinutes !== null ? (
                    <Footprints className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Route className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="line-clamp-2 min-w-0">
                    Then {nextPin.title}, {leg.label}
                  </span>
                </p>
              ) : (
                <span className="flex-1" />
              )}
              <a
                href={mapsPlaceUrl(stop.title, { lat: stop.lat, lon: stop.lon }, stop.address)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border px-2.5 text-[12px] font-semibold"
              >
                <MapPin className="size-3.5" aria-hidden />
                Maps
                <span className="sr-only">: open {stop.title} in maps</span>
              </a>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
