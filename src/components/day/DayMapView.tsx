import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, Maximize2 } from "@/components/icons";
import { DayMap } from "@/components/day/DayMap";
import { LegIcon, StopArt, StopChips, StopDisc } from "@/components/day/stop-bits";
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
  type DayMapPin,
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

/** One day, or Live: the map fills the phone under the trip header. */
const TALL_STAGE = "h-[min(78dvh,760px)] min-h-[480px]";
/** Whole trip in Split: one map per day, each still the main object. */
const STACKED_STAGE = "h-[min(62dvh,560px)] min-h-[420px]";

/** What the master calls the two layouts; the stored ids stay as they were. */
const LAYOUTS: { id: MapLayout; label: string }[] = [
  { id: "focus", label: "Live" },
  { id: "split", label: "Split" },
];

function readLayout(): MapLayout {
  try {
    const saved = window.localStorage.getItem(LAYOUT_KEY);
    return isMapLayout(saved) ? saved : "focus";
  } catch {
    return "focus";
  }
}

function useBoxHeight(ref: RefObject<HTMLElement | null>, on: boolean): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) {
      setHeight(0);
      return;
    }
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, on]);
  return height;
}

/** A measured leg from the page, when it has one for these two stops. */
type LegFor = (from: ItineraryRow, to: ItineraryRow) => RouteLeg | undefined;

/**
 * The chosen day on a map.
 *
 * The map owns the screen. Day chips float on it, and a sheet sits over the
 * bottom: Live (stored as "focus") is one stop, and the map travels with it;
 * Split is that sheet pulled up into the day's list. The choice is remembered
 * on the device. The itinerary stays the source of truth: pins are numbered
 * like the cards and joined by a soft arc that says "then here", never a route.
 */
