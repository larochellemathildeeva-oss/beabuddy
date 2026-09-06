import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Columns2, Image as ImageIcon, ListOrdered, Sparkles, X } from "lucide-react";
import {
  compareItineraries,
  optimizeItinerary,
  OPTIMIZE_GOALS,
  parseItinerary,
  reviseItinerary,
  type ItineraryComparison,
  type OptimizeGoalId,
  type OptimizeItinerary,
  type OptimizeSourceCity,
  type OptimizeSourceItem,
  type ParsedItineraryItem,
} from "@/lib/itinerary.functions";
import { downscaleImage } from "@/lib/image";
import { placeHintFromDetail } from "@/lib/direction-stops";
import { tripStillEditableNote } from "@/lib/trip-copy";
import { Switch } from "@/components/ui/switch";
import logo from "@/assets/bea-logo.png";

type NewItineraryItem = {
  day_date?: string;
  time_label?: string;
  kind: string;
  title: string;
  detail?: string;
  address?: string;
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
  onAddItems: (items: NewItineraryItem[]) => Promise<void>;
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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Let Béa plan this trip"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
    >
      <section
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-4 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center gap-3">
          <img src={logo} alt="" className="size-10 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[19px] leading-tight">Let Béa plan this trip</p>
            <p className="text-[11px] text-muted-foreground">
              Built around your travel preferences and tagged recs
            </p>
          </div>
          <button
            aria-label="Close trip planner"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full border border-border"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setTab("import")}
            className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] ${
              tab === "import" ? "border-primary bg-card" : "border-border/60 text-muted-foreground"
            }`}
          >
            <Camera className="size-3.5" /> Build
          </button>
          <button
            data-guide="bea-optimize"
            onClick={() => setTab("optimize")}
            className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] ${
              tab === "optimize"
                ? "border-primary bg-card"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            <ListOrdered className="size-3.5" /> Optimize
          </button>
          <button
            onClick={() => setTab("compare")}
            className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] ${
              tab === "compare"
                ? "border-primary bg-card"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            <Columns2 className="size-3.5" /> Compare
          </button>
        </div>

        {tab === "import" && (
          <ImportPanel
            tripCity={tripCity}
            startDate={startDate}
            endDate={endDate}
            onAddItems={onAddItems}
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
      </section>
    </div>
  );
}

function ImportPanel({
  tripCity,
  startDate,
  endDate,
  onAddItems,
  onAddCosts,
  onApplyDates,
}: {
  tripCity?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  onAddItems: (items: NewItineraryItem[]) => Promise<void>;
  onAddCosts?: ((items: NewCostItem[]) => Promise<void>) | undefined;
  onApplyDates?: ((dates: { start_date: string; end_date: string }) => Promise<void>) | undefined;
}) {
  const run = useServerFn(parseItinerary);
  const revise = useServerFn(reviseItinerary);
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
      setError(
        files.length > room ? `Béa can read up to ${MAX_IMAGES} pictures at a time.` : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that picture.");
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
      setPicked(out.items.map((_, i) => i));
      setAltReason("");
      setRebuildReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const addChosen = async () => {
    if (!items) return;
    setBusy(true);
    setError(null);
    try {
      const chosen = picked.flatMap((i) => {
        const it = items[i];
        if (!it) return [];
        const address = placeHintFromDetail(it.detail);
        return [
          {
            ...(it.day_date ? { day_date: it.day_date } : {}),
            ...(it.time_label ? { time_label: it.time_label } : {}),
            kind: it.kind,
            title: it.title,
            ...(address ? { address } : {}),
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
      setSaveStatus(`Saving ${chosen.length} timeline stops…`);
      await onAddItems(chosen);
      if (includeCosts && onAddCosts && plan?.costs.length) {
        setSaveStatus("Saving the budget…");
        await onAddCosts(plan.costs);
      }
      if (onApplyDates && plan?.start_date && plan.end_date) {
        setSaveStatus("Updating the trip dates…");
        await onApplyDates({ start_date: plan.start_date, end_date: plan.end_date });
      }
      setItems(null);
      setText("");
      setSaved(true);
      setSaveStatus("");
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
    setPicked(out.items.map((_, i) => i));
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
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
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
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12px] text-muted-foreground">
        Build a new trip from a few details, or turn a photo or pasted plan into dates and a
        complete timeline.
      </p>
      <p className="text-[12px] text-muted-foreground">
        Béa drafts a plan. She does not book hotels, restaurants or tickets, and she cannot check
        whether a table or room is actually free. You reserve and confirm those yourself.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode("build")}
          className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${mode === "build" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
        >
          Build a new trip
        </button>
        <button
          onClick={() => setMode("import")}
          className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${mode === "import" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
        >
          Import a plan
        </button>
      </div>

      <div className={`grid gap-2 ${includeCosts ? "grid-cols-3" : "grid-cols-2"}`}>
        <select
          value={pace}
          onChange={(e) => setPace(e.target.value as typeof pace)}
          aria-label="Trip pace"
          className="rounded-xl border border-border bg-elevated px-2 py-2 text-[12px]"
        >
          <option value="relaxed">Relaxed</option>
          <option value="balanced">Balanced</option>
          <option value="full">Full days</option>
        </select>
        <select
          value={budgetLevel}
          onChange={(e) => setBudgetLevel(e.target.value as typeof budgetLevel)}
          aria-label="Budget style"
          className="rounded-xl border border-border bg-elevated px-2 py-2 text-[12px]"
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
            className="rounded-xl border border-border bg-elevated px-2 py-2 text-[12px]"
          >
            {["CAD", "USD", "EUR", "GBP", "JPY", "MXN"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
        <div>
          <p className="text-[13px] font-medium">Approximate costs</p>
          <p className="text-[11px] text-muted-foreground">
            Off unless you ask. Estimates only — not quotes.
          </p>
        </div>
        <Switch
          checked={includeCosts}
          onCheckedChange={setIncludeCosts}
          aria-label="Include approximate costs"
        />
      </div>

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
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-[13px] font-medium disabled:opacity-50"
          >
            <Camera className="size-4" /> Take a photo
          </button>
          <button
            onClick={() => libraryRef.current?.click()}
            disabled={busy || images.length >= MAX_IMAGES}
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-[13px] font-medium disabled:opacity-50"
          >
            <ImageIcon className="size-4" /> Choose photos
          </button>
        </div>
      )}
      {mode === "import" && images.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
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
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-border bg-card"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {mode === "import" && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
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
        className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px] outline-none"
      />
      <button
        onClick={() => void read()}
        disabled={busy || (mode === "import" && !images.length && text.trim().length < 10)}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy
          ? "Béa is planning…"
          : mode === "build"
            ? "Build my trip"
            : images.length > 1
              ? `Read these ${images.length} pictures`
              : "Read this itinerary"}
      </button>
      {mode === "import" && !images.length && text.trim().length < 10 && (
        <p className="text-[11px] text-muted-foreground">
          Add one or more pictures above, or paste the plan first.
        </p>
      )}

      {error && <p className="text-[12px] text-destructive">{error}</p>}
      {saved && (
        <p className="text-[12px] text-primary">
          Added to your timeline. {tripStillEditableNote()}
        </p>
      )}

      {items && (
        <div className="rise space-y-2 rounded-xl border border-border bg-elevated p-3">
          {summary && <p className="text-[12px] text-muted-foreground">{summary}</p>}
          {includeCosts && plan?.estimated_total != null && (
            <p className="text-[13px] font-semibold">
              Estimated trip total: {plan.estimated_total.toLocaleString()} {plan.currency}
            </p>
          )}
          {items.length > 0 && (
            <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-border bg-card p-2 shadow-sm">
              <p className="mb-2 text-[11px] text-muted-foreground">
                {picked.length} of {items.length} stops selected. Nothing here is reserved — book
                hotels, tables and tickets yourself.
              </p>
              <button
                onClick={() => void addChosen()}
                disabled={busy || picked.length === 0}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy
                  ? saveStatus || "Saving your trip…"
                  : `Save ${picked.length} stops${includeCosts && plan?.costs.length ? " + costs" : ""}`}
              </button>
            </div>
          )}
          {items.length === 0 && (
            <p className="text-[12px] text-muted-foreground">Nothing readable in there.</p>
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
                <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                  {[it.day_date, it.time_label].filter(Boolean).join(" · ")}
                  {it.day_date || it.time_label ? " · " : ""}
                  {it.kind}
                </span>
                <span className="block text-[13px] font-medium">
                  {it.title}
                  {it.source === "vault" && (
                    <span className="ml-1.5 rounded-full border border-primary/40 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      From your vault
                    </span>
                  )}
                </span>
                {it.detail && (
                  <span className="block text-[12px] text-muted-foreground">{it.detail}</span>
                )}
                {includeCosts && it.estimated_cost != null && (
                  <span className="block text-[12px] text-muted-foreground">
                    Est. {it.estimated_cost} {it.currency ?? plan?.currency ?? currency}
                  </span>
                )}
              </span>
            </label>
          ))}
          {items.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-[12px] text-muted-foreground">
                Tick the stops you want swapped, then tell Béa why. Untick anything that should
                stay.
              </p>
              {picked.length === items.length && (
                <p className="text-[11px] text-muted-foreground">
                  Every stop is ticked — this will suggest a new version of the whole list.
                </p>
              )}
              <textarea
                value={altReason}
                onChange={(e) => setAltReason(e.target.value)}
                rows={2}
                maxLength={800}
                placeholder="Rainy-day activities, something less expensive…"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] outline-none"
              />
              <button
                onClick={() => void findAlternatives()}
                disabled={busy || picked.length === 0 || altReason.trim().length < 3}
                className="w-full rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
              >
                {busy ? "Béa is working…" : "Ask Béa to find alternatives for these suggestions"}
              </button>
              <p className="pt-1 text-[12px] text-muted-foreground">
                Or start over from this draft.
              </p>
              <textarea
                value={rebuildReason}
                onChange={(e) => setRebuildReason(e.target.value)}
                rows={2}
                maxLength={800}
                placeholder="Fewer museums, more food, a slower first day…"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] outline-none"
              />
              <button
                onClick={() => void rebuildTrip()}
                disabled={busy || rebuildReason.trim().length < 3}
                className="w-full rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
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
          items,
          cities,
        },
      });
      setPlan(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that arrangement.");
    } finally {
      setBusy(false);
    }
  };

  const byId = new Map(items.map((item) => [item.id, item]));

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12px] text-muted-foreground">
        Béa keeps every stop you already have and reshuffles the days — closest together, indoor
        on a wet day, easier mornings, whatever you pick. She does not check whether a reservation
        is still available.
      </p>

      {items.length < 2 ? (
        <p className="rounded-xl border border-border bg-elevated px-3 py-2.5 text-[12px] text-muted-foreground">
          Add at least two timeline stops first, then come back to rearrange them.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
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
                  className={`rounded-full border px-3 py-1.5 text-left text-[12px] ${
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
          <p className="text-[11px] text-muted-foreground">
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
            className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px] outline-none"
          />
          <button
            onClick={() => void rearrange()}
            disabled={busy || goals.length === 0}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && !plan ? "Béa is rearranging…" : "Ask Béa to rearrange"}
          </button>
        </>
      )}

      {error && <p className="text-[12px] text-destructive">{error}</p>}
      {saved && <p className="text-[12px] text-primary">Timeline updated.</p>}

      {plan && (
        <div className="rise space-y-2 rounded-xl border border-border bg-elevated p-3">
          <p className="text-[13px] font-medium">{plan.summary}</p>
          <p className="text-[12px] text-muted-foreground">{plan.changes}</p>
          <ol className="space-y-1.5">
            {plan.items.map((row) => {
              const original = byId.get(row.id);
              if (!original) return null;
              const when = [row.day_date, row.time_label].filter(Boolean).join(" · ");
              const before = [original.day_date, original.time_label].filter(Boolean).join(" · ");
              const moved = when !== before;
              return (
                <li key={row.id} className="rounded-lg border border-border/60 p-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {when || "Unscheduled"}
                    {moved && before ? ` · was ${before}` : ""}
                    {moved ? "" : " · stayed"}
                  </p>
                  <p className="text-[13px] font-medium">{original.title}</p>
                  {row.reason && (
                    <p className="text-[12px] text-muted-foreground">{row.reason}</p>
                  )}
                </li>
              );
            })}
          </ol>
          <button
            onClick={() => void apply()}
            disabled={busy || !onApplySchedule}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && plan ? "Saving the new order…" : "Use this arrangement"}
          </button>
        </div>
      )}
    </div>
  );
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
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12px] text-muted-foreground">
        Paste two versions of a plan — from two AI answers, a friend, or a tour page. Béa reads
        each one first, then compares. That takes a little longer.
      </p>

      {[[a, setA] as const, [b, setB] as const].map(([plan, set], i) => (
        <div key={i} className="space-y-1.5 rounded-xl border border-border/60 p-2">
          <input
            value={plan.label}
            onChange={(e) => set({ ...plan, label: e.target.value })}
            maxLength={60}
            className="w-full bg-transparent text-[12px] font-semibold outline-none"
          />
          <textarea
            value={plan.text}
            onChange={(e) => set({ ...plan, text: e.target.value })}
            rows={4}
            maxLength={20000}
            placeholder="Paste this plan here…"
            className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-[13px] outline-none"
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
          className="mt-1 w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px] outline-none"
        />
      </label>

      <button
        onClick={() => void compare()}
        disabled={busy || !ready}
        className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy
          ? "Reading both plans, then comparing…"
          : ready
            ? "Compare side by side"
            : "Paste both plans first"}
      </button>

      {error && <p className="text-[12px] text-destructive">{error}</p>}

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
  { key: "activeHoursPerDay", label: "Active hours / day", unit: "h", better: null, omitHint: "Need stop durations" },
  { key: "indoorShare", label: "Works in bad weather", unit: "", better: "high", format: (v) => `${Math.round(v * 100)}%`, omitHint: "Need indoor/outdoor labels" },
  { key: "walkingKmPerDay", label: "Walking / day", unit: "km", better: null, omitHint: "Need a map pin on every stop" },
  { key: "transitMinutesPerDay", label: "Transit / day", unit: "min", better: "low", omitHint: "Need routed times" },
  { key: "longestTravelLegMinutes", label: "Longest single trip", unit: "min", better: "low", omitHint: "Need routed times" },
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
        <p className="mt-1 text-[13px]">
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
        <table className="w-full table-fixed border-collapse text-[12px] tabular-nums">
          <thead>
            <tr>
              <th className="w-[34%] p-1 text-left font-normal text-muted-foreground">Measure</th>
              {[result.a, result.b].map((side) => (
                <th
                  key={side.label}
                  className={`rounded-t-lg p-1 text-left text-[12px] ${
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
                    <td className="border-t border-border/60 p-1 text-muted-foreground">{row.label}</td>
                    <td colSpan={2} className="border-t border-border/60 p-1 text-[11px] text-muted-foreground">
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
                      <span className="block text-[10px]">
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
        <p className="mt-1 text-[10px] text-muted-foreground">
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
                className={`rounded-xl border px-3 py-1.5 text-[12px] ${
                  dayTab === side ? "border-primary text-primary" : "border-border/60 text-muted-foreground"
                }`}
              >
                {result[side].label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {result.days.map((day) => (
              <div key={day.dayNumber} className="rounded-xl border border-border/60 p-2">
                <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Day {day.dayNumber}
                  {day.date ? ` · ${day.date}` : ""}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["a", "b"] as const).map((side) => (
                    <div
                      key={side}
                      className={`space-y-0.5 text-[12px] ${dayTab === side ? "" : "hidden sm:block"}`}
                    >
                      <p className="text-[11px] font-semibold">{result[side].label}</p>
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
                <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[12px] font-medium">
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
        <p className="text-[13px]">{result.mix}</p>
      </div>

      {result.reasoningText && (
        <div>
          <button
            onClick={() => setShowThoughts((v) => !v)}
            aria-expanded={showThoughts}
            className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
          >
            <span>How Béa decided</span>
            <span className={`transition-transform ${showThoughts ? "rotate-90" : ""}`}>▸</span>
          </button>
          {showThoughts && (
            <p className="mt-2 whitespace-pre-wrap text-[12px] text-muted-foreground">
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
          className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
        >
          <span>In Béa's words</span>
          <span className={`transition-transform ${showProse ? "rotate-90" : ""}`}>▸</span>
        </button>
        {showProse && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {proseRows.map(([title, key]) => (
              <div key={key} className="col-span-2 grid grid-cols-2 gap-2">
                <p className="col-span-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {title}
                </p>
                <p className="rounded-lg border border-border/60 p-2 text-[12px]">
                  {result.a[key]}
                </p>
                <p className="rounded-lg border border-border/60 p-2 text-[12px]">
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
