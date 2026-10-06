import { Sheet } from "@/components/Sheet";
import { AiPromptButton } from "@/components/AiPromptSheet";
import { PlanAsk, PlanCards, PlanExamples, PlanHero } from "@/components/PlanWithBea";
import { BeaRunning } from "@/components/BeaRunning";
import { SearchGroundingNote } from "@/components/SearchGroundingNote";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  FileText,
  Link2,
  MapPin,
  Pencil,
  Search,
  Sparkles,
  Upload,
  X,
} from "@/components/icons";
import {
  CharCount,
  PLAN_FIELD,
  PlanAction,
  PlanPanel,
  PlanTitle,
  PriorityPicker,
} from "@/components/PlanForm";
import {
  budgetFor,
  comparePriorities,
  paceFor,
  withPriorities,
  type PlanPriorityId,
} from "@/lib/plan-priorities";
import { tripDateLine } from "@/lib/trip-card";
import { planAsText } from "@/lib/plan-text";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  compareItineraries,
  optimizeItinerary,
  OPTIMIZE_GOALS,
  OPTIMIZE_MAX_ITEMS,
  parseItinerary,
  reviseItinerary,
  type ItineraryComparison,
  type OptimizeGoalId,
  type OptimizeItinerary,
  type OptimizeSourceCity,
  type OptimizeSourceItem,
  type OptimizeTravel,
  type ParsedItineraryItem,
} from "@/lib/itinerary.functions";
import { deltaLine, optimizeDelta } from "@/lib/day-ease";
import { aiFailure } from "@/lib/ai-errors";
import { repeatsTimelineStop } from "@/lib/captured-place";
import { useUndo } from "@/hooks/useUndo";
import { addedLine } from "@/lib/undo";
import { downscaleImage } from "@/lib/image";
import { pdfProblem, pdfProblemMessage } from "@/lib/itinerary-pdf";
import { IcsReadError, icsToParsedItinerary, looksLikeIcs } from "@/lib/itinerary-ics";
import { pastedLink } from "@/lib/itinerary-link";
import { looksLikeStreetAddress, placeHintFromDetail } from "@/lib/direction-stops";
import { airportMatch, estimatedSeconds, labelAddress } from "@/lib/geocode-plan";
import { outsideAddressDistrict } from "@/lib/japan-address";
import { minutesLabel } from "@/lib/route-optimize";
import { pastedPlanNote, readPlanShape } from "@/lib/pasted-plan";
import {
  daysBetween,
  movedTripRange,
  planOutsideTrip,
  planRange,
  shiftPlanDates,
} from "@/lib/plan-dates";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { scoreMatch, tallyConfidence, type Confidence } from "@/lib/match-confidence";
import { pinCheckNote } from "@/lib/pin-check";
import { dayShapeLine } from "@/lib/day-shape";
import {
  hasRelativeDays,
  lastDayDate,
  relativeDayCount,
  resolveDayDates,
} from "@/lib/relative-days";
import {
  geocodePlanStops,
  PLAN_LOOKUP_GAP_MS,
  type PlacedStop,
} from "@/lib/geocode-plan.functions";
import {
  parentIndex,
  pinIsSaved,
  placeBatches,
  routeCityOn,
  afterJourney,
  afterRide,
  routeCountry,
  stayMinutesFrom,
  type PinChoice,
} from "@/lib/import-stop";
import { stayLabel } from "@/lib/planned-stay";
import { splitInsideNote, type InsideEntry } from "@/lib/inside-list";
import { stripEmbeddedMapsUrl } from "@/lib/timeline-directions";
import { tripStillEditableNote } from "@/lib/trip-copy";
import { beaLine } from "@/lib/bea-voice";
import { planScope, scopedRoute, type TripCity } from "@/lib/trip-cities";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { beaCheer } from "@/hooks/useBeaSettings";
import { routeStopLine } from "@/lib/trip-cities";
import { newTowns, planTowns, withCountry, type PlanCity } from "@/lib/plan-cities";
import { countryNamedIn } from "@/lib/world-countries";
import { lookupCoords } from "@/lib/places.functions";
import type { TravelChoice } from "@/lib/travel-mode";

type NewItineraryItem = {
  day_date?: string;
  time_label?: string;
  kind: string;
  title: string;
  detail?: string;
  address?: string;
  lat?: number;
  lon?: number;
  planned_stay_minutes?: number;
  booked?: boolean;
  /** What to see inside this stop, with no time of its own. */
  inside?: InsideEntry[];
  /** The stop in this same save that this one is inside, by position. */
  parent_index?: number;
};

/** Stops placed per server call: a long plan in one call ran out of time and came back bare. */
const PLACE_BATCH = 8;
/** How long to let the map's minute limit clear before one more try. */
const THROTTLE_PAUSE_MS = 20_000;
/** Whether "Add directions between stops" was last left ticked, on this phone. */
const DIRECTIONS_BOX_KEY = "bea:import-directions";
/** Optimize's "What would you like to improve?", as the server takes it. */
const OPTIMIZE_NOTE_MAX = 500;
/** Optimize's "Add your own" priorities; with the note, within the server's 700. */
const OPTIMIZE_OWN_MAX = 180;
/** How much Build's box and Import's plan box take. */
const BUILD_TEXT_MAX = 2000;
const IMPORT_TEXT_MAX = 20000;
/** The tiles each form offers, in the order the mockups draw them. */
const BUILD_PRIORITIES: PlanPriorityId[] = [
  "closest",
  "hours",
  "rainy",
  "easy-morning",
  "rest",
  "even",
  "food",
  "budget",
];
const COMPARE_PRIORITIES: PlanPriorityId[] = [
  "closest",
  "hours",
  "rainy",
  "easy-morning",
  "rest",
  "even",
  "food",
  "budget",
  "unique",
];

type NewCostItem = { label: string; category: string; amount: number; currency: string };

type PanelTab = "start" | "import" | "optimize" | "compare";

export type OptimizePreset = {
  goals: OptimizeGoalId[];
  note: string;
  label: string;
  /** The day to rearrange; the rest of the trip is left alone. */
  day: string;
  /** Words for the day: "tomorrow", "today", "Tue, Oct 6". */
  dayLabel: string;
  n: number;
};
/** Where the planner opens: its start screen, a panel, or Build / Import straight away. */
export type PlannerTab = PanelTab | "build";

/**
 * Each panel says when Béa is working, so the sheet cannot be swiped or
 * tapped away mid-run: closing it unmounts the panel, and the draft with it.
 */
const PlannerBusy = createContext<(busy: boolean) => void>(() => {});

function useReportBusy(busy: boolean) {
  const report = useContext(PlannerBusy);
  useEffect(() => {
    report(busy);
    return () => report(false);
  }, [busy, report]);
}