export function DayMapView({
  groups,
  area,
  focusId,
  todayKey,
  ordinals,
  nesting = true,
  legFor,
  dayStrip,
  onDayStep,
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
  /** The day's chips, drawn on the map rather than above it. */
  dayStrip?: ReactNode;
  /** A sideways swipe on the sheet changes the day. */
  onDayStep?: ((by: 1 | -1) => void) | undefined;
}) {
  const stops = groups.flatMap((group) => group.items);
  const model = dayMapModel(stops, { nesting });
  // Flat: no stop is named as inside another.
  const titles = new Map(nesting ? stops.map((stop) => [stop.id, stop.title]) : []);
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);
  const [layout, setLayoutState] = useState<MapLayout>("focus");
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
  const fit = () => setFitSignal((n) => n + 1);

  if (model.plan.kind === "none") {
    return (
      <div className="space-y-3">
        {dayStrip}
        <LayoutSwitch value={layout} onChange={setLayout} />
        <div className="plain-card space-y-1 p-4">
          <p className="font-display text-[22px] leading-snug">Nothing to put on the map yet.</p>
          <p className="text-[16px] leading-snug text-muted-foreground">
            None of {area ? `your ${area} stops` : "these stops"} has a location. Add an address to
            a stop in the Timeline and it appears here.
          </p>
        </div>
      </div>
    );
  }

  const mapLabel = `Map of ${model.pins.length === 1 ? "one place" : `${model.pins.length} places`}`;
  const tall = layout === "focus" || groups.length === 1;

  return (
    <StopTitles.Provider value={titles}>
      {layout === "focus" ? (
        <FocusStage
          model={model}
          stops={stops}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onPick={pickFromMap}
          mapLabel={mapLabel}
          legFor={legFor}
          layout={layout}
          onLayout={setLayout}
          onFit={() => setSelectedId(null)}
          dayStrip={dayStrip}
          onDayStep={onDayStep}
          heightClass={TALL_STAGE}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => {
            const dayModel = dayMapModel(group.items, { nesting });
            const dayLabel = `Map of ${ordinals[group.key] || group.label}: ${
              dayModel.pins.length === 1 ? "one place" : `${dayModel.pins.length} places`
            }`;
            const strip = index === 0 ? dayStrip : null;
            return (
              <section key={group.key || "undated"} className="space-y-3">
                {dayModel.pins.length > 0 ? (
                  <MapStage
                    pins={dayModel.pins}
                    selectedId={selectedId}
                    onSelect={pickFromMap}
                    label={dayLabel}
                    heightClass={tall ? TALL_STAGE : STACKED_STAGE}
                    fitSignal={fitSignal}
                    layout={layout}
                    onLayout={setLayout}
                    dayStrip={strip}
                    chrome={
                      <MapButton onClick={fit} className="shrink-0" label="Fit the whole day">
                        <Maximize2 className="size-4" aria-hidden />
                      </MapButton>
                    }
                    legend={<Legend model={dayModel} />}
                    sheet={
                      <>
                        <SplitDay
                          group={group}
                          ordinal={ordinals[group.key] ?? ""}
                          selectedId={selectedId}
                          onSelect={pickFromList}
                          legFor={legFor}
                          plain
                        />
                        <MapFootnotes model={dayModel} />
                      </>
                    }
                  />
                ) : (
                  <>
                    {strip}
                    <LayoutSwitch value={layout} onChange={setLayout} />
                    <div className="plain-card grid min-h-24 place-items-center p-4 text-center text-[16px] leading-snug text-muted-foreground">
                      No stop on this day has a location yet.
                    </div>
                    <SplitDay
                      group={group}
                      ordinal={ordinals[group.key] ?? ""}
                      selectedId={selectedId}
                      onSelect={pickFromList}
                      legFor={legFor}
                    />
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
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
        <span className="mt-0.5 block text-[13px] font-bold uppercase tracking-wide text-primary">
          In {parent}
        </span>
      ) : null}
      {inside.length > 0 ? (
        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
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
      className="flex w-full items-center gap-1 rounded-full bg-elevated p-1"
    >
      {LAYOUTS.map((layout) => (
        <button
          key={layout.id}
          type="button"
          aria-pressed={value === layout.id}
          onClick={() => onChange(layout.id)}
          className={`min-h-11 flex-1 rounded-full text-[16px] transition-colors ${
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
      className={`z-[500] inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-(--journal-control) px-2.5 text-[13px] font-semibold text-(--journal-ink) shadow-(--journal-control-shadow) backdrop-blur-sm ${className}`}
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
    <div className="pointer-events-none space-y-1.5 rounded-2xl bg-(--journal-control) px-3 py-2.5 text-[13px] font-medium text-(--journal-ink) shadow-(--journal-control-shadow)">
      {tones.map(({ tone, label }) => (
        <p key={tone} className="flex items-center gap-2">
          <span className={`journal-legend-dot journal-legend-dot--${tone}`} aria-hidden />
          {label}
        </p>
      ))}
    </div>
  );
}

function MapFootnotes({ model, brief = false }: { model: DayMapModel; brief?: boolean }) {
  const caption = dayMapCaption(model);
  return (
    <div className={brief ? "mt-1.5 space-y-1" : "mt-3 space-y-1"}>
      {caption && <p className="text-[14px] leading-snug text-muted-foreground">{caption}</p>}
      {/* The credit ODbL asks for, next to the data it applies to. */}
      <p className="text-[13px] leading-snug text-muted-foreground">
        {OSM_ATTRIBUTION} · {GEOAPIFY_ATTRIBUTION} · {OVERTURE_ATTRIBUTION}
      </p>
    </div>
  );
}

/**
 * Map, floating chips, and the sheet. The sheet's height is given back to the
 * map so a fitted day and a followed stop stay in the part you can see.
 */
function MapStage({
  pins,
  selectedId,
  onSelect,
  label,
  heightClass,
  follow = false,
  fitSignal = 0,
  layout,
  onLayout,
  dayStrip,
  chrome,
  legend,
  sheet,
  onPointerDown,
  onPointerUp,
}: {
  pins: DayMapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  label: string;
  heightClass: string;
  follow?: boolean;
  fitSignal?: number;
  layout: MapLayout;
  onLayout: (layout: MapLayout) => void;
  dayStrip?: ReactNode;
  chrome?: ReactNode;
  legend?: ReactNode;
  sheet: ReactNode;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const chipRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const chipH = useBoxHeight(chipRef, Boolean(dayStrip));
  const sheetH = useBoxHeight(sheetRef, true);
  const insetTop = (dayStrip ? chipH + 16 : 8) + (chrome ? 56 : 0);
  const chromeTop = dayStrip ? chipH + 16 : 8;

  return (
    <div
      className={`trip-map-stage relative overflow-hidden rounded-[var(--r-card)] shadow-sm ${heightClass}`}
    >
      <DayMap
        pins={pins}
        selectedId={selectedId}
        onSelect={onSelect}
        label={label}
        heightClass="h-full w-full"
        roundedClass="rounded-none"
        follow={follow}
        fitSignal={fitSignal}
        insetTop={insetTop}
        insetBottom={sheetH + 12}
        controlsTop={dayStrip ? chipH + 8 : 8}
      />
      <div className="pointer-events-none absolute inset-0 z-10">
        {dayStrip ? (
          <div ref={chipRef} className="pointer-events-auto absolute inset-x-2 top-2 min-w-0">
            {dayStrip}
          </div>
        ) : null}
        {chrome ? (
          <div className="pointer-events-none absolute left-2 right-16" style={{ top: chromeTop }}>
            <div className="pointer-events-auto flex w-max max-w-full gap-1.5">{chrome}</div>
          </div>
        ) : null}
        <div
          ref={sheetRef}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="trip-map-sheet pointer-events-auto absolute inset-x-2 bottom-2 max-h-[min(58%,440px)] touch-pan-y overflow-y-auto rounded-[var(--r-card)] border border-border bg-card shadow-lg"
        >
          <button
            type="button"
            onClick={() => onLayout(layout === "split" ? "focus" : "split")}
            aria-expanded={layout === "split"}
            aria-label={layout === "split" ? "Show one stop" : "Show the day list"}
            className="sticky top-0 z-10 flex h-8 w-full items-center justify-center gap-2 bg-card text-[13px] font-semibold text-muted-foreground"
          >
            <span aria-hidden className="block h-1 w-9 rounded-full bg-border" />
            {layout === "split" ? "Back to one stop" : "Day list"}
          </button>
          <div className="px-2.5 pb-2.5">
            {sheet}
            {legend ? <div className="mt-3">{legend}</div> : null}
          </div>
        </div>
      </div>
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
  plain = false,
}: {
  group: TimelineDayGroup<ItineraryRow>;
  ordinal: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  legFor: LegFor | undefined;
  /** Inside the map sheet the sheet is already the card. */
  plain?: boolean;
}) {
  const note = dayTightnessNote(group.items);
  const length = dayLengthLabel(group.items, legFor);
  return (
    <div
      className={
        plain
          ? ""
          : "rounded-[var(--r-card)] border border-border bg-card px-3.5 pb-2 pt-4 shadow-sm"
      }
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border pb-3">
        <h2 className="font-display text-[22px] leading-tight">
          {dayTitle(group.key, ordinal, group.label)}
        </h2>
        <p className="text-[14px] text-muted-foreground">
          {group.items.length} {group.items.length === 1 ? "stop" : "stops"}
          {length ? ` · ${length}` : ""}
        </p>
      </header>

      {note && (
        <div className="mb-3 rounded-2xl bg-primary-soft px-3.5 py-2.5">
          <p className="text-[13px] font-semibold text-primary">Béa’s note</p>
          <p className="mt-0.5 text-[16px] leading-snug">{note}</p>
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
                <div className="relative flex min-h-11 items-center gap-2 border-b border-border/70 pl-[3.25rem] text-[14px] text-muted-foreground">
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-[13px] top-0 border-l-2 border-dashed border-(--acc-line)"
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
      <span className="relative z-10 flex w-8 shrink-0 justify-center pt-0.5">
        <StopDisc number={number} className="size-8 text-[13px]" />
      </span>
      <span
        className={`w-14 shrink-0 pt-1 text-[14px] font-bold tabular-nums ${time ? "text-primary" : "text-muted-foreground"}`}
      >
        {time || "–"}
      </span>
      <StopArt item={item} className="h-[62px] w-[78px] rounded-xl" />
      <span className="block min-w-0 flex-1">
        <span className="block break-words font-display text-[18px] leading-tight">
          {item.title}
        </span>
        {item.planned_stay_minutes ? (
          <span className="block text-[14px] text-muted-foreground">
            {stayLabel(item.planned_stay_minutes)}
          </span>
        ) : null}
        {selected && item.address?.trim() ? (
          <span className="block text-[14px] leading-snug text-muted-foreground">
            {item.address}
          </span>
        ) : null}
        <NestLines item={item} />
        <StopChips
          item={item}
          extra={
            !placed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[13px] font-medium text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden />
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
            className="inline-flex min-h-11 items-center gap-1.5 text-[16px] font-semibold text-primary"
          >
            <MapPin className="size-4" aria-hidden />
            Open in maps
          </a>
        </div>
      )}
    </div>
  );
}

/** Live: the stop in hand, on the sheet. The map above follows it. */
function FocusStage({
  model,
  stops,
  selectedId,
  onSelect,
  onPick,
  mapLabel,
  legFor,
  layout,
  onLayout,
  onFit,
  dayStrip,
  onDayStep,
  heightClass,
}: {
  model: DayMapModel;
  stops: ItineraryRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPick: (id: string) => void;
  mapLabel: string;
  legFor: LegFor | undefined;
  layout: MapLayout;
  onLayout: (layout: MapLayout) => void;
  onFit: () => void;
  dayStrip?: ReactNode;
  onDayStep?: ((by: 1 | -1) => void) | undefined;
  heightClass: string;
}) {
  const pins = model.pins;
  const at = pins.findIndex((pin) => pin.id === selectedId);
  const pin = at === -1 ? null : pins[at]!;
  const stop = pin ? stops.find((item) => item.id === pin.id) : undefined;
  const nextPin = at === -1 ? null : (pins[at + 1] ?? null);
  const next = nextPin ? stops.find((item) => item.id === nextPin.id) : undefined;
  const step = (by: 1 | -1) => onSelect(stepPin(pins, selectedId, by));

  // A horizontal swipe on the sheet changes the day; a vertical one is left to the page.
  const swipe = useRef<{ x: number; y: number } | null>(null);

  return (
    <MapStage
      pins={pins}
      selectedId={selectedId}
      onSelect={onPick}
      label={mapLabel}
      heightClass={heightClass}
      follow
      layout={layout}
      onLayout={onLayout}
      dayStrip={dayStrip}
      chrome={<NumberStrip pins={pins} selectedId={selectedId} onSelect={onSelect} onFit={onFit} />}
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const start = swipe.current;
        swipe.current = null;
        if (!start) return;
        const dx = e.clientX - start.x;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
          onDayStep?.(dx < 0 ? 1 : -1);
        }
      }}
      sheet={
        <>
          {pin && stop ? (
            <LiveCard
              pin={pin}
              stop={stop}
              next={next}
              at={at}
              total={pins.length}
              onStep={step}
              legFor={legFor}
            />
          ) : (
            <p className="text-[16px] leading-snug text-muted-foreground">
              The whole day is on the map. Tap a number or a pin to look at one stop.
            </p>
          )}
          <MapFootnotes model={model} brief />
        </>
      }
    />
  );
}

function NumberStrip({
  pins,
  selectedId,
  onSelect,
  onFit,
}: {
  pins: DayMapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFit: () => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current
      ?.querySelector<HTMLElement>('[aria-current="step"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selectedId]);
  return (
    <div ref={strip} className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto">
      <MapButton onClick={onFit} className="shrink-0" label="Fit the whole day">
        <Maximize2 className="size-4" aria-hidden />
      </MapButton>
      {pins.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          aria-current={p.id === selectedId ? "step" : undefined}
          aria-pressed={p.id === selectedId}
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
  );
}

function LiveCard({
  pin,
  stop,
  next,
  at,
  total,
  onStep,
  legFor,
}: {
  pin: DayMapPin;
  stop: ItineraryRow;
  next: ItineraryRow | undefined;
  at: number;
  total: number;
  onStep: (by: 1 | -1) => void;
  legFor: LegFor | undefined;
}) {
  const realLeg = next ? legFor?.(stop, next) : undefined;
  const leg = measured(realLeg) ? realLeg : null;
  const leave = next && leg ? leaveBy(next.time_label, leg) : null;
  const trip = next ? between(stop, next, legFor) : null;
  const current = Boolean(stop.arrived_at) && !stop.left_at;
  const time = timeForRail(stop.time_label);
  const stay = stop.planned_stay_minutes ? stayLabel(stop.planned_stay_minutes) : "";
  const href = mapsPlaceUrl(stop.title, { lat: stop.lat, lon: stop.lon }, stop.address);

  // The Companion's current-stop card, for the one stop in hand: its picture,
  // label, name, chips and address, then the way on.
  return (
    <article aria-live="polite" className="space-y-2">
      <section
        className={`plain-card trip-focus-card now-current p-2.5 ${current ? "ring-2 ring-primary/45" : ""}`}
      >
        <div className="flex items-stretch gap-3">
          <StopArt item={stop} className="h-[112px] w-[88px] rounded-[16px]" />
          <div className="min-w-0 flex-1 py-0.5">
            <p className="now-current-label">
              {current ? "Current stop" : "Stop"} · {at + 1} of {total}
            </p>
            <h3 className="mt-0.5 flex items-start gap-2 break-words font-display text-[22px] leading-[1.1]">
              {current ? <span className="now-live-dot" aria-hidden /> : null}
              <span className="min-w-0">{stop.title}</span>
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StopDisc number={pin.number} className="size-6 text-[12px]" />
              {time ? <span className="now-chip">{time}</span> : null}
              {stay ? (
                <span className="now-chip">
                  <Clock className="size-3.5" aria-hidden />
                  {stay}
                </span>
              ) : null}
            </div>
            {stop.address?.trim() && (
              <p className="mt-1.5 flex items-start gap-1 text-[13px] leading-snug text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="line-clamp-2 min-w-0">{stop.address.trim()}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col justify-center gap-1">
            <button
              type="button"
              onClick={() => onStep(-1)}
              aria-label="Previous stop"
              className="grid size-11 place-items-center rounded-full bg-elevated"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label="Next stop"
              className="grid size-11 place-items-center rounded-full bg-primary-soft"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      <NestLines item={stop} />

      <div className="flex items-center gap-2 px-1">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] text-muted-foreground">
          {leave?.kind === "time" ? (
            <span className="shrink-0 font-bold tabular-nums text-primary">
              Leave by {leave.at}
            </span>
          ) : null}
          {trip && next ? (
            <>
              <LegIcon walking={trip.walking} mode={trip.mode} className="size-4 shrink-0" />
              <span className="truncate">
                {trip.text} to {next.title}
              </span>
            </>
          ) : (
            <span className="truncate">{next ? `Then ${next.title}` : "Last stop of the day"}</span>
          )}
        </span>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 text-[15px] font-semibold text-primary-foreground"
        >
          Navigate
          <ChevronRight className="size-4" aria-hidden />
          <span className="sr-only">: open {stop.title} in maps</span>
        </a>
      </div>
    </article>
  );
}
