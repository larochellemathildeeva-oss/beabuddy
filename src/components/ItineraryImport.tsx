import { Sheet } from "@/components/Sheet";
import { BeaRunning } from "@/components/BeaRunning";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Camera,
  MapPin,
  Columns2,
  Image as ImageIcon,
  ListOrdered,
  Sparkles,
  X,
} from "lucide-react";
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
import { aiFailure } from "@/lib/ai-errors";
import { findDuplicate } from "@/lib/captured-place";
import { useUndo } from "@/hooks/useUndo";
import { addedLine } from "@/lib/undo";
import { downscaleImage } from "@/lib/image";
import { placeHintFromDetail } from "@/lib/direction-stops";
import { estimatedSeconds } from "@/lib/geocode-plan";
import { minutesLabel } from "@/lib/route-optimize";
import { pastedPlanNote, readPlanShape } from "@/lib/pasted-plan";
import { scoreMatch, tallyConfidence, type Confidence } from "@/lib/match-confidence";
import { dayShapeLine } from "@/lib/day-shape";
import {
  hasRelativeDays,
  lastDayDate,
  relativeDayCount,
  resolveDayDates,
} from "@/lib/relative-days";
import { geocodePlanStops, PLAN_LOOKUP_GAP_MS } from "@/lib/geocode-plan.functions";
import { pinIsSaved, stayMinutesFrom, type PinChoice } from "@/lib/import-stop";
import { stayLabel } from "@/lib/planned-stay";
import { stripEmbeddedMapsUrl } from "@/lib/timeline-directions";
import { tripStillEditableNote } from "@/lib/trip-copy";
import { beaLine } from "@/lib/bea-voice";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import logo from "@/assets/bea-logo.png";

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
};

type NewCostItem = { label: string; category: string; amount: number; currency: string };

type PlannerTab = "import" | "optimize" | "compare";