export function ItineraryImport({
  open,
  onClose,
  tripCity,
  tripTitle,
  startDate,
  endDate,
  defaultTab = "start",
  initialAsk = "",
  existingItems = [],
  cities = [],
  planCities = [],
  defaultPlanCity = "",
  onAddItems,
  onRemoveItems,
  onAddCosts,
  onApplyDates,
  onAddCities,
  onAddDirections,
  onApplySchedule,
  optimizePreset,
  tripPreferences = [],
  travel,
}: {
  open: boolean;
  onClose: () => void;
  tripCity?: string | undefined;
  /** The trip's name, only for the country it may name ("JAPAN TEST"). */
  tripTitle?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  defaultTab?: PlannerTab;
  /** Words to start Build with, typed before the planner opened. */
  initialAsk?: string | undefined;
  existingItems?: OptimizeSourceItem[];
  cities?: OptimizeSourceCity[];
  /** The trip's cities, when it has several: a plan can be read for one of them. */
  planCities?: TripCity[];
  /** The city picked on the trip page, so the planner opens on it. */
  defaultPlanCity?: string;
  /** Returns the inserted row ids, so a bulk save can be undone. */
  onAddItems: (items: NewItineraryItem[]) => Promise<string[] | void>;
  /** Takes a batch back out again, for that undo. */
  onRemoveItems?: ((ids: string[]) => Promise<void>) | undefined;
  onAddCosts?: ((items: NewCostItem[]) => Promise<void>) | undefined;
  onApplyDates?: ((dates: { start_date: string; end_date: string }) => Promise<void>) | undefined;
  /** Towns the plan goes through that the trip's route does not have yet. */
  onAddCities?:
    | ((
        cities: PlanCity[],
        plan: { towns: PlanCity[]; country: string | null | undefined },
      ) => Promise<void>)
    | undefined;
  /** Directions between the saved stops, added to the timeline, when the box is ticked. */
  onAddDirections?: ((ids: string[]) => void) | undefined;
  onApplySchedule?: (
    updates: Array<{
      id: string;
      day_date: string | null;
      time_label: string | null;
      position: number;
    }>,
  ) => Promise<void>;
  /**
   * A one-tap request ("Less walking" for tomorrow): Optimize opens with its
   * goal and note, on that one day, and runs at once. `n` changes each tap.
   */
  optimizePreset?: OptimizePreset | null | undefined;
  /** "Just for this trip", sent with every plan asked for here. */
  tripPreferences?: string[];
  /** How the traveller gets around, from the directions sheet; shapes the plan. */
  travel?: TravelChoice | undefined;
}) {
  const [tab, setTab] = useState<PanelTab>(defaultTab === "build" ? "import" : defaultTab);
  const [panelBusy, setPanelBusy] = useState(false);
  /** The city this plan is for, by id; "" for the whole trip. */
  const [planCityId, setPlanCityId] = useState(defaultPlanCity);
  /** How the Plan panel opens from the start screen: which job, and any words already typed. */
  const [start, setStart] = useState<{ mode: "build" | "import"; text: string; n: number }>({
    mode: "build",
    text: "",
    n: 0,
  });

  const openPlan = (mode: "build" | "import", text = "") => {
    setStart((cur) => ({ mode, text, n: cur.n + 1 }));
    setTab("import");
  };

  useEffect(() => {
    if (!open) return;
    setPlanCityId(defaultPlanCity);
    if (defaultTab === "build" || (defaultTab === "import" && initialAsk)) {
      openPlan(defaultTab === "build" ? "build" : "import", initialAsk);
    } else if (defaultTab === "import") {
      openPlan("import");
    } else {
      setTab(defaultTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on opening only
  }, [open, defaultTab]);

  const planCity =
    planCities.length > 1 ? (planCities.find((c) => c.id === planCityId) ?? null) : null;
  // A plan for one city is read there and lands on its days. It never moves
  // the whole trip's dates: one city's plan is not the trip's.
  const scope = planScope({ city: tripCity, startDate, endDate }, planCity);
  // Its stops are looked up in that city whatever dates the plan names, so
  // the route it is given is that city alone.
  const planRoute = planCity ? scopedRoute(cities, planCity) : cities;

  const cityPicker =
    planCities.length > 1 ? (
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">Which city is this plan for?</legend>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
          {[{ id: "", city: "Whole trip" }, ...planCities].map((c) => {
            const on = (planCity?.id ?? "") === c.id;
            return (
              <button
                key={c.id || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setPlanCityId(c.id ?? "")}
                className={`shrink-0 whitespace-nowrap min-h-11 rounded-full border px-3.5 py-1.5 text-[13px] ${
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                {c.city}
              </button>
            );
          })}
        </div>
        {planCity && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            Béa looks the places up in {planCity.city}
            {scope.startDate ? " and puts the plan on its days" : ""}.
          </p>
        )}
      </fieldset>
    ) : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Ask Béa"
      hint={
        tab === "start"
          ? [tripTitle, "make the trip better"].filter(Boolean).join(" · ")
          : (tripTitle ?? undefined)
      }
      page
      tone={5}
      onBack={tab === "start" || panelBusy ? undefined : () => setTab("start")}
      width="lg"
      tall
      dismissible={!panelBusy}
    >
      <PlannerBusy.Provider value={setPanelBusy}>
        {tab === "start" ? (
          <div className="space-y-5">
            <PlanHero compact />
            <PlanCards
              optimizeNote={existingItems.length >= 2 ? "" : "Add two stops first"}
              onBuild={() => openPlan("build")}
              onImport={() => openPlan("import")}
              onOptimize={() => setTab("optimize")}
              onCompare={() => setTab("compare")}
            />
            <AiPromptButton />
            <PlanExamples onPick={(ask) => openPlan("build", ask)} />
            <PlanAsk onSend={(ask) => openPlan("build", ask)} />
          </div>
        ) : null}

        {tab === "import" && (
          <ImportPanel
            // A new city is a new plan: nothing read or placed for the last one is kept.
            key={`${start.n}:${planCity?.id ?? ""}`}
            initialMode={start.mode}
            initialText={start.text}
            existingItems={existingItems}
            cities={planRoute}
            tripCity={scope.city}
            tripTitle={tripTitle}
            startDate={scope.startDate}
            endDate={scope.endDate}
            scopedTo={planCity?.city}
            cityPicker={cityPicker}
            onAddItems={onAddItems}
            {...(onRemoveItems ? { onRemoveItems } : {})}
            onAddCosts={onAddCosts}
            tripPreferences={tripPreferences}
            travel={travel}
            onApplyDates={planCity ? undefined : onApplyDates}
            onAddCities={planCity ? undefined : onAddCities}
            {...(onAddDirections ? { onAddDirections } : {})}
          />
        )}
        {tab === "optimize" && optimizePreset && (
          <OptimizePanel
            key={`preset:${optimizePreset.n}`}
            preset={optimizePreset}
            tripPreferences={tripPreferences}
            travel={travel}
            tripCity={tripCity}
            startDate={optimizePreset.day}
            endDate={optimizePreset.day}
            items={existingItems.filter((item) => item.day_date === optimizePreset.day)}
            cities={cities}
            onApplySchedule={onApplySchedule}
          />
        )}
        {tab === "optimize" && !optimizePreset && (
          <OptimizePanel
            tripPreferences={tripPreferences}
            travel={travel}
            tripCity={tripCity}
            startDate={startDate}
            endDate={endDate}
            items={existingItems}
            cities={cities}
            onApplySchedule={onApplySchedule}
            onImport={() => openPlan("import")}
            onBuild={() => openPlan("build")}
          />
        )}
        {tab === "compare" && <ComparePanel />}
      </PlannerBusy.Provider>
    </Sheet>
  );
}

function ImportPanel({
  tripPreferences = [],
  travel,
  initialMode = "build",
  initialText = "",
  existingItems,
  cities,
  tripCity,
  tripTitle,
  startDate,
  endDate,
  onAddItems,
  onRemoveItems,
  onAddCosts,
  onApplyDates,
  scopedTo,
  cityPicker,
  onAddCities,
  onAddDirections,
}: {
  /** "Just for this trip", sent with every plan asked for here. */
  tripPreferences?: string[];
  /** How the traveller gets around, from the directions sheet; shapes the plan. */
  travel?: TravelChoice | undefined;
  /** "Which city is this plan for?", for a trip with several. */
  cityPicker?: ReactNode;
  /** Which job the panel opens on, chosen on the start screen. */
  initialMode?: "build" | "import";
  /** Words typed on the start screen, carried into the box. */
  initialText?: string;
  existingItems: OptimizeSourceItem[];
  /** The trip's route, so each day's stops are looked up in that day's city. */
  cities: OptimizeSourceCity[];
  tripCity?: string | undefined;
  /** Set when the plan is for one city: its dates stand in for the trip's. */
  scopedTo?: string | undefined;
  tripTitle?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  /** Returns the inserted row ids, so a bulk save can be undone. */
  onAddItems: (items: NewItineraryItem[]) => Promise<string[] | void>;
  /** Takes a batch back out again, for that undo. */
  onRemoveItems?: ((ids: string[]) => Promise<void>) | undefined;
  onAddCosts?: ((items: NewCostItem[]) => Promise<void>) | undefined;
  onApplyDates?: ((dates: { start_date: string; end_date: string }) => Promise<void>) | undefined;
  /** Towns the plan goes through that the trip's route does not have yet. */
  onAddCities?:
    | ((
        cities: PlanCity[],
        plan: { towns: PlanCity[]; country: string | null | undefined },
      ) => Promise<void>)
    | undefined;
  onAddDirections?: ((ids: string[]) => void) | undefined;
}) {
  const run = useServerFn(parseItinerary);
  /** "Add directions between stops": remembered on this phone, off at first. */
  const [withDirections, setWithDirections] = useState(false);
  useEffect(() => {
    try {
      setWithDirections(window.localStorage.getItem(DIRECTIONS_BOX_KEY) === "1");
    } catch {
      // Blocked storage: the box starts unticked.
    }
  }, []);
  const tickDirections = (on: boolean) => {
    setWithDirections(on);
    try {
      window.localStorage.setItem(DIRECTIONS_BOX_KEY, on ? "1" : "0");
    } catch {
      // Not remembering the box is fine.
    }
  };
  const revise = useServerFn(reviseItinerary);
  const lookup = useServerFn(lookupCoords);
  /** "Tokyo, Japan (2026-09-30 – 2026-10-03); Kyoto, Japan (…)", for the parse to name each stop's city. */
  const named = cities.filter((c) => c.city.trim());
  const routeLine = named
    .map((_, i) => routeStopLine(named, i))
    .join("; ")
    .slice(0, 600);
  /**
   * Where to, asked when the trip names no place.
   *
   * A trip can be made without a city ("China, sometime in spring" titled
   * only by its name), and Build used to send nothing about the place at all —
   * so Béa picked one, and a trip called China came back planned in Brazil.
   * Now Build waits until it knows where.
   */
  const [whereTo, setWhereTo] = useState("");
  const needsPlace = !tripCity?.trim() && !routeLine;
  /** The trip as Build's card shows it: "Paris, France" and "Apr 12 – 18, 2026". */
  const tripPlace = scopedTo || tripCity?.trim() || named.map((c) => c.city).join(" · ");
  const tripDates = tripDateLine(startDate, endDate);
  /** A trip that already has stops is built on, not built. */
  const addingMore = existingItems.length > 0;
  /** The place sent with a request: the answer above counts only for Build. */
  const placeFor = (forMode: "build" | "import") =>
    tripCity?.trim() || (forMode === "build" ? whereTo.trim() : "");
  /**
   * The place the draft on screen was made for. Revisions and pins follow the
   * draft, not the box, which can be edited after it (or hidden by Import).
   */
  const [draftPlace, setDraftPlace] = useState("");
  const { addedWithUndo } = useUndo();

  /** Indexes of the parsed rows the timeline does not already have. */
  const freshIndexes = (rows: ParsedItineraryItem[], start: string | null | undefined) =>
    (start ? resolveDayDates(rows, start) : rows)
      .map((row, i) => (repeatsTimelineStop(existingItems, row) ? -1 : i))
      .filter((i) => i >= 0);
  const uploadRef = useRef<HTMLInputElement>(null);
  const MAX_IMAGES = 6;
  const [images, setImages] = useState<string[]>([]);
  const addImages = async (files: File[]) => {
    if (files.length === 0) return;
    try {
      const room = MAX_IMAGES - images.length;
      const small = await Promise.all(files.slice(0, room).map((f) => downscaleImage(f)));
      setImages((cur) => [...cur, ...small]);
      setError(files.length > room ? `Béa can read up to ${MAX_IMAGES} pictures at a time.` : null);
    } catch (err) {
      setError(aiFailure(err).message);
    }
  };
  /** One PDF at a time: a confirmation or a tour plan is already the whole trip. */
  const [pdf, setPdf] = useState<{ name: string; dataUrl: string } | null>(null);
  const addPdf = async (file: File) => {
    try {
      const all = new Uint8Array(await file.arrayBuffer());
      // A calendar file is read right here, exactly: no AI, nothing sent.
      const start = new TextDecoder().decode(all.subarray(0, 64));
      if (/\.ics$/i.test(file.name) || file.type === "text/calendar" || looksLikeIcs(start)) {
        try {
          showParsed(icsToParsedItinerary(new TextDecoder().decode(all)));
        } catch (err) {
          setError(
            err instanceof IcsReadError ? err.message : "Béa couldn't read that calendar file.",
          );
        }
        return;
      }
      const problem = pdfProblem({
        size: file.size,
        head: all.subarray(0, 4096),
        tail: all.subarray(Math.max(0, all.length - 4096)),
      });
      if (problem) {
        setError(pdfProblemMessage(problem));
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("Could not read that PDF."));
        reader.readAsDataURL(new Blob([all], { type: "application/pdf" }));
      });
      setPdf({ name: file.name, dataUrl });
      setError(null);
    } catch (err) {
      setError(aiFailure(err).message);
    }
  };
  /**
   * "Upload a file": one picker for pictures, a PDF or a calendar file. The
   * pictures are read together; the first PDF or calendar file is the other.
   */
  const onUploadPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const pictures = files.filter((f) => f.type.startsWith("image/"));
    const docs = files.filter((f) => !f.type.startsWith("image/"));
    // One document at a time, and a calendar on its own: it is read on the
    // spot, which would leave pictures picked with it unread.
    if (docs.length > 1) {
      setError("Choose one PDF or calendar file at a time.");
      return;
    }
    const calendar = docs[0] && (/\.ics$/i.test(docs[0].name) || docs[0].type === "text/calendar");
    if (calendar && pictures.length) {
      setError(
        "A calendar file and pictures are imported as separate plans: upload one, then the other.",
      );
      return;
    }
    if (pictures.length) await addImages(pictures);
    if (docs[0]) await addPdf(docs[0]);
  };
  const hasFiles = images.length > 0 || pdf !== null;
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  useReportBusy(busy);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedItineraryItem[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  /** Set while Béa is out placing the stops; null the rest of the time. */
  const [placing, setPlacing] = useState<{ done: number; total: number } | null>(null);
  const [mode, setMode] = useState<"build" | "import">(initialMode);
  /** Build's "What should Béa prioritize?": pace and budget follow from it, the rest is words. */
  const [priorities, setPriorities] = useState<PlanPriorityId[]>([]);
  /** Priorities the chips don't cover, in the traveller's own words. */
  const [ownPriorities, setOwnPriorities] = useState("");
  const togglePriority = (id: PlanPriorityId) =>
    setPriorities((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));
  const pace = paceFor(priorities);
  const budgetLevel = budgetFor(priorities);
  /** The request as Béa reads it: the typed words, then what matters. */
  const request = mode === "build" ? withPriorities(text, priorities, ownPriorities) : text.trim();
  /** Import's "Import from a link", typed in its own box. */
  const [linkInput, setLinkInput] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [includeCosts, setIncludeCosts] = useState(false);
  const [altReason, setAltReason] = useState("");
  const [rebuildReason, setRebuildReason] = useState("");
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof run>> | null>(null);
  /**
   * The country the plan is in, when something says so: the trip's place,
   * its route, or a country its name or the plan's names ("JAPAN TEST",
   * "Japan Master Itinerary"). A trip with no place is then searched as a
   * country, each stop beside the one before it, instead of not at all.
   */
  const planCountry =
    countryNamedIn(draftPlace.split(",").pop())?.name ||
    routeCountry(cities) ||
    countryNamedIn(tripTitle)?.name ||
    countryNamedIn(plan?.trip_title)?.name ||
    "";
  /**
   * The date a "Day 1 / Day 2" plan begins.
   *
   * Only asked for when nothing else knows: the trip has no start date and
   * the source named none. One field, answered once, instead of a date
   * chosen twenty times on the timeline afterwards.
   */
  const [dayOneDate, setDayOneDate] = useState("");
  /**
   * The plan names dates outside the trip's: which one is right. Asked, not
   * assumed — saving used to move the trip to the plan without a word.
   */
  const [dateChoice, setDateChoice] = useState<"move-trip" | "keep-trip" | null>(null);
  /**
   * Where each parsed row landed, worked out before saving rather than during.
   *
   * Placing used to happen inside the save, so the first anyone saw of a
   * wrong pin was on the trip afterwards — and a match Béa was unsure about
   * looked exactly like one she was certain of. Doing it at review time is
   * what lets the list say which ones to look at, while there is still a
   * cheap moment to fix them.
   */
  const [placements, setPlacements] = useState<
    Record<
      number,
      { lat: number; lon: number; label?: string; confidence: Confidence; reason: string }
    >
  >({});
  /** Bumped by every placing run and every new plan; only the newest run writes. */
  const placeGen = useRef(0);
  /** A new plan, parsed or revised: always placed afresh. */
  const [planVersion, setPlanVersion] = useState(0);
  /** Pins the person kept or removed at review, by row. */
  const [pinChoices, setPinChoices] = useState<Record<number, PinChoice>>({});
  const savedPin = (i: number) => {
    const found = placements[i];
    return found && pinIsSaved(found.confidence, pinChoices[i]) ? found : undefined;
  };

  /** Put a plan up for review, however it was read. */
  const showParsed = (out: Awaited<ReturnType<typeof run>>) => {
    setError(null);
    setSaved(false);
    setSaveStatus("");
    setSummary(out.summary);
    setItems(out.items);
    setPlan(out);
    setPicked(freshIndexes(out.items, startDate || out.start_date || dayOneDate));
    setAltReason("");
    setRebuildReason("");
    setPlacements({});
    setPinChoices({});
    setDateChoice(null);
    // Placing starts from the effect below, on the rows as they will be
    // saved; a run for the plan before this one stops where it is.
    placeGen.current += 1;
    setPlacing(null);
    setPlanVersion((v) => v + 1);
    if (out.items.length > 0) {
      const ready = beaLine("plan.ready");
      toast.success(ready.title, { description: beaCheer("itinerary") ?? ready.body });
    }
  };

  const read = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    setSaveStatus("");
    setItems(null);
    setPlan(null);
    const sentPlace = placeFor(mode);
    try {
      const out = await run({
        data: {
          imageDataUrls: mode === "import" && images.length ? images : null,
          pdfDataUrl: mode === "import" && pdf ? pdf.dataUrl : null,
          pageUrl: mode === "import" && link ? link : null,
          // A link pasted alone in the plan box is the link; typed in its own
          // box, whatever is in the plan box goes with it as notes.
          text: (mode === "import" && link && !typedLink ? "" : request) || null,
          tripCity: sentPlace || null,
          route: routeLine || null,
          startDate: startDate || null,
          endDate: endDate || null,
          mode,
          pace,
          budgetLevel,
          currency,
          includeCosts,
          tripPreferences,
          ...(travel ? { travel } : {}),
        },
      });
      setDraftPlace(sentPlace);
      showParsed(out);
    } catch (e) {
      setError(aiFailure(e).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Find every parsed row on the map, before anything is saved.
   *
   * The same lookups the save used to do, moved earlier so their result can
   * be shown and argued with. Failure stays survivable: a row that cannot be
   * placed is saved exactly as before, without a point.
   */
  const placeParsed = async (dated: ParsedItineraryItem[]) => {
    // Only the newest run writes: a revision renumbers the rows, and pins
    // from the plan before it would land on whichever stop now has the number.
    const gen = ++placeGen.current;
    const current = () => gen === placeGen.current;
    setPlacements({});
    // A trip filed under one city, or none, can still be placed day by day
    // from its route: Oct 7 is looked up in Hiroshima, not in Tokyo or in
    // the whole of Japan.
    // A trip with no place and no route still says its country in its name
    // ("JAPAN TEST") or the plan's ("Japan Master Itinerary"): searched as a
    // country, each stop is looked for beside the one before it.
    const area = draftPlace || routeCountry(cities) || planCountry || "";
    // A monument inside a park is looked up beside the park's pin.
    const parents = dated.map((_, i) => parentIndex(dated, i));
    const stops = dated.map((item, i) => {
      const dayArea = routeCityOn(cities, item.day_date);
      return {
        title: item.title,
        detail: item.detail ?? null,
        place: item.place ?? null,
        address: item.address ?? null,
        city: item.city ?? null,
        ...(dayArea ? { area: dayArea } : {}),
        // A train or flight before it: not beside the stop before it.
        ...(afterJourney(item, dated[i - 1]) ? { fresh: true } : {}),
        ...(afterRide(dated[i - 1]) ? { rode: true } : {}),
      };
    });
    const placeable = stops.some((stop) => stop.city?.trim() || stop.area);
    if ((!area && !placeable) || dated.length === 0) {
      setPlacing(null);
      return;
    }
    const total = dated.length;
    setPlacing({ done: 0, total });
    try {
      // A few stops per call. One call for a whole plan ran past the
      // lookup budget and the request's time, and a long plan came back
      // with no pins at all — the save then went out empty-handed.
      // A batch that fails keeps the pins found before it.
      const placed: PlacedStop[] = [];
      // The provider's pace carries from one batch to the next.
      let recent: number[] = [];
      // Where the last batch left off, so the next stop is looked for beside it.
      let near: { lat: number; lon: number } | null = null;
      for (const [from, to] of placeBatches(parents, PLACE_BATCH)) {
        if (!current()) return;
        const batch = stops.slice(from, to).map((stop, k) => {
          const parent = parents[from + k]!;
          return parent >= from ? { ...stop, within: parent - from } : stop;
        });
        const ask = () =>
          geocodePlanStops({
            data: { stops: batch, area, recent, venues: true, inOrder: true, near },
          }).catch(() => null);
        let result: Awaited<ReturnType<typeof geocodePlanStops>> | null = await ask();
        if (!current()) return;
        // The map's minute limit is shared by everyone using Béa. Asked too
        // fast, it says wait; the rest of the plan used to be left unplaced.
        // One pause and one more try, keeping what the first try found.
        if (result?.throttled) {
          placed.push(...result.placed.map((hit) => ({ ...hit, index: hit.index + from })));
          recent = result.sent ?? [];
          await new Promise((r) => setTimeout(r, THROTTLE_PAUSE_MS));
          if (!current()) return;
          const again: Awaited<ReturnType<typeof geocodePlanStops>> | null = await ask();
          if (!current()) return;
          if (again) {
            const have = new Set(placed.map((hit) => hit.index));
            again.placed = again.placed.filter((hit) => !have.has(hit.index + from));
          }
          result = again;
        }
        if (!result) break;
        recent = result.sent ?? [];
        near = result.lastPin ?? null;
        placed.push(...result.placed.map((hit) => ({ ...hit, index: hit.index + from })));
        setPlacing({ done: to, total });
        if (result.throttled) break;
      }
      const found: Record<
        number,
        { lat: number; lon: number; label?: string; confidence: Confidence; reason: string }
      > = {};
      for (const hit of placed) {
        const row = dated[hit.index];
        if (!row) continue;
        // Scored against the stop's venue as well as its title: "Arrive
        // Hiroshima Station" is about the station, and the lookup was made by
        // the venue name when the plan gave one.
        // Also by the name it was found under ("Ikuta Shrine", "渡月橋").
        const scored = [row.title, row.place, row.address, hit.matchedAs]
          .filter((name): name is string => Boolean(name && name.trim()))
          .map((title) =>
            scoreMatch({
              title,
              label: hit.label ?? null,
              category: hit.category ?? null,
              kind: hit.kind ?? null,
              alsoNamed: hit.alsoNamed ?? null,
            }),
          );
        const rank = { high: 2, medium: 1, low: 0 } as const;
        // Pinned at the stop it is inside: its name will not match that
        // place's, and should not make it look like a wrong guess.
        // Right name, wrong village: a namesake well outside the town is
        // shown for checking and not pinned unless the person keeps it.
        const { confidence, reason } = hit.inside
          ? { confidence: "medium" as const, reason: `Pinned at ${hit.inside}, where it is` }
          : hit.remembered === "traveller"
            ? { confidence: "high" as const, reason: "Where travellers who went there put it" }
            : airportMatch(row, hit)
              ? { confidence: "high" as const, reason: "An airport, as the plan says" }
              : outsideAddressDistrict(row.address, hit.label)
                ? {
                    confidence: "low" as const,
                    reason: `Not in ${outsideAddressDistrict(row.address, hit.label)}, where the plan's address is — maybe a namesake.`,
                  }
                : hit.farKm
                  ? {
                      confidence: "low" as const,
                      reason: `This is ${hit.farKm} km from the middle of town — maybe a namesake.`,
                    }
                  : scored.reduce((best, next) =>
                      rank[next.confidence] > rank[best.confidence] ? next : best,
                    );
        found[hit.index] = {
          lat: hit.lat,
          lon: hit.lon,
          ...(hit.label ? { label: hit.label } : {}),
          confidence,
          reason,
        };
      }
      if (current()) setPlacements(found);
    } catch {
      // No pins is where this started; it is not a reason to lose the plan.
    } finally {
      if (current()) setPlacing(null);
    }
  };

  const planStartFor = startDate || plan?.start_date || dayOneDate || "";
  /**
   * Which parsed rows the timeline already has. Re-reading the same booking
   * email used to silently double the trip; now the repeats are named and
   * left unticked.
   */
  const duplicateIndexes = new Set(
    (items ? (planStartFor ? resolveDayDates(items, planStartFor) : items) : [])
      // Every row here belongs to this one trip, so a repeated name is a
      // repeat rather than a same-named place elsewhere; so is the same place
      // at the same time on the same day, however the title is worded.
      .map((item, index) => (repeatsTimelineStop(existingItems, item) ? index : -1))
      .filter((index) => index >= 0),
  );

  /**
   * Where the numbered days are anchored: the trip's own start date, then the
   * date the source gave, then the one the user just supplied.
   */
  /**
   * What the text in the box actually looks like.
   *
   * Checked continuously rather than on submit, because the point is to catch
   * the mistake before the button is pressed, not to explain it afterwards.
   */
  const pastedShape = readPlanShape(text);
  /** A link pasted on its own is opened and read, not treated as the plan's text. */
  const typedLink = mode === "import" && linkInput.trim() ? pastedLink(linkInput) : null;
  const badLink = mode === "import" && Boolean(linkInput.trim()) && !typedLink;
  const link = typedLink ?? pastedLink(text);
  const wrongMode = mode === "build" && (pastedShape.existing || Boolean(link));

  const planStart = startDate || plan?.start_date || dayOneDate || "";
  const needsDayOne = Boolean(items && hasRelativeDays(items) && !startDate && !plan?.start_date);
  const relativeDays = items ? relativeDayCount(items) : 0;
  /** "6 meals · 5 sights · 3 walks", using the kinds the parse returned. */
  const foundShape = items ? dayShapeLine(items) : "";
  const placedTally = tallyConfidence(Object.values(placements).map((p) => p.confidence));
  // Day 1 becomes a real date here, so everything downstream — the day
  // groups, Today, the calendar — sees an ordinary dated plan.
  const dated = items ? (planStart ? resolveDayDates(items, planStart) : items) : null;
  const datedRange = dated ? planRange(dated) : null;
  const datesDisagree = planOutsideTrip(datedRange, startDate, endDate);
  const tripRange = startDate ? { start: startDate, end: endDate || startDate } : null;
  const movedTrip =
    datesDisagree && datedRange && tripRange ? movedTripRange(tripRange, datedRange) : null;
  const dayLabel = (iso: string) => formatTimelineDayLabel(iso);
  const rangeLabel = (range: { start: string; end: string }) =>
    range.start === range.end
      ? dayLabel(range.start)
      : `${dayLabel(range.start)} – ${dayLabel(range.end)}`;

  // The rows as they will be saved. "Keep the trip's dates": the whole plan
  // slides onto the trip's first day, each row by the same number of days.
  const savedRows = items
    ? datesDisagree && dateChoice === "keep-trip" && datedRange && startDate
      ? shiftPlanDates(dated ?? items, daysBetween(datedRange.start, startDate))
      : (dated ?? items)
    : null;
  /**
   * Stops are placed on the rows as saved, in the city each one's day is in.
   * A Day 1 date given later, or keeping the trip's dates, can move a row
   * to another city on the route, so placing runs again when — and only
   * when — that changes; a new plan always runs it.
   */
  const placeKey =
    savedRows && savedRows.length > 0
      ? `${planVersion}|${savedRows.map((row) => routeCityOn(cities, row.day_date) ?? "").join("|")}`
      : "";
  useEffect(() => {
    if (!placeKey || !savedRows) return;
    void placeParsed(savedRows);
    // placeKey stands for savedRows: it changes exactly when placing would.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey]);

  const addChosen = async () => {
    if (!items) return;
    setBusy(true);
    setError(null);
    try {
      const rows = savedRows ?? items;
      // In plan order: ticking a row back on used to append it, so it was
      // saved at the end of the day; and a stop's parent must be found by
      // position in this same list.
      const order = [...picked].sort((a, b) => a - b);
      const chosen = order.flatMap((i) => {
        const it = rows[i];
        if (!it) return [];
        // "Inside: …" the import wrote into the note becomes its own list.
        const { detail: note, inside } = splitInsideNote(it.detail);
        // Inside another stop that is being saved too: linked to it.
        const parent = order.indexOf(parentIndex(rows, i));
        // The address the source gave, pulled out by the parse; the detail
        // line's first clause only when it gave none.
        // Already found, at review time, and already shown to the person
        // saving it — and only if it was trusted or kept. No second round of
        // lookups on the way out.
        const found = savedPin(i);
        // With no address of its own, where it was found: a pinned stop
        // that says "No place yet" hides a wrong pin as well as a right one.
        // A note is never the address: "Kiyomizu-zaka — historic shopping
        // street" was saved with "historic shopping street" as where it is.
        const hint = placeHintFromDetail(it.detail);
        const address =
          it.address?.trim() ||
          (hint && looksLikeStreetAddress(hint) ? hint : null) ||
          labelAddress(found?.label);
        const stay = stayMinutesFrom(it);
        // What the review said about this pin, kept on the stop for "Pins to
        // check". A pin the traveller removed themselves is their call.
        const pinCheck =
          pinChoices[i] === "drop" ? null : pinCheckNote(placements[i], Boolean(found));
        return [
          {
            ...(found ? { lat: found.lat, lon: found.lon } : {}),
            ...(pinCheck ? { pin_check: pinCheck } : {}),
            ...(it.day_date ? { day_date: it.day_date } : {}),
            ...(it.time_label ? { time_label: it.time_label } : {}),
            kind: it.kind,
            title: it.title,
            ...(address ? { address } : {}),
            ...(stay ? { planned_stay_minutes: stay } : {}),
            ...(it.booked === true ? { booked: true } : {}),
            ...(inside.length ? { inside } : {}),
            ...(parent >= 0 ? { parent_index: parent } : {}),
            ...(note || (includeCosts && it.estimated_cost != null)
              ? {
                  detail: [
                    note,
                    includeCosts && it.estimated_cost != null
                      ? `Est. ${it.estimated_cost} ${it.currency ?? plan?.currency ?? currency}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }
              : {}),
          },
        ];
      });
      /**
       * The stops already carry their points.
       *
       * This used to be where the geocoding happened — after the person had
       * committed, so a wrong pin was something you discovered on the trip
       * page afterwards. It now runs at review time instead, which is both
       * earlier and cheaper: the save is a save again.
       */
      const located = chosen;
      const unplaced = picked.filter((i) => !savedPin(i)).length;
      if (unplaced > 0 && Object.keys(placements).length > 0) {
        toast.message(`${unplaced} of these are not on the map`, {
          description: "They are saved either way — open the trip to give them a place.",
        });
      }

      setSaveStatus(`Saving ${located.length} timeline stops…`);
      const insertedIds = await onAddItems(located);
      if (includeCosts && onAddCosts && plan?.costs.length) {
        setSaveStatus("Saving the budget…");
        await onAddCosts(plan.costs);
      }
      if (onApplyDates && movedTrip && dateChoice === "move-trip") {
        setSaveStatus("Moving the trip…");
        await onApplyDates({ start_date: movedTrip.start, end_date: movedTrip.end });
      } else if (onApplyDates && !startDate && plan?.start_date && plan.end_date) {
        // A trip with no dates takes the plan's. A dated trip is only ever
        // moved by the choice above: a one-day import used to overwrite a
        // whole trip's dates here without asking.
        setSaveStatus("Updating the trip dates…");
        await onApplyDates({ start_date: plan.start_date, end_date: plan.end_date });
      } else if (onApplyDates && dayOneDate && !startDate) {
        // The user just told Béa when day one is, so the trip should know it
        // too — otherwise the timeline has dates the trip itself does not.
        const last = lastDayDate(rows) ?? dayOneDate;
        setSaveStatus("Updating the trip dates…");
        await onApplyDates({ start_date: dayOneDate, end_date: last });
      }
      // A plan through several towns puts them on the trip's route, so the
      // days, the map and the directions look in the right one.
      // A day whose stops name no town is looked up from one of its pins.
      if (onAddCities) setSaveStatus("Adding the towns to the trip…");
      // Every town the plan reaches, in order: the first is the trip's
      // starting city even when the route already has it.
      const planTownList = onAddCities
        ? await planTowns(
            order.flatMap((i) => {
              const row = rows[i];
              if (!row) return [];
              const pin = savedPin(i);
              // "Hiroshima" from the plan's own words is "Hiroshima, Japan".
              const placed = withCountry(row, planCountry);
              return [pin ? { ...placed, lat: pin.lat, lon: pin.lon } : placed];
            }),
            [],
            (at) => lookup({ data: at }),
          ).catch(() => [] as PlanCity[])
        : [];
      const newCities = newTowns(planTownList, cities);
      if (onAddCities && planTownList.length > 0) {
        try {
          await onAddCities(newCities, { towns: planTownList, country: planCountry });
          if (newCities.length > 0) {
            toast.success(
              `Added ${newCities.map((c) => c.city).join(", ")} to the trip's destinations`,
            );
          }
        } catch {
          toast.error("The stops are saved, but the towns could not be added to Destinations.");
        }
      }
      // Routed once the new stops are on the trip, by the trip page, the
      // same way the directions sheet does it.
      if (
        withDirections &&
        onAddDirections &&
        Array.isArray(insertedIds) &&
        insertedIds.length > 1
      ) {
        onAddDirections(insertedIds);
      }
      setItems(null);
      setText("");
      setSaved(true);
      setSaveStatus("");
      const done = beaLine("plan.complete");
      // A fourteen-stop save used to take fourteen taps to unpick.
      if (Array.isArray(insertedIds) && insertedIds.length > 0 && onRemoveItems) {
        addedWithUndo({
          message: `${done.title} ${addedLine("stop", insertedIds.length)}`,
          label: "stop",
          count: insertedIds.length,
          undo: () => onRemoveItems(insertedIds),
        });
      } else {
        toast.success(done.title, { description: beaCheer("route") ?? done.body });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save those. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const applyRevision = (out: Awaited<ReturnType<typeof revise>>) => {
    setSummary(out.summary);
    setItems(out.items);
    setPlan(out);
    setPicked(freshIndexes(out.items, startDate || out.start_date || dayOneDate));
    // Pins are kept by row number, and a revision renumbers the rows: the
    // old ones would land on whichever stop now sits in that place.
    setPlacements({});
    setPinChoices({});
    placeGen.current += 1;
    setPlacing(null);
    setPlanVersion((v) => v + 1);
  };

  const findAlternatives = async () => {
    if (!items || picked.length === 0 || altReason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const out = await revise({
        data: {
          tripCity: draftPlace || null,
          startDate: startDate || null,
          endDate: endDate || null,
          pace,
          budgetLevel,
          currency,
          includeCosts,
          originalRequest: request || null,
          items,
          selectedIndexes: picked,
          reason: altReason.trim(),
          mode: "alternatives",
          tripPreferences,
          ...(travel ? { travel } : {}),
        },
      });
      applyRevision(out);
    } catch (e) {
      setError(aiFailure(e).message);
    } finally {
      setBusy(false);
    }
  };

  const rebuildTrip = async () => {
    if (!items || rebuildReason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const out = await revise({
        data: {
          tripCity: draftPlace || null,
          startDate: startDate || null,
          endDate: endDate || null,
          pace,
          budgetLevel,
          currency,
          includeCosts,
          originalRequest: request || null,
          items,
          selectedIndexes: [],
          reason: rebuildReason.trim(),
          mode: "rebuild",
          tripPreferences,
          ...(travel ? { travel } : {}),
        },
      });
      applyRevision(out);
    } catch (e) {
      setError(aiFailure(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 space-y-2.5">
      {mode === "build" ? (
        <PlanTitle title={addingMore ? "Build more for this trip" : "Build me a trip"}>
          {tripPlace && !needsPlace
            ? `${tripPlace}${tripDates ? ` · ${tripDates}` : ""}. ${
                addingMore
                  ? "Tell Béa what to add; she'll find options that fit."
                  : "Béa drafts the days around your preferences."
              }`
            : "Tell Béa what you'd like; she drafts the days for you."}
        </PlanTitle>
      ) : (
        <PlanTitle title="Import a plan">
          Paste, upload or link your itinerary. Béa finds the places and adds it to your trip.
        </PlanTitle>
      )}
      {mode === "import" && <AiPromptButton variant="banner" label="Get the AI prompt" />}
      {cityPicker}

      {mode === "build" &&
        (needsPlace ? (
          <label className="relative block">
            <span className="sr-only">Where are you going?</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={whereTo}
              onChange={(e) => setWhereTo(e.target.value)}
              maxLength={120}
              required
              placeholder="Where to? A city, region or country"
              className={`${PLAN_FIELD} pl-9`}
            />
          </label>
        ) : null)}

      {mode === "build" ? (
        <PlanPanel
          tone="sky"
          icon={FileText}
          title={addingMore ? "What would you like to add?" : "Must include"}
          optional={!addingMore}
          aside={<CharCount value={text} max={BUILD_TEXT_MAX} />}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={BUILD_TEXT_MAX}
            aria-label={addingMore ? "What would you like to add?" : "Must include"}
            placeholder={
              addingMore
                ? "e.g. a cooking class, a day trip, more museums, a café near the hotel…"
                : "e.g. a famous museum, wine tasting, a day trip to the coast…"
            }
            className={`${PLAN_FIELD} resize-none`}
          />
        </PlanPanel>
      ) : (
        <PlanPanel
          tone="rose"
          icon={FileText}
          title="Your plan"
          aside={<CharCount value={text} max={IMPORT_TEXT_MAX} />}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={IMPORT_TEXT_MAX}
            aria-label="Paste your plan"
            placeholder={
              hasFiles
                ? "Add notes about the pictures or PDF, if you like…"
                : "Paste your itinerary here: from ChatGPT, a travel blog, notes or an email…"
            }
            className={`${PLAN_FIELD} resize-none`}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/*,application/pdf,.pdf,text/calendar,.ics"
            multiple
            className="hidden"
            onChange={(e) => void onUploadPicked(e)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              disabled={busy}
              title="PDF, calendar, screenshot or photo"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[13.5px] font-medium disabled:opacity-50"
            >
              <Upload className="size-4" aria-hidden />
              Upload a file
            </button>
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Or a link to a plan</span>
              <Link2
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="url"
                inputMode="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                maxLength={2000}
                placeholder="…or paste a link"
                className={`${PLAN_FIELD} pl-9`}
              />
            </label>
          </div>
          {badLink ? (
            <p className="text-[12px] text-destructive">
              That doesn't look like a link. Paste the whole address, starting with https://
            </p>
          ) : link ? (
            <p className="text-[12px] text-muted-foreground">
              Béa will open this link and read the plan on it.
            </p>
          ) : null}
          {(pdf || images.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {pdf && (
                <span className="flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-card py-1 pl-2 pr-1 text-[12.5px]">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 truncate">{pdf.name}</span>
                  <button
                    aria-label={`Remove ${pdf.name}`}
                    onClick={() => setPdf(null)}
                    className="tap-44 grid size-5 place-items-center rounded-full border border-border bg-card"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {images.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt={`Attached picture ${i + 1}`}
                    className="size-10 rounded-lg border border-border object-cover"
                  />
                  <button
                    aria-label={`Remove picture ${i + 1}`}
                    onClick={() => setImages((cur) => cur.filter((_, x) => x !== i))}
                    className="tap-44 absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-border bg-card"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {images.length > 1 && (
                <span className="text-[12px] text-muted-foreground">
                  {images.length} of {MAX_IMAGES}, read as one plan
                </span>
              )}
            </div>
          )}
        </PlanPanel>
      )}

      {wrongMode && (
        <div className="rise rounded-xl border border-primary/40 bg-elevated p-2.5">
          <p className="text-[13px]">
            {pastedPlanNote(pastedShape) ?? "That looks like a link to a plan you already have."}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Béa is set to build a new one, so she'd rewrite it — including the times.
          </p>
          <button
            type="button"
            onClick={() => {
              setMode("import");
              setIncludeCosts(false);
            }}
            className="mt-2 min-h-11 w-full rounded-xl bg-primary px-3 py-2 text-[14px] font-semibold text-primary-foreground"
          >
            Read my plan instead
          </button>
        </div>
      )}

      {mode === "build" && (
        <PriorityPicker
          options={BUILD_PRIORITIES}
          selected={priorities}
          onToggle={togglePriority}
          custom={ownPriorities}
          onCustom={setOwnPriorities}
        >
          <div className="flex items-center gap-2 text-[12.5px]">
            <Switch
              checked={includeCosts}
              onCheckedChange={setIncludeCosts}
              aria-label="Include approximate costs"
            />
            <span className="min-w-0 flex-1 text-muted-foreground">
              Estimate costs <span className="text-[11.5px]">(approximate, not quotes)</span>
            </span>
            {includeCosts && (
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label="Currency"
                className="rounded-lg border border-[var(--field-border)] bg-card px-2 py-1 text-[12.5px]"
              >
                {["CAD", "USD", "EUR", "GBP", "JPY", "MXN"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            )}
          </div>
        </PriorityPicker>
      )}

      <PlanAction
        onClick={() => void read()}
        disabled={
          busy ||
          badLink ||
          (mode === "import" && !hasFiles && !link && text.trim().length < 10) ||
          (mode === "build" && needsPlace && !whereTo.trim())
        }
      >
        {busy
          ? "Working…"
          : mode === "build"
            ? addingMore
              ? "Find and add to my trip"
              : "Build my trip"
            : "Import plan"}
      </PlanAction>
      {busy && (
        <div className="mt-2">
          <BeaRunning moment="plan.working" action={mode === "build" ? "run" : "think"} />
        </div>
      )}
      <p className="text-center text-[11.5px] leading-snug text-muted-foreground">
        {mode === "build"
          ? "Béa drafts the plan; you book and confirm."
          : !hasFiles && !link && text.trim().length < 10
            ? "Paste a plan, upload a PDF, calendar or photo, or add a link to import it."
            : "Sent to an AI to read, so leave out passport and card numbers. Calendar files stay on your device."}
      </p>

      {error && <p className="break-words text-[13px] text-destructive">{error}</p>}
      {saved && (
        <p className="text-[13px] text-primary">
          {beaLine("plan.complete").title} {tripStillEditableNote()}
        </p>
      )}

      {items && (
        <div className="rise space-y-2 rounded-xl border border-border bg-elevated p-3">
          {summary && <p className="text-[13px] text-muted-foreground">{summary}</p>}
          {plan?.grounding && <SearchGroundingNote grounding={plan.grounding} />}
          {includeCosts && plan?.estimated_total != null && (
            <p className="text-[14.5px] font-semibold">
              Estimated trip total: {plan.estimated_total.toLocaleString()} {plan.currency}
            </p>
          )}
          {items.length > 0 && (
            <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-border bg-card p-2 shadow-sm">
              {needsDayOne && (
                <div className="mb-2 rounded-xl border border-primary/40 bg-elevated p-2.5">
                  <p className="text-[13px]">
                    <CalendarDays className="mr-1 inline size-3.5 text-primary" aria-hidden />
                    This plan is written as {relativeDays === 1 ? "a day" : `${relativeDays} days`},
                    not dates.
                  </p>
                  <label className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                    Day 1 is
                    <input
                      type="date"
                      value={dayOneDate}
                      aria-label="The date day one of this plan falls on"
                      onChange={(e) => setDayOneDate(e.target.value)}
                      className="min-h-11 rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px] text-foreground"
                    />
                  </label>
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    {dayOneDate
                      ? "Béa will spread the days out from there."
                      : "Without it the whole plan lands on one undated pile."}
                  </p>
                </div>
              )}
              {datesDisagree && datedRange && tripRange && movedTrip && (
                <fieldset className="mb-2 rounded-xl border border-primary/40 bg-elevated p-2.5">
                  <legend className="sr-only">Which dates are right</legend>
                  <p className="text-[13px]">
                    <CalendarDays className="mr-1 inline size-3.5 text-primary" aria-hidden />
                    This plan is for <strong>{rangeLabel(datedRange)}</strong>, but{" "}
                    {scopedTo ? `your time in ${scopedTo}` : "the trip"} is{" "}
                    <strong>{rangeLabel(tripRange)}</strong>. Which is right?
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {(scopedTo
                      ? ([
                          [
                            "keep-trip",
                            `${scopedTo}'s dates — put this plan on ${dayLabel(tripRange.start)}`,
                          ],
                        ] as const)
                      : ([
                          ["move-trip", `The plan — move the trip to ${rangeLabel(movedTrip)}`],
                          ["keep-trip", `The trip — put this plan on ${dayLabel(tripRange.start)}`],
                        ] as const)
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-[13px]"
                      >
                        <input
                          type="radio"
                          name="plan-dates"
                          checked={dateChoice === value}
                          onChange={() => setDateChoice(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {/**
               * What Béa found, said out loud.
               *
               * The list already knew all of this and showed none of it. The
               * counts are only meaningful because an entry's kind survives
               * an import now — before, every row was "Plan" and this would
               * have read "18 things" in a more expensive way.
               */}
              <p className="mb-1.5 text-[13px] font-semibold">
                Béa found {items.length} {items.length === 1 ? "place" : "places"}
                {foundShape ? ` · ${foundShape}` : ""}
                {relativeDays > 0 ? ` · ${relativeDays} day${relativeDays === 1 ? "" : "s"}` : ""}
              </p>
              {placedTally.high + placedTally.needsLook > 0 && (
                <p className="mb-2 text-[12.5px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{placedTally.high} mapped</span>
                  {placedTally.needsLook > 0
                    ? ` · ${placedTally.needsLook} worth a look`
                    : " · all of them look right"}
                </p>
              )}
              <p className="mb-2 text-[12px] text-muted-foreground">
                {picked.length} of {items.length} stops selected.
                {duplicateIndexes.size > 0 &&
                  ` ${duplicateIndexes.size} already on your timeline, left unticked.`}{" "}
                {items.some((it) => it.booked)
                  ? "Stops your plan marks as booked keep a Booked tag; Béa has not checked or made any booking."
                  : "Nothing here is reserved — book hotels, tables and tickets yourself."}
              </p>
              {onAddDirections && (
                <label className="mb-2 flex items-start gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={withDirections}
                    onChange={(e) => tickDirections(e.target.checked)}
                    className="mt-0.5 size-4 accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="font-semibold">Add directions between stops</span>
                    <span className="block text-[12px] text-muted-foreground">
                      How to get from each stop to the next, added to the timeline once they're
                      saved.
                    </span>
                  </span>
                </label>
              )}
              <button
                onClick={() => void addChosen()}
                // Saving before the stops are placed saved them with no pins.
                disabled={
                  busy || placing !== null || picked.length === 0 || (datesDisagree && !dateChoice)
                }
                className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {placing && !busy
                  ? "Placing your stops…"
                  : busy
                    ? saveStatus || "Saving your trip…"
                    : `Save ${picked.length} stops${includeCosts && plan?.costs.length ? " + costs" : ""}`}
              </button>
              {/* The long wait gets a face. Everything else here is quick
                  enough that a button label carries it. */}
              {placing && (
                <div className="mt-2">
                  <BeaRunning
                    status="Placing your stops…"
                    done={placing.done}
                    total={placing.total}
                    estimate={estimatedSeconds(placing.total, PLAN_LOOKUP_GAP_MS)}
                  />
                </div>
              )}
            </div>
          )}
          {items.length === 0 && (
            <p className="text-[13px] text-muted-foreground">Nothing readable in there.</p>
          )}
          {items.map((it, i) => (
            <label
              key={i}
              className="flex items-start gap-2 rounded-lg border border-border/60 p-2"
            >
              <input
                type="checkbox"
                checked={picked.includes(i)}
                onChange={() =>
                  setPicked((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))
                }
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-[12px] uppercase tracking-wider text-muted-foreground">
                  {[it.day_date ?? (it.day_number ? `Day ${it.day_number}` : null), it.time_label]
                    .filter(Boolean)
                    .join(" · ")}
                  {it.day_date || it.day_number || it.time_label ? " · " : ""}
                  {it.kind}
                  {it.within ? ` · in ${it.within}` : ""}
                </span>
                <span className="block text-[14.5px] font-medium">
                  {it.title}
                  {it.source === "vault" && (
                    <span className="ml-1.5 rounded-full border border-primary/40 px-1.5 py-0.5 text-[11.5px] font-semibold text-primary">
                      From your vault
                    </span>
                  )}
                  {it.booked && (
                    <span className="ml-1.5 rounded-full bg-nexttime/12 px-1.5 py-0.5 text-[11.5px] font-semibold text-nexttime">
                      Booked
                    </span>
                  )}
                  {duplicateIndexes.has(i) && (
                    <span className="ml-1.5 rounded-full border border-border px-1.5 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
                      Already on your timeline
                    </span>
                  )}
                </span>
                {it.detail && (
                  <span className="block text-[13px] text-muted-foreground">{it.detail}</span>
                )}
                {(it.place || it.address || it.city || stayMinutesFrom(it)) && (
                  <span className="block text-[12.5px] text-muted-foreground">
                    {[
                      it.address || it.place,
                      it.city,
                      stayMinutesFrom(it) ? `~${stayLabel(stayMinutesFrom(it)!)} stay` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {includeCosts && it.estimated_cost != null && (
                  <span className="block text-[13px] text-muted-foreground">
                    Est. {it.estimated_cost} {it.currency ?? plan?.currency ?? currency}
                  </span>
                )}
                {/**
                 * Where Béa put it, and how sure she is.
                 *
                 * Silent on a confident match, because a row that is simply
                 * right does not need a badge — and a page of green ticks is
                 * the same wall of noise as a page of warnings. The ones that
                 * speak up are the ones worth a second of your attention.
                 */}
                <PlacementNote
                  found={placements[i]}
                  choice={pinChoices[i]}
                  onChoose={(choice) => setPinChoices((cur) => ({ ...cur, [i]: choice }))}
                />
              </span>
            </label>
          ))}
          {items.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-[13px] text-muted-foreground">
                Tick the stops you want swapped, then tell Béa why. Untick anything that should
                stay.
              </p>
              {picked.length === items.length && (
                <p className="text-[12px] text-muted-foreground">
                  Every stop is ticked — this will suggest a new version of the whole list.
                </p>
              )}
              <textarea
                aria-label="Rainy-day activities, something less expensive"
                value={altReason}
                onChange={(e) => setAltReason(e.target.value)}
                rows={2}
                maxLength={800}
                placeholder="Rainy-day activities, something less expensive…"
                className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px] outline-none"
              />
              <button
                onClick={() => void findAlternatives()}
                disabled={busy || picked.length === 0 || altReason.trim().length < 3}
                className="w-full rounded-xl border border-border px-4 py-2 text-[14.5px] font-semibold disabled:opacity-50"
              >
                {busy ? "Béa is working…" : "Ask Béa to find alternatives for these suggestions"}
              </button>
              <p className="pt-1 text-[13px] text-muted-foreground">
                Or start over from this draft.
              </p>
              <textarea
                aria-label="Fewer museums, more food, a slower first day"
                value={rebuildReason}
                onChange={(e) => setRebuildReason(e.target.value)}
                rows={2}
                maxLength={800}
                placeholder="Fewer museums, more food, a slower first day…"
                className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px] outline-none"
              />
              <button
                onClick={() => void rebuildTrip()}
                disabled={busy || rebuildReason.trim().length < 3}
                className="w-full rounded-xl border border-border px-4 py-2 text-[14.5px] font-semibold disabled:opacity-50"
              >
                {busy ? "Béa is working…" : "Rebuild my trip"}
              </button>
              {busy && <BeaRunning moment="plan.working" action="run" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One line under a parsed row saying where Béa landed it.
 *
 * Three states, and only two of them talk. A confident match shows a quiet
 * pin and the name she matched, so it can be checked at a glance without
 * asking anything. Anything less says what is wrong with it in words.
 */
function PlacementNote({
  found,
  choice,
  onChoose,
}: {
  found?:
    | { lat: number; lon: number; label?: string; confidence: Confidence; reason: string }
    | undefined;
  choice?: PinChoice | undefined;
  onChoose: (choice: PinChoice) => void;
}) {
  if (!found) return null;
  const shortLabel = (found.label ?? "").split(",").slice(0, 2).join(",").trim();
  const kept = pinIsSaved(found.confidence, choice);
  // Inside the row's <label>: without this a tap would also tick or untick
  // the row.
  const choose = (next: PinChoice) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChoose(next);
  };
  const action = (label: string, next: PinChoice) => (
    <button
      type="button"
      onClick={choose(next)}
      className="ml-1.5 inline-flex min-h-7 items-center rounded-md border border-border bg-card px-2 text-[11.5px] font-semibold text-foreground"
    >
      {label}
    </button>
  );

  if (!kept) {
    return (
      <span className="mt-1 block rounded-lg bg-elevated px-2 py-1 text-[12px] text-muted-foreground">
        <span className="font-semibold text-foreground">
          {found.confidence === "low" ? "Check this one — not pinned" : "Pin removed"}
        </span>
        {shortLabel ? ` · Béa found ${shortLabel}` : ""}
        {found.confidence === "low" && <span className="block">{found.reason}</span>}
        <span className="mt-0.5 block">
          Saved without a place; set it later from the stop.
          {action("Use this pin", "keep")}
        </span>
      </span>
    );
  }

  if (found.confidence === "high") {
    return (
      <span className="mt-0.5 block text-[12px] text-muted-foreground">
        <MapPin className="mr-1 inline size-3 text-primary" aria-hidden />
        {shortLabel || "On the map"}
        {action("Not this one", "drop")}
      </span>
    );
  }
  return (
    <span
      className={`mt-1 block rounded-lg px-2 py-1 text-[12px] ${
        found.confidence === "low"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary-soft text-foreground"
      }`}
    >
      <span className="font-semibold">
        {found.confidence === "low" ? "Kept, though Béa was unsure" : "Béa's best guess"}
      </span>
      {shortLabel ? ` — ${shortLabel}` : ""}
      <span className="block text-muted-foreground">{found.reason}</span>
      {action("Not this one", "drop")}
    </span>
  );
}

function OptimizePanel({
  preset,
  tripPreferences = [],
  travel,
  tripCity,
  startDate,
  endDate,
  items,
  cities,
  onApplySchedule,
  onImport,
  onBuild,
}: {
  preset?: OptimizePreset | undefined;
  tripPreferences?: string[];
  travel?: TravelChoice | undefined;
  tripCity?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  items: OptimizeSourceItem[];
  cities: OptimizeSourceCity[];
  onApplySchedule?:
    | ((
        updates: Array<{
          id: string;
          day_date: string | null;
          time_label: string | null;
          position: number;
        }>,
      ) => Promise<void>)
    | undefined;
  /**
   * With fewer than two stops on the trip: bring a plan in, or have Béa draft
   * one, right here. Not offered for a single day, whose other days may be full.
   */
  onImport?: () => void;
  onBuild?: () => void;
}) {
  const run = useServerFn(optimizeItinerary);
  const [goals, setGoals] = useState<OptimizeGoalId[]>(preset?.goals ?? ["closest"]);
  const [note, setNote] = useState(preset?.note ?? "");
  const [showStayed, setShowStayed] = useState(false);
  /** Priorities beyond the goal chips, sent with the note. */
  const [ownGoals, setOwnGoals] = useState("");
  const [busy, setBusy] = useState(false);
  useReportBusy(busy);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<OptimizeItinerary | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleGoal = (id: OptimizeGoalId) => {
    setGoals((cur) => {
      if (cur.includes(id)) return cur.length === 1 ? cur : cur.filter((g) => g !== id);
      return cur.length >= 4 ? cur : [...cur, id];
    });
  };

  const rearrange = async () => {
    if (items.length < 2) return;
    if (items.length > OPTIMIZE_MAX_ITEMS) {
      setPlan(null);
      setSaved(false);
      setError(
        `This trip has ${items.length} stops — Béa can rearrange up to ${OPTIMIZE_MAX_ITEMS} in one go. Trim a few, or split the trip, then try again.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    setPlan(null);
    try {
      const out = await run({
        data: {
          tripCity: tripCity || null,
          startDate: startDate || null,
          endDate: endDate || null,
          goals,
          note:
            [note.trim(), ownGoals.trim() ? `Also prioritize: ${ownGoals.trim()}` : ""]
              .filter(Boolean)
              .join("\n") || null,
          tripPreferences,
          ...(travel ? { travel } : {}),
          items: items.map((item) => ({
            ...item,
            detail: stripEmbeddedMapsUrl(item.detail) || null,
          })),
          cities,
        },
      });
      setPlan(out);
    } catch (e) {
      setError(aiFailure(e).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan || !onApplySchedule) return;
    setBusy(true);
    setError(null);
    try {
      await onApplySchedule(plan.items);
      setSaved(true);
      const done = beaLine("plan.complete");
      toast.success(done.title, { description: beaCheer("route") ?? done.body });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that arrangement.");
    } finally {
      setBusy(false);
    }
  };

  // A one-tap request runs as soon as it opens: the tap was the asking.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!preset || autoRan.current || items.length < 2) return;
    autoRan.current = true;
    void rearrange();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on opening
  }, []);

  const byId = new Map(items.map((item) => [item.id, item]));
  const delta = plan ? optimizeDelta(items, plan.items, plan.travel) : null;
  const stayedRows = plan
    ? plan.items.filter((row) => {
        const was = byId.get(row.id);
        return (
          was &&
          (was.day_date ?? "") === (row.day_date ?? "") &&
          (was.time_label ?? "") === (row.time_label ?? "")
        );
      })
    : [];

  return (
    <div className="mt-1 space-y-2.5">
      <PlanTitle title="Optimize my trip">
        Béa keeps your {items.length} stop{items.length === 1 ? "" : "s"} and reorganizes the days
        around what matters to you. She doesn't check reservations.
      </PlanTitle>
      {preset && (
        <p className="rounded-xl bg-primary-soft px-3 py-2 text-[13.5px] font-semibold text-primary">
          {preset.label} for {preset.dayLabel}
        </p>
      )}

      {items.length < 2 ? (
        <div className="space-y-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
          <p className="text-[13px] text-muted-foreground">
            There isn&apos;t enough planned for {preset ? preset.dayLabel : "this trip"} to
            rearrange yet. Béa needs at least two stops.
          </p>
          {(onImport || onBuild) && (
            <div className="flex flex-wrap gap-2">
              {onImport && (
                <button
                  type="button"
                  onClick={onImport}
                  className="min-h-10 rounded-full bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground"
                >
                  Import a plan
                </button>
              )}
              {onBuild && (
                <button
                  type="button"
                  onClick={onBuild}
                  className="min-h-10 rounded-full border border-border bg-card px-4 text-[13.5px] font-semibold"
                >
                  Let Béa draft the days
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <PlanPanel
            tone="rose"
            icon={Pencil}
            title="What would you like to improve?"
            aside={<CharCount value={note} max={OPTIMIZE_NOTE_MAX} />}
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={OPTIMIZE_NOTE_MAX}
              aria-label="What would you like to improve?"
              placeholder="e.g. less backtracking, slower mornings, keep my dinner bookings…"
              className={`${PLAN_FIELD} resize-none`}
            />
          </PlanPanel>
          <PriorityPicker
            hint="Up to four"
            options={OPTIMIZE_GOALS.map((g) => g.id)}
            selected={goals}
            onToggle={(id) => toggleGoal(id as OptimizeGoalId)}
            custom={ownGoals}
            onCustom={setOwnGoals}
            customMax={OPTIMIZE_OWN_MAX}
          >
            <p className="text-[12px] text-muted-foreground">
              {OPTIMIZE_GOALS.filter((g) => goals.includes(g.id))
                .map((g) => g.hint)
                .join(" · ")}
            </p>
          </PriorityPicker>
          <PlanAction onClick={() => void rearrange()} disabled={busy || goals.length === 0}>
            {busy && !plan ? "Béa is rearranging…" : "Optimize my trip"}
          </PlanAction>
          {busy && !plan && <BeaRunning moment="choose.working" status="Rearranging the days" />}
        </>
      )}

      {error && <p className="break-words text-[13px] text-destructive">{error}</p>}
      {saved && <p className="text-[13px] text-primary">Timeline updated.</p>}

      {plan && (
        <div className="rise space-y-2 rounded-xl border border-border bg-elevated p-3">
          {delta && (
            <p className="rounded-lg bg-card px-2.5 py-1.5 text-[13.5px] font-semibold">
              {deltaLine(delta)}
            </p>
          )}
          <p className="text-[14.5px] font-medium">{plan.summary}</p>
          <p className="text-[13px] text-muted-foreground">{plan.changes}</p>
          {plan.travel && <p className="text-[13px] text-foreground">{travelLine(plan.travel)}</p>}
          {plan.limited && (
            <p className="text-[12px] text-muted-foreground">
              Béa has used today&apos;s share of place and route lookups, so some of this
              wasn&apos;t checked. Try again tomorrow.
            </p>
          )}
          {plan.recheckedDays ? (
            <p className="text-[12px] text-muted-foreground">
              {plan.recheckedDays === 1 ? "One day was" : `${plan.recheckedDays} days were`} put in
              order again: a real route was much longer than it looked on the map.
            </p>
          ) : null}
          {plan.plannedDays ? (
            <p className="text-[12px] text-muted-foreground">
              {plan.plannedDays === 1 ? "One day was" : `${plan.plannedDays} days were`} ordered
              around opening hours and the distances between stops.
            </p>
          ) : null}
          <ol className="space-y-1.5">
            {plan.items.map((row) => {
              const original = byId.get(row.id);
              if (!original) return null;
              if (!showStayed && stayedRows.includes(row)) return null;
              const when = [row.day_date, row.time_label].filter(Boolean).join(" · ");
              const before = [original.day_date, original.time_label].filter(Boolean).join(" · ");
              const moved = when !== before;
              return (
                <li key={row.id} className="rounded-lg border border-border/60 p-2">
                  <p className="text-[12px] uppercase tracking-wider text-muted-foreground">
                    {when || "Unscheduled"}
                    {moved && before ? ` · was ${before}` : ""}
                    {moved ? "" : " · stayed"}
                  </p>
                  <p className="break-words text-[14.5px] font-medium">{original.title}</p>
                  {row.reason && (
                    <p className="break-words text-[13px] text-muted-foreground">{row.reason}</p>
                  )}
                </li>
              );
            })}
          </ol>
          {stayedRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowStayed((v) => !v)}
              aria-expanded={showStayed}
              className="text-[13px] font-semibold text-primary underline underline-offset-2"
            >
              {showStayed
                ? "Hide the stops that stayed"
                : `Show the ${stayedRows.length} ${stayedRows.length === 1 ? "stop" : "stops"} that stayed`}
            </button>
          )}
          <button
            onClick={() => void apply()}
            disabled={busy || !onApplySchedule}
            className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && plan ? "Saving the new order…" : "Use this arrangement"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * "Getting between stops: about 3 h 10 min on foot → about 2 h 5 min."
 * Estimated from the pins of each day, so the claim that a plan is closer
 * together is something the reader can see — and says "about", because it
 * is a distance on the map, not a route. When every journey of the new plan
 * was checked on the router, its real total follows.
 */
function travelLine(travel: OptimizeTravel): string {
  const how = travel.mode === "walk" ? " on foot" : travel.mode === "drive" ? " by car" : "";
  const was = minutesLabel(travel.beforeSec);
  const now = minutesLabel(travel.afterSec);
  const real =
    travel.checkedSec != null ? ` Checked on real routes: ${minutesLabel(travel.checkedSec)}.` : "";
  if (was === now) return `Getting between stops: about ${now}${how}, as before.${real}`;
  return `Getting between stops: about ${was}${how} → about ${now}.${real}`;
}

function ComparePanel() {
  const run = useServerFn(compareItineraries);
  const [a, setA] = useState({ label: "Plan A", text: "" });
  const [b, setB] = useState({ label: "Plan B", text: "" });
  /** "What matters to you?": the picked tiles, and anything typed beside them. */
  const [picked, setPicked] = useState<PlanPriorityId[]>([]);
  const [priorities, setPriorities] = useState("");
  const [busy, setBusy] = useState(false);
  useReportBusy(busy);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ItineraryComparison | null>(null);

  /** A side still reading an uploaded file: its text is about to change. */
  const [reading, setReading] = useState({ A: false, B: false });
  const ready =
    a.text.trim().length >= 10 && b.text.trim().length >= 10 && !reading.A && !reading.B;
  const togglePicked = (id: PlanPriorityId) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));

  const compare = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const out = await run({
        data: {
          a: { label: a.label.trim() || "Plan A", text: a.text.trim() },
          b: { label: b.label.trim() || "Plan B", text: b.text.trim() },
          priorities: comparePriorities(picked, priorities) || null,
        },
      });
      setResult(out);
    } catch (e) {
      setError(aiFailure(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 space-y-2">
      <PlanTitle title="Compare options">
        Paste or upload two plans; Béa picks the better fit.
      </PlanTitle>
      <AiPromptButton variant="banner" label="Get the AI prompt" />

      <div className="grid grid-cols-2 gap-2">
        <CompareSide
          letter="A"
          tone="rose"
          plan={a}
          onChange={(patch) => setA((cur) => ({ ...cur, ...patch }))}
          onReading={(on) => setReading((cur) => ({ ...cur, A: on }))}
          disabled={busy}
        />
        <CompareSide
          letter="B"
          tone="mint"
          plan={b}
          onChange={(patch) => setB((cur) => ({ ...cur, ...patch }))}
          onReading={(on) => setReading((cur) => ({ ...cur, B: on }))}
          disabled={busy}
        />
      </div>

      <PriorityPicker
        title="What matters to you?"
        options={COMPARE_PRIORITIES}
        selected={picked}
        onToggle={togglePicked}
        custom={priorities}
        onCustom={setPriorities}
        customMax={300}
      />

      <PlanAction onClick={() => void compare()} disabled={busy || !ready}>
        {busy ? "Comparing…" : "Compare these plans"}
      </PlanAction>
      {busy && <BeaRunning moment="choose.working" status="Reading both plans, then comparing" />}

      {error && <p className="break-words text-[13px] text-destructive">{error}</p>}

      {result && <ComparisonResult result={result} />}
    </div>
  );
}

/**
 * One side of Compare: its letter and name, the plan's text, and a button
 * to upload it instead. An uploaded file is read into that text first — a
 * calendar right here, a PDF or photo by Béa — so the box shows what was read.
 */
function CompareSide({
  letter,
  tone,
  plan,
  onChange,
  onReading,
  disabled,
}: {
  letter: string;
  tone: "rose" | "mint";
  plan: { label: string; text: string };
  /** A change to the plan, applied to its latest state. */
  onChange: (patch: Partial<{ label: string; text: string }>) => void;
  /** While a file is read, so Compare waits for its text. */
  onReading: (on: boolean) => void;
  disabled: boolean;
}) {
  const read = useServerFn(parseItinerary);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProblem(null);
    setReading(file.name);
    onReading(true);
    try {
      let items: ParsedItineraryItem[];
      const all = new Uint8Array(await file.arrayBuffer());
      const head = new TextDecoder().decode(all.subarray(0, 64));
      if (/\.ics$/i.test(file.name) || file.type === "text/calendar" || looksLikeIcs(head)) {
        items = icsToParsedItinerary(new TextDecoder().decode(all)).items;
      } else if (file.type.startsWith("image/")) {
        const out = await read({
          data: {
            imageDataUrls: [await downscaleImage(file)],
            text: null,
            tripCity: null,
            startDate: null,
            endDate: null,
            mode: "import",
            pace: null,
            budgetLevel: null,
            currency: null,
          },
        });
        items = out.items;
      } else {
        const bad = pdfProblem({
          size: file.size,
          head: all.subarray(0, 4096),
          tail: all.subarray(Math.max(0, all.length - 4096)),
        });
        if (bad) throw new Error(pdfProblemMessage(bad));
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error ?? new Error("Could not read that PDF."));
          reader.readAsDataURL(new Blob([all], { type: "application/pdf" }));
        });
        const out = await read({
          data: {
            imageDataUrls: null,
            pdfDataUrl: dataUrl,
            text: null,
            tripCity: null,
            startDate: null,
            endDate: null,
            mode: "import",
            pace: null,
            budgetLevel: null,
            currency: null,
          },
        });
        items = out.items;
      }
      const text = planAsText(items);
      if (!text.trim()) throw new Error(`Béa found no plan in ${file.name}.`);
      onChange({ text: text.slice(0, 20000) });
    } catch (err) {
      setProblem(err instanceof IcsReadError ? err.message : aiFailure(err).message);
    } finally {
      setReading(null);
      onReading(false);
    }
  };

  return (
    <section className={`plan-panel plan-${tone} min-w-0 space-y-1.5 p-2`}>
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="plan-badge grid size-6 shrink-0 place-items-center rounded-full font-display text-[15px]"
        >
          {letter}
        </span>
        <input
          value={plan.label}
          onChange={(e) => onChange({ label: e.target.value })}
          maxLength={60}
          aria-label={`Name of plan ${letter}`}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        />
      </div>
      <textarea
        value={plan.text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={3}
        maxLength={20000}
        aria-label={`Plan ${letter}`}
        placeholder="Paste this plan here, or upload a PDF, calendar or photo…"
        className={`${PLAN_FIELD} resize-none px-2.5 text-[13px]`}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.pdf,text/calendar,.ics"
        className="hidden"
        onChange={(e) => void onFile(e)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || reading !== null}
        title="PDF, calendar, photo or screenshot"
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[12.5px] font-medium disabled:opacity-60"
      >
        <Upload className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{reading ? `Reading ${reading}…` : "Or upload a file"}</span>
      </button>
      {problem ? <p className="break-words text-[11.5px] text-destructive">{problem}</p> : null}
    </section>
  );
}

type MetricKey = keyof ItineraryComparison["a"]["metrics"];

const METRIC_ROWS: Array<{
  key: MetricKey;
  label: string;
  unit: string;
  /** Which direction counts as better, or null when neither is. */
  better: "low" | "high" | null;
  format?: (value: number) => string;
  omitHint: string;
}> = [
  { key: "estimatedCost", label: "Estimated cost", unit: "", better: "low", omitHint: "" },
  { key: "stopCount", label: "Places visited", unit: "", better: "high", omitHint: "" },
  {
    key: "activeHoursPerDay",
    label: "Active hours / day",
    unit: "h",
    better: null,
    omitHint: "Need stop durations",
  },
  {
    key: "indoorShare",
    label: "Works in bad weather",
    unit: "",
    better: "high",
    format: (v) => `${Math.round(v * 100)}%`,
    omitHint: "Need indoor/outdoor labels",
  },
  {
    key: "walkingKmPerDay",
    label: "Walking / day",
    unit: "km",
    better: null,
    omitHint: "Need a map pin on every stop",
  },
  {
    key: "transitMinutesPerDay",
    label: "Transit / day",
    unit: "min",
    better: "low",
    omitHint: "Need routed times",
  },
  {
    key: "longestTravelLegMinutes",
    label: "Longest single trip",
    unit: "min",
    better: "low",
    omitHint: "Need routed times",
  },
];

function ComparisonResult({ result }: { result: ItineraryComparison }) {
  const [dayTab, setDayTab] = useState<"a" | "b">("a");
  const [showProse, setShowProse] = useState(false);
  const [showThoughts, setShowThoughts] = useState(false);
  const money = (value: number) => `${Math.round(value).toLocaleString()} ${result.currency}`;

  const proseRows: Array<[string, "pace" | "highlights" | "cost" | "bestFor" | "watchOut"]> = [
    ["Pace", "pace"],
    ["Highlights", "highlights"],
    ["Cost", "cost"],
    ["Best for", "bestFor"],
    ["Watch out", "watchOut"],
  ];

  return (
    <div className="rise space-y-4 rounded-2xl border border-border bg-elevated p-3">
      {/* 1 — the verdict */}
      <div>
        <h3 className="font-display text-[18px] leading-tight">{result.headline}</h3>
        <p className="mt-1 text-[14.5px]">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Sparkles className="size-3.5 text-primary" />
            Béa would pick {result.pick}.
          </span>{" "}
          {result.why}
        </p>
      </div>

      {/* 2 — the numbers */}
      <div>
        <p className="label-caps mb-1.5">Side by side</p>
        <table className="w-full table-fixed border-collapse text-[13px] tabular-nums">
          <thead>
            <tr>
              <th className="w-[34%] p-1 text-left font-normal text-muted-foreground">Measure</th>
              {[result.a, result.b].map((side) => (
                <th
                  key={side.label}
                  className={`rounded-t-lg p-1 text-left text-[13px] ${
                    side.label === result.pick ? "text-primary" : ""
                  }`}
                >
                  {side.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((row) => {
              const av = result.a.metrics[row.key];
              const bv = result.b.metrics[row.key];
              if (av == null || bv == null) {
                return (
                  <tr key={row.key}>
                    <td className="border-t border-border/60 p-1 text-muted-foreground">
                      {row.label}
                    </td>
                    <td
                      colSpan={2}
                      className="border-t border-border/60 p-1 text-[12px] text-muted-foreground"
                    >
                      Not measured — {row.omitHint || "we didn't have enough to compute this"}.
                    </td>
                  </tr>
                );
              }
              const fmt = (v: number) =>
                row.format
                  ? row.format(v)
                  : row.key === "estimatedCost"
                    ? money(v)
                    : `${Math.round(v * 10) / 10}${row.unit ? ` ${row.unit}` : ""}`;
              const diff = Math.abs(av - bv);
              const aBetter =
                row.better === null || av === bv ? null : row.better === "low" ? av < bv : av > bv;
              const cell = (value: number, isBetter: boolean | null) => (
                <td
                  className={`border-t border-border/60 p-1 ${
                    isBetter ? "font-semibold text-primary" : ""
                  }`}
                >
                  {fmt(value)}
                </td>
              );
              return (
                <tr key={row.key}>
                  <td className="border-t border-border/60 p-1 text-muted-foreground">
                    {row.label}
                    {diff > 0 && (
                      <span className="block text-[11.5px]">
                        {row.key === "estimatedCost"
                          ? `${money(diff)} apart`
                          : `${Math.round(diff * 10) / 10}${row.unit ? ` ${row.unit}` : ""} apart`}
                      </span>
                    )}
                  </td>
                  {cell(av, aBetter)}
                  {cell(bv, aBetter === null ? null : !aBetter)}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Cost and stop counts are added up in the app. A blank row means we could not measure it —
          never a guess. Nothing here is a quote or a booking.
        </p>
      </div>

      {/* 3 — day by day */}
      {result.days.length > 0 && (
        <div>
          <p className="label-caps mb-1.5">Day by day</p>
          <div className="mb-2 grid grid-cols-2 gap-2 sm:hidden">
            {(["a", "b"] as const).map((side) => (
              <button
                key={side}
                onClick={() => setDayTab(side)}
                className={`rounded-xl border px-3 py-1.5 text-[13px] ${
                  dayTab === side
                    ? "border-primary text-primary"
                    : "border-border/60 text-muted-foreground"
                }`}
              >
                {result[side].label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {result.days.map((day) => (
              <div key={day.dayNumber} className="rounded-xl bg-elevated p-2.5">
                <p className="mb-1 text-[12px] uppercase tracking-wider text-muted-foreground">
                  Day {day.dayNumber}
                  {day.date ? ` · ${day.date}` : ""}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["a", "b"] as const).map((side) => (
                    <div
                      key={side}
                      className={`space-y-0.5 text-[13px] ${dayTab === side ? "" : "hidden sm:block"}`}
                    >
                      <p className="text-[12px] font-semibold">{result[side].label}</p>
                      <p>
                        <span className="text-muted-foreground">Morning · </span>
                        {side === "a" ? day.aMorning : day.bMorning}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Afternoon · </span>
                        {side === "a" ? day.aAfternoon : day.bAfternoon}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Evening · </span>
                        {side === "a" ? day.aEvening : day.bEvening}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[13px] font-medium">
                  {day.divergence}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 — the one thing to borrow */}
      <div className="rounded-xl border border-primary/40 bg-card p-2.5">
        <p className="label-caps mb-0.5 text-primary">Borrow this</p>
        <p className="text-[14.5px]">{result.mix}</p>
      </div>

      {result.reasoningText && (
        <div>
          <button
            onClick={() => setShowThoughts((v) => !v)}
            aria-expanded={showThoughts}
            className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
          >
            <span>How Béa decided</span>
            <span className={`transition-transform ${showThoughts ? "rotate-90" : ""}`}>▸</span>
          </button>
          {showThoughts && (
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-muted-foreground">
              {result.reasoningText}
            </p>
          )}
        </div>
      )}

      {/* 5 — the prose detail, collapsed */}
      <div>
        <button
          onClick={() => setShowProse((v) => !v)}
          aria-expanded={showProse}
          className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
        >
          <span>In Béa's words</span>
          <span className={`transition-transform ${showProse ? "rotate-90" : ""}`}>▸</span>
        </button>
        {showProse && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {proseRows.map(([title, key]) => (
              <div key={key} className="col-span-2 grid grid-cols-2 gap-2">
                <p className="col-span-2 text-[12px] uppercase tracking-wider text-muted-foreground">
                  {title}
                </p>
                <p className="rounded-lg border border-border/60 p-2 text-[13px]">
                  {result.a[key]}
                </p>
                <p className="rounded-lg border border-border/60 p-2 text-[13px]">
                  {result.b[key]}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