export function ItineraryImport({
  open,
  onClose,
  tripCity,
  startDate,
  endDate,
  defaultTab = "import",
  existingItems = [],
  cities = [],
  onAddItems,
  onRemoveItems,
  onAddCosts,
  onApplyDates,
  onApplySchedule,
}: {
  open: boolean;
  onClose: () => void;
  tripCity?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  defaultTab?: PlannerTab;
  existingItems?: OptimizeSourceItem[];
  cities?: OptimizeSourceCity[];
  /** Returns the inserted row ids, so a bulk save can be undone. */
  onAddItems: (items: NewItineraryItem[]) => Promise<string[] | void>;
  /** Takes a batch back out again, for that undo. */
  onRemoveItems?: ((ids: string[]) => Promise<void>) | undefined;
  onAddCosts?: ((items: NewCostItem[]) => Promise<void>) | undefined;
  onApplyDates?: ((dates: { start_date: string; end_date: string }) => Promise<void>) | undefined;
  onApplySchedule?: (
    updates: Array<{
      id: string;
      day_date: string | null;
      time_label: string | null;
      position: number;
    }>,
  ) => Promise<void>;
}) {
  const [tab, setTab] = useState<PlannerTab>(defaultTab);

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Let Béa plan this trip"
      hint="Built around your travel preferences and tagged recs"
      icon={<img src={logo} alt="" className="size-10 object-contain" />}
    >
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setTab("import")}
          className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[12px] ${
            tab === "import" ? "border-primary bg-card" : "border-border/60 text-muted-foreground"
          }`}
        >
          <Camera className="size-3.5" /> Plan
        </button>
        <button
          data-guide="bea-optimize"
          onClick={() => setTab("optimize")}
          className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[12px] ${
            tab === "optimize" ? "border-primary bg-card" : "border-border/60 text-muted-foreground"
          }`}
        >
          <ListOrdered className="size-3.5" /> Optimize
        </button>
        <button
          onClick={() => setTab("compare")}
          className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[12px] ${
            tab === "compare" ? "border-primary bg-card" : "border-border/60 text-muted-foreground"
          }`}
        >
          <Columns2 className="size-3.5" /> Compare
        </button>
      </div>

      {tab === "import" && (
        <ImportPanel
          existingItems={existingItems}
          tripCity={tripCity}
          startDate={startDate}
          endDate={endDate}
          onAddItems={onAddItems}
          {...(onRemoveItems ? { onRemoveItems } : {})}
          onAddCosts={onAddCosts}
          onApplyDates={onApplyDates}
        />
      )}
      {tab === "optimize" && (
        <OptimizePanel
          tripCity={tripCity}
          startDate={startDate}
          endDate={endDate}
          items={existingItems}
          cities={cities}
          onApplySchedule={onApplySchedule}
        />
      )}
      {tab === "compare" && <ComparePanel />}
    </Sheet>
  );
}

function ImportPanel({
  existingItems,
  tripCity,
  startDate,
  endDate,
  onAddItems,
  onRemoveItems,
  onAddCosts,
  onApplyDates,
}: {
  existingItems: OptimizeSourceItem[];
  tripCity?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  /** Returns the inserted row ids, so a bulk save can be undone. */
  onAddItems: (items: NewItineraryItem[]) => Promise<string[] | void>;
  /** Takes a batch back out again, for that undo. */
  onRemoveItems?: ((ids: string[]) => Promise<void>) | undefined;
  onAddCosts?: ((items: NewCostItem[]) => Promise<void>) | undefined;
  onApplyDates?: ((dates: { start_date: string; end_date: string }) => Promise<void>) | undefined;
}) {
  const run = useServerFn(parseItinerary);
  const revise = useServerFn(reviseItinerary);
  const { addedWithUndo } = useUndo();

  /** Indexes of the parsed rows the timeline does not already have. */
  const freshIndexes = (rows: { title: string }[]) =>
    rows
      .map((row, i) => (findDuplicate(existingItems, { name: row.title }) ? -1 : i))
      .filter((i) => i >= 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const MAX_IMAGES = 6;
  const [images, setImages] = useState<string[]>([]);
  const onPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedItineraryItem[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  /** Set while Béa is out placing the stops; null the rest of the time. */
  const [placing, setPlacing] = useState<{ done: number; total: number } | null>(null);
  const [mode, setMode] = useState<"build" | "import">("build");
  const [pace, setPace] = useState<"relaxed" | "balanced" | "full">("balanced");
  const [budgetLevel, setBudgetLevel] = useState<"value" | "comfortable" | "premium">(
    "comfortable",
  );
  const [currency, setCurrency] = useState("CAD");
  const [includeCosts, setIncludeCosts] = useState(false);
  const [altReason, setAltReason] = useState("");
  const [rebuildReason, setRebuildReason] = useState("");
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof run>> | null>(null);
  /**
   * The date a "Day 1 / Day 2" plan begins.
   *
   * Only asked for when nothing else knows: the trip has no start date and
   * the source named none. One field, answered once, instead of a date
   * chosen twenty times on the timeline afterwards.
   */
  const [dayOneDate, setDayOneDate] = useState("");
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
  /** Pins the person kept or removed at review, by row. */
  const [pinChoices, setPinChoices] = useState<Record<number, PinChoice>>({});
  const savedPin = (i: number) => {
    const found = placements[i];
    return found && pinIsSaved(found.confidence, pinChoices[i]) ? found : undefined;
  };

  const read = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    setSaveStatus("");
    setItems(null);
    setPlan(null);
    try {
      const out = await run({
        data: {
          imageDataUrls: mode === "import" && images.length ? images : null,
          text: text.trim() || null,
          tripCity: tripCity || null,
          startDate: startDate || null,
          endDate: endDate || null,
          mode,
          pace,
          budgetLevel,
          currency,
          includeCosts,
        },
      });
      setSummary(out.summary);
      setItems(out.items);
      setPlan(out);
      setPicked(freshIndexes(out.items));
      setAltReason("");
      setRebuildReason("");
      setPlacements({});
      setPinChoices({});
      if (out.items.length > 0) {
        const ready = beaLine("plan.ready");
        toast.success(ready.title, { description: ready.body });
        void placeParsed(out.items);
      }
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
  const placeParsed = async (parsed: ParsedItineraryItem[]) => {
    const area = tripCity?.trim() || "";
    // A plan that names each stop's town can be placed without a trip city.
    if ((!area && !parsed.some((item) => item.city?.trim())) || parsed.length === 0) return;
    setPlacing({ done: 0, total: parsed.length });
    try {
      const result = await geocodePlanStops({
        data: {
          stops: parsed.map((item) => ({
            title: item.title,
            detail: item.detail ?? null,
            place: item.place ?? null,
            address: item.address ?? null,
            city: item.city ?? null,
          })),
          area,
        },
      });
      const found: Record<
        number,
        { lat: number; lon: number; label?: string; confidence: Confidence; reason: string }
      > = {};
      for (const hit of result.placed) {
        const row = parsed[hit.index];
        if (!row) continue;
        // Scored against the stop's venue as well as its title: "Arrive
        // Hiroshima Station" is about the station, and the lookup was made by
        // the venue name when the plan gave one.
        const scored = [row.title, row.place, row.address]
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
        const { confidence, reason } = scored.reduce((best, next) =>
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
      setPlacements(found);
      setPlacing({ done: result.placed.length, total: parsed.length });
    } catch {
      // No pins is where this started; it is not a reason to lose the plan.
    } finally {
      setPlacing(null);
    }
  };

  /**
   * Which parsed rows the timeline already has. Re-reading the same booking
   * email used to silently double the trip; now the repeats are named and
   * left unticked.
   */
  const duplicateIndexes = new Set(
    (items ?? [])
      // Matched on title alone: every row here belongs to this one trip, so a
      // repeated name is a repeat rather than a same-named place elsewhere.
      // isSamePlace does not read addresses, so a hint here did nothing.
      .map((item, index) => (findDuplicate(existingItems, { name: item.title }) ? index : -1))
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
  const wrongMode = mode === "build" && pastedShape.existing;

  const planStart = startDate || plan?.start_date || dayOneDate || "";
  const needsDayOne = Boolean(items && hasRelativeDays(items) && !startDate && !plan?.start_date);
  const relativeDays = items ? relativeDayCount(items) : 0;
  /** "6 meals · 5 sights · 3 walks", using the kinds the parse returned. */
  const foundShape = items ? dayShapeLine(items) : "";
  const placedTally = tallyConfidence(Object.values(placements).map((p) => p.confidence));

  const addChosen = async () => {
    if (!items) return;
    setBusy(true);
    setError(null);
    try {
      // Day 1 becomes a real date here, so everything downstream — the day
      // groups, Today, the calendar — sees an ordinary dated plan.
      const dated = planStart ? resolveDayDates(items, planStart) : items;
      const chosen = picked.flatMap((i) => {
        const it = dated[i];
        if (!it) return [];
        // The address the source gave, pulled out by the parse; the detail
        // line's first clause only when it gave none.
        const address = it.address?.trim() || placeHintFromDetail(it.detail);
        const stay = stayMinutesFrom(it);
        // Already found, at review time, and already shown to the person
        // saving it — and only if it was trusted or kept. No second round of
        // lookups on the way out.
        const found = savedPin(i);
        return [
          {
            ...(found ? { lat: found.lat, lon: found.lon } : {}),
            ...(it.day_date ? { day_date: it.day_date } : {}),
            ...(it.time_label ? { time_label: it.time_label } : {}),
            kind: it.kind,
            title: it.title,
            ...(address ? { address } : {}),
            ...(stay ? { planned_stay_minutes: stay } : {}),
            ...(it.detail || (includeCosts && it.estimated_cost != null)
              ? {
                  detail: [
                    it.detail,
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
      if (onApplyDates && plan?.start_date && plan.end_date) {
        setSaveStatus("Updating the trip dates…");
        await onApplyDates({ start_date: plan.start_date, end_date: plan.end_date });
      } else if (onApplyDates && dayOneDate && !startDate) {
        // The user just told Béa when day one is, so the trip should know it
        // too — otherwise the timeline has dates the trip itself does not.
        const last = lastDayDate(dated) ?? dayOneDate;
        setSaveStatus("Updating the trip dates…");
        await onApplyDates({ start_date: dayOneDate, end_date: last });
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
        toast.success(done.title, { description: done.body });
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
    setPicked(freshIndexes(out.items));
    // Pins are kept by row number, and a revision renumbers the rows: the
    // old ones would land on whichever stop now sits in that place.
    setPlacements({});
    setPinChoices({});
    if (out.items.length > 0) void placeParsed(out.items);
  };

  const findAlternatives = async () => {
    if (!items || picked.length === 0 || altReason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const out = await revise({
        data: {
          tripCity: tripCity || null,
          startDate: startDate || null,
          endDate: endDate || null,
          pace,
          budgetLevel,
          currency,
          includeCosts,
          originalRequest: text.trim() || null,
          items,
          selectedIndexes: picked,
          reason: altReason.trim(),
          mode: "alternatives",
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
          tripCity: tripCity || null,
          startDate: startDate || null,
          endDate: endDate || null,
          pace,
          budgetLevel,
          currency,
          includeCosts,
          originalRequest: text.trim() || null,
          items,
          selectedIndexes: [],
          reason: rebuildReason.trim(),
          mode: "rebuild",
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
    <div className="mt-3 space-y-2">
      <p className="text-[13px] text-muted-foreground">
        Build a new trip from a few details, or turn a photo or pasted plan into dates and a
        complete timeline.
      </p>
      <p className="text-[13px] text-muted-foreground">
        Béa drafts a plan. She does not book hotels, restaurants or tickets, and she cannot check
        whether a table or room is actually free. You reserve and confirm those yourself.
      </p>

      {/**
       * Two different jobs, asked as a question rather than a toggle.
       *
       * This was a pair of small buttons under three paragraphs, with "Build a
       * new trip" already chosen. Pasting a finished itinerary into the box
       * underneath therefore asked Béa to invent one — which she did, times and
       * all, because that is what build mode instructs. The choice comes first
       * now, and each card says what it is for, so the difference is visible
       * before the text box is.
       */}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => setMode("build")}
          aria-pressed={mode === "build"}
          className={`rounded-xl border p-3 text-left ${
            mode === "build" ? "border-primary bg-primary-soft" : "border-border"
          }`}
        >
          <span className="block text-[14px] font-semibold">Build me a trip</span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
            Tell Béa what you like and she'll draft the days.
          </span>
        </button>
        <button
          onClick={() => {
            setMode("import");
            // Cost estimates are a planning knob; reading a booked itinerary
            // should never come back with invented prices.
            setIncludeCosts(false);
          }}
          aria-pressed={mode === "import"}
          className={`rounded-xl border p-3 text-left ${
            mode === "import" ? "border-primary bg-primary-soft" : "border-border"
          }`}
        >
          <span className="block text-[14px] font-semibold">I already have a plan</span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
            Paste an itinerary, a guide or a blog post — or photograph it. Béa keeps your times and
            finds the places.
          </span>
        </button>
      </div>

      {mode === "build" && (
        <>
          <div className={`grid gap-2 ${includeCosts ? "grid-cols-3" : "grid-cols-2"}`}>
            <select
              value={pace}
              onChange={(e) => setPace(e.target.value as typeof pace)}
              aria-label="Trip pace"
              className="rounded-xl border border-border bg-card px-2 py-2 text-[13px]"
            >
              <option value="relaxed">Relaxed</option>
              <option value="balanced">Balanced</option>
              <option value="full">Full days</option>
            </select>
            <select
              value={budgetLevel}
              onChange={(e) => setBudgetLevel(e.target.value as typeof budgetLevel)}
              aria-label="Budget style"
              className="rounded-xl border border-border bg-card px-2 py-2 text-[13px]"
            >
              <option value="value">Value</option>
              <option value="comfortable">Comfort</option>
              <option value="premium">Premium</option>
            </select>
            {includeCosts && (
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label="Currency"
                className="rounded-xl border border-border bg-card px-2 py-2 text-[13px]"
              >
                {["CAD", "USD", "EUR", "GBP", "JPY", "MXN"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <div>
              <p className="text-[14.5px] font-medium">Approximate costs</p>
              <p className="text-[12px] text-muted-foreground">
                Off unless you ask. Estimates only — not quotes.
              </p>
            </div>
            <Switch
              checked={includeCosts}
              onCheckedChange={setIncludeCosts}
              aria-label="Include approximate costs"
            />
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPicked}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPicked}
      />

      {mode === "import" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || images.length >= MAX_IMAGES}
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-[14.5px] font-medium disabled:opacity-50"
          >
            <Camera className="size-4" /> Take a photo
          </button>
          <button
            onClick={() => libraryRef.current?.click()}
            disabled={busy || images.length >= MAX_IMAGES}
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-[14.5px] font-medium disabled:opacity-50"
          >
            <ImageIcon className="size-4" /> Choose photos
          </button>
        </div>
      )}
      {mode === "import" && images.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] text-muted-foreground">
            {images.length} of {MAX_IMAGES} pictures — Béa reads them together as one plan.
          </p>
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative">
                <img
                  src={src}
                  alt={`Attached picture ${i + 1}`}
                  className="size-16 rounded-lg border border-border object-cover"
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
          </div>
        </div>
      )}
      {mode === "import" && (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Pictures and pasted plans are sent to an AI provider to read them — avoid including
          passport numbers, card details or other sensitive information.
        </p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={20000}
        placeholder={
          mode === "build"
            ? "Describe the trip you want: interests, must-dos, mobility needs, or anything Béa should know…"
            : "Paste an itinerary here, or add notes about the pictures…"
        }
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] outline-none"
      />
      {wrongMode && (
        <div className="rise rounded-xl border border-primary/40 bg-elevated p-2.5">
          <p className="text-[13px]">{pastedPlanNote(pastedShape)}</p>
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
      <button
        onClick={() => void read()}
        disabled={busy || (mode === "import" && !images.length && text.trim().length < 10)}
        className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy
          ? "Working…"
          : mode === "build"
            ? "Build my trip"
            : images.length > 1
              ? `Read these ${images.length} pictures`
              : "Read this itinerary"}
      </button>
      {busy && (
        <div className="mt-2">
          <BeaRunning moment="plan.working" />
        </div>
      )}
      {mode === "import" && !images.length && text.trim().length < 10 && (
        <p className="text-[12px] text-muted-foreground">
          Add one or more pictures above, or paste the plan first.
        </p>
      )}

      {error && <p className="break-words text-[13px] text-destructive">{error}</p>}
      {saved && (
        <p className="text-[13px] text-primary">
          {beaLine("plan.complete").title} {tripStillEditableNote()}
        </p>
      )}

      {items && (
        <div className="rise space-y-2 rounded-xl border border-border bg-elevated p-3">
          {summary && <p className="text-[13px] text-muted-foreground">{summary}</p>}
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
                      className="min-h-11 rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] text-foreground"
                    />
                  </label>
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    {dayOneDate
                      ? "Béa will spread the days out from there."
                      : "Without it the whole plan lands on one undated pile."}
                  </p>
                </div>
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
                Nothing here is reserved — book hotels, tables and tickets yourself.
              </p>
              <button
                onClick={() => void addChosen()}
                disabled={busy || picked.length === 0}
                className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy
                  ? saveStatus || (placing ? "Placing your stops…" : "Saving your trip…")
                  : `Save ${picked.length} stops${includeCosts && plan?.costs.length ? " + costs" : ""}`}
              </button>
              {/* The long wait gets a face. Everything else here is quick
                  enough that a button label carries it. */}
              {placing && (
                <div className="mt-2">
                  <BeaRunning
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
                </span>
                <span className="block text-[14.5px] font-medium">
                  {it.title}
                  {it.source === "vault" && (
                    <span className="ml-1.5 rounded-full border border-primary/40 px-1.5 py-0.5 text-[11.5px] font-semibold text-primary">
                      From your vault
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
                value={altReason}
                onChange={(e) => setAltReason(e.target.value)}
                rows={2}
                maxLength={800}
                placeholder="Rainy-day activities, something less expensive…"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] outline-none"
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
                value={rebuildReason}
                onChange={(e) => setRebuildReason(e.target.value)}
                rows={2}
                maxLength={800}
                placeholder="Fewer museums, more food, a slower first day…"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] outline-none"
              />
              <button
                onClick={() => void rebuildTrip()}
                disabled={busy || rebuildReason.trim().length < 3}
                className="w-full rounded-xl border border-border px-4 py-2 text-[14.5px] font-semibold disabled:opacity-50"
              >
                {busy ? "Béa is working…" : "Rebuild my trip"}
              </button>
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
  tripCity,
  startDate,
  endDate,
  items,
  cities,
  onApplySchedule,
}: {
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
}) {
  const run = useServerFn(optimizeItinerary);
  const [goals, setGoals] = useState<OptimizeGoalId[]>(["closest"]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
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
          note: note.trim() || null,
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
      toast.success(done.title, { description: done.body });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that arrangement.");
    } finally {
      setBusy(false);
    }
  };

  const byId = new Map(items.map((item) => [item.id, item]));

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[13px] text-muted-foreground">
        Béa keeps every stop you already have and reshuffles the days — closest together, indoor on
        a wet day, easier mornings, whatever you pick. She does not check whether a reservation is
        still available.
      </p>

      {items.length < 2 ? (
        <p className="rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-muted-foreground">
          Add at least two timeline stops first, then come back to rearrange them.
        </p>
      ) : (
        <>
          <p className="text-[12px] text-muted-foreground">
            {items.length} stop{items.length === 1 ? "" : "s"} on this trip
            {goals.length ? ` · ${goals.length} preference${goals.length === 1 ? "" : "s"}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {OPTIMIZE_GOALS.map((goal) => {
              const on = goals.includes(goal.id);
              return (
                <button
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  className={`rounded-full border px-3 py-1.5 text-left text-[13px] ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="block font-medium">{goal.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-muted-foreground">
            {OPTIMIZE_GOALS.filter((g) => goals.includes(g.id))
              .map((g) => g.hint)
              .join(" · ")}
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="Anything else — one slow museum day, keep the dinner reservation…"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] outline-none"
          />
          <button
            onClick={() => void rearrange()}
            disabled={busy || goals.length === 0}
            className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && !plan ? "Béa is rearranging…" : "Ask Béa to rearrange"}
          </button>
        </>
      )}

      {error && <p className="break-words text-[13px] text-destructive">{error}</p>}
      {saved && <p className="text-[13px] text-primary">Timeline updated.</p>}

      {plan && (
        <div className="rise space-y-2 rounded-xl border border-border bg-elevated p-3">
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
  const [priorities, setPriorities] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ItineraryComparison | null>(null);

  const ready = a.text.trim().length >= 10 && b.text.trim().length >= 10;

  const compare = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const out = await run({
        data: {
          a: { label: a.label.trim() || "Plan A", text: a.text.trim() },
          b: { label: b.label.trim() || "Plan B", text: b.text.trim() },
          priorities: priorities.trim() || null,
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
    <div className="mt-3 space-y-2">
      <p className="text-[13px] text-muted-foreground">
        Paste two versions of a plan — from two AI answers, a friend, or a tour page. Béa reads each
        one first, then compares. That takes a little longer.
      </p>

      {[[a, setA] as const, [b, setB] as const].map(([plan, set], i) => (
        <div key={i} className="space-y-1.5 rounded-xl bg-elevated p-2.5">
          <input
            value={plan.label}
            onChange={(e) => set({ ...plan, label: e.target.value })}
            maxLength={60}
            className="w-full bg-transparent text-[13px] font-semibold outline-none"
          />
          <textarea
            value={plan.text}
            onChange={(e) => set({ ...plan, text: e.target.value })}
            rows={4}
            maxLength={20000}
            placeholder="Paste this plan here…"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[14.5px] outline-none"
          />
        </div>
      ))}

      <label className="block">
        <span className="label-caps">What matters to you</span>
        <input
          value={priorities}
          onChange={(e) => setPriorities(e.target.value)}
          maxLength={400}
          placeholder="Slow mornings, good food, easy on the budget…"
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] outline-none"
        />
      </label>

      <button
        onClick={() => void compare()}
        disabled={busy || !ready}
        className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy
          ? "Reading both plans, then comparing…"
          : ready
            ? "Compare side by side"
            : "Paste both plans first"}
      </button>

      {error && <p className="break-words text-[13px] text-destructive">{error}</p>}

      {result && <ComparisonResult result={result} />}
    </div>
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
