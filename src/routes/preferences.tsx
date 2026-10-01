import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { preferenceGroups } from "@/data/atlas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/preferences")({
  staticData: { plane: "detail" },
  head: () => ({
    meta: [
      { title: "Travel preferences — Béa" },
      {
        name: "description",
        content:
          "Set your travel style, budget, interests and favourite countries so Béa plans trips that actually suit you.",
      },
      { property: "og:title", content: "Travel preferences — Béa" },
      {
        property: "og:description",
        content: "Your travel style, budget, interests and favourite countries in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PreferencesPage,
});

const styles = [
  { value: "Comfort seeker", hint: "Nice bed, easy days, no roughing it." },
  { value: "Explorer", hint: "Out early, wander far, see everything." },
  { value: "Culture first", hint: "Museums, history, architecture, local life." },
  { value: "Food led", hint: "The trip is planned around meals." },
  { value: "Outdoors", hint: "Trails, water, mountains, fresh air." },
  { value: "Family friendly", hint: "Kid-proof pacing and places." },
  { value: "Romantic", hint: "Quiet corners and long dinners." },
  { value: "Work & wander", hint: "Wifi, cafés, a few good breaks." },
];

const budgets = [
  { value: "Shoestring", hint: "Hostels, street food, buses." },
  { value: "Value", hint: "Simple hotels, good cheap eats." },
  { value: "Comfortable", hint: "Solid 3–4 star, a few treats." },
  { value: "Premium", hint: "Lovely hotels, tasting menus." },
  { value: "No limit", hint: "Pick the best, always." },
];

/** Budget nuances kept as interest tags, shown under Budget rather than in Interests. */
const splurges = ["Splurge on food", "Splurge on stays"];

const listedTags = new Set([...preferenceGroups.flatMap((g) => g.tags), ...splurges]);

const CUSTOM_TAG_MAX = 40;

/** Planning and Opportunities read only this many interests (`travel-preferences.server.ts`, `useScorePrefs`). */
const TAGS_MAX = 40;

const NOTE_SAVE_DELAY_MS = 800;

const paces = [
  { value: "Slow", hint: "One or two things a day." },
  { value: "Balanced", hint: "A highlight plus room to breathe." },
  { value: "Full", hint: "Pack the day, rest at home." },
];

const currencies = ["CAD", "USD", "EUR", "GBP", "AUD", "CHF", "JPY", "MXN"];

const suggestedCountries = [
  "France",
  "Italy",
  "Spain",
  "Portugal",
  "Japan",
  "Greece",
  "Mexico",
  "Morocco",
  "Iceland",
  "Thailand",
  "Vietnam",
  "United Kingdom",
  "Norway",
  "Canada",
  "United States",
  "Peru",
  "South Africa",
  "Croatia",
];

type Prefs = {
  preferences: string[];
  travel_style: string | null;
  budget_level: string | null;
  trip_pace: string | null;
  preferred_countries: string[];
  dietary_notes: string | null;
  avoid_notes: string | null;
  home_currency: string | null;
};

function Chip({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      }`}
    >
      <span className="block text-[14.5px] font-medium">{label}</span>
      {hint && (
        <span
          className={`block text-[12px] ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function PreferencesPage() {
  const { user } = useAuth();
  // Nothing is shown to tap until the saved answers are in: a tap made on the
  // empty defaults was overwritten on screen when they arrived.
  const [load, setLoad] = useState<"loading" | "ok" | "error">("loading");
  const [loadTry, setLoadTry] = useState(0);
  const loaded = load === "ok";
  /** Saves still on their way, so "Saved ✓" waits for the last of them. */
  const pending = useRef(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );
  const [prefs, setPrefs] = useState<Prefs>({
    preferences: [],
    travel_style: null,
    budget_level: null,
    trip_pace: null,
    preferred_countries: [],
    dietary_notes: "",
    avoid_notes: "",
    home_currency: null,
  });
  const [countryDraft, setCountryDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [tagNotice, setTagNotice] = useState<string | null>(null);
  // The latest preferences, so quick taps build on each other, and a queue so
  // an older save never lands after a newer one.
  const prefsRef = useRef(prefs);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("profiles")
      .select(
        "preferences, travel_style, budget_level, trip_pace, preferred_countries, dietary_notes, avoid_notes, home_currency",
      )
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        // A failed read must not unlock the page on empty defaults: the next
        // tap would save over the traveller's real answers.
        if (error) {
          setLoad("error");
          return;
        }
        setLoad("ok");
        if (!data) return;
        prefsRef.current = {
          preferences: data.preferences ?? [],
          travel_style: data.travel_style,
          budget_level: data.budget_level,
          trip_pace: data.trip_pace,
          preferred_countries: data.preferred_countries ?? [],
          dietary_notes: data.dietary_notes ?? "",
          avoid_notes: data.avoid_notes ?? "",
          home_currency: data.home_currency,
        };
        setPrefs(prefsRef.current);
      });
    return () => {
      active = false;
    };
  }, [user, loadTry]);

  const save = (patch: Partial<Prefs>) => {
    const before = prefsRef.current;
    prefsRef.current = { ...before, ...patch };
    setPrefs(prefsRef.current);
    if (!user) return;
    const id = user.id;
    if (savedTimer.current) clearTimeout(savedTimer.current);
    pending.current += 1;
    setSaveState("saving");
    saveQueue.current = saveQueue.current.then(async () => {
      const { error } = await supabase.from("profiles").upsert({ id, ...patch });
      pending.current -= 1;
      if (error) {
        // Put a tapped choice back, so the screen never shows what was not
        // saved; but only where this save's value is still the one showing.
        // A newer tap on the same choice owns it now. Typed notes stay in
        // their box to try again.
        const undo: Partial<Prefs> = {};
        for (const key of Object.keys(patch) as Array<keyof Prefs>) {
          if (key === "dietary_notes" || key === "avoid_notes") continue;
          if (prefsRef.current[key] === patch[key])
            (undo as Record<string, unknown>)[key] = before[key];
        }
        prefsRef.current = { ...prefsRef.current, ...undo };
        setPrefs(prefsRef.current);
        setSaveState("error");
        return;
      }
      if (pending.current > 0) return;
      setSaveState((cur) => (cur === "error" ? cur : "saved"));
      savedTimer.current = setTimeout(
        () => setSaveState((cur) => (cur === "saved" ? "idle" : cur)),
        1500,
      );
    });
  };

  /** Changes the interests from their latest value, refusing to grow past TAGS_MAX. */
  const editTags = (change: (tags: string[]) => string[]) => {
    const current = prefsRef.current.preferences;
    const next = change(current);
    if (next.length > current.length && next.length > TAGS_MAX) {
      setTagNotice(`Up to ${TAGS_MAX} interests — remove one to add another.`);
      return;
    }
    setTagNotice(null);
    save({ preferences: next });
  };

  // Case-blind, so an older hand-typed "museums" is cleared by the Museums chip, not doubled.
  const toggleTag = (tag: string) =>
    editTags((tags) => {
      const same = (t: string) => t.toLowerCase() === tag.toLowerCase();
      return tags.some(same) ? tags.filter((t) => !same(t)) : [...tags, tag];
    });

  // Notes save after a pause in typing, on leaving the box, or on leaving the page.
  const flushNotes = useRef(() => {});
  flushNotes.current = () => {
    if (!noteTimer.current) return;
    clearTimeout(noteTimer.current);
    noteTimer.current = null;
    save({
      dietary_notes: prefsRef.current.dietary_notes,
      avoid_notes: prefsRef.current.avoid_notes,
    });
  };

  const editNote = (field: "dietary_notes" | "avoid_notes", value: string) => {
    prefsRef.current = { ...prefsRef.current, [field]: value };
    setPrefs(prefsRef.current);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => flushNotes.current(), NOTE_SAVE_DELAY_MS);
  };

  useEffect(() => () => flushNotes.current(), []);

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const addCountry = () => {
    const value = countryDraft.trim();
    if (!value) return;
    if (!prefs.preferred_countries.includes(value))
      void save({ preferred_countries: [...prefs.preferred_countries, value] });
    setCountryDraft("");
  };

  const customTags = prefs.preferences.filter((t) => !listedTags.has(t));

  const addTag = () => {
    const typed = tagDraft.trim().replace(/\s+/g, " ").slice(0, CUSTOM_TAG_MAX);
    if (!typed) return;
    // A listed interest typed by hand selects its chip rather than saving a second spelling.
    const value = [...listedTags].find((t) => t.toLowerCase() === typed.toLowerCase()) ?? typed;
    editTags((tags) =>
      tags.some((t) => t.toLowerCase() === value.toLowerCase()) ? tags : [...tags, value],
    );
    setTagDraft("");
  };

  return (
    <AppShell eyebrow="Béa's brain" title="Travel preferences">
      <div className="space-y-4">
        <p className="text-[14.5px] text-muted-foreground">
          Everything here goes straight into Béa's planning. The more you set, the closer her
          itineraries, restaurant picks and trip comparisons land to what you actually want.
        </p>
        <p className="text-[13px] text-muted-foreground">
          Changes save automatically — no button to press.
        </p>

        {load === "error" ? (
          <div className="card-soft space-y-3 p-4">
            <p className="text-[14.5px]">
              Your preferences didn't load, so nothing can be changed yet. Check your connection.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoad("loading");
                setLoadTry((n) => n + 1);
              }}
              className="btn-primary flex w-full items-center justify-center px-4"
            >
              Try again
            </button>
          </div>
        ) : !loaded ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading your preferences">
            <div className="card-soft h-56 animate-pulse" />
            <div className="card-soft h-40 animate-pulse" />
            <div className="card-soft h-32 animate-pulse" />
          </div>
        ) : (
          <>
            <section data-guide="pref-style" className="card-soft p-4">
              <p className="label-caps text-foreground">Travel style</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Pick as many as feel true.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {styles.map((s) => (
                  <Chip
                    key={s.value}
                    label={s.value}
                    hint={s.hint}
                    active={(prefs.travel_style ?? "").split(", ").includes(s.value)}
                    onClick={() => {
                      const current = (prefs.travel_style ?? "").split(", ").filter(Boolean);
                      void save({ travel_style: toggleIn(current, s.value).join(", ") || null });
                    }}
                  />
                ))}
              </div>
            </section>

            <section data-guide="pref-budget" className="card-soft p-4">
              <p className="label-caps text-foreground">Budget</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {budgets.map((b) => (
                  <Chip
                    key={b.value}
                    label={b.value}
                    hint={b.hint}
                    active={prefs.budget_level === b.value}
                    onClick={() =>
                      void save({ budget_level: prefs.budget_level === b.value ? null : b.value })
                    }
                  />
                ))}
              </div>
              <p className="label-caps mt-4 text-foreground">Worth a splurge</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {splurges.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={prefs.preferences.includes(tag)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] ${
                      prefs.preferences.includes(tag)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <p className="label-caps mt-4 text-foreground">Show prices in</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {currencies.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      void save({ home_currency: prefs.home_currency === c ? null : c })
                    }
                    aria-pressed={prefs.home_currency === c}
                    className={`rounded-full border px-3 py-1.5 text-[13px] ${
                      prefs.home_currency === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </section>

            <section data-guide="pref-pace" className="card-soft p-4">
              <p className="label-caps text-foreground">Daily pace</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {paces.map((p) => (
                  <Chip
                    key={p.value}
                    label={p.value}
                    hint={p.hint}
                    active={prefs.trip_pace === p.value}
                    onClick={() =>
                      void save({ trip_pace: prefs.trip_pace === p.value ? null : p.value })
                    }
                  />
                ))}
              </div>
            </section>

            <section data-guide="pref-countries" className="card-soft p-4">
              <p className="label-caps text-foreground">Countries you love</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Béa leans on these when she suggests where to go next.
              </p>
              {prefs.preferred_countries.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {prefs.preferred_countries.map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        void save({
                          preferred_countries: prefs.preferred_countries.filter((v) => v !== c),
                        })
                      }
                      className="rounded-full border border-primary bg-primary px-3 py-1.5 text-[13px] text-primary-foreground"
                    >
                      {c} ✕
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  value={countryDraft}
                  onChange={(e) => setCountryDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCountry();
                    }
                  }}
                  placeholder="Add a country"
                  className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] outline-none focus:border-primary"
                />
                <button
                  onClick={addCountry}
                  className="rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground"
                >
                  Add
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestedCountries
                  .filter((c) => !prefs.preferred_countries.includes(c))
                  .map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        void save({ preferred_countries: [...prefs.preferred_countries, c] })
                      }
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] text-muted-foreground"
                    >
                      + {c}
                    </button>
                  ))}
              </div>
            </section>

            <section data-guide="pref-interests" className="card-soft p-4">
              <p className="label-caps text-foreground">Interests</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                These are your travel tags — the same ones that weight Opportunities near you.
              </p>
              <div className="mt-3 space-y-4">
                {preferenceGroups.map((group) => (
                  <div key={group.title}>
                    <p className="text-[14.5px] font-medium">{group.title}</p>
                    <p className="text-[12.5px] text-muted-foreground">{group.hint}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          aria-pressed={prefs.preferences.includes(tag)}
                          className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                            prefs.preferences.includes(tag)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <p className="text-[14.5px] font-medium">Your own</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    Anything not listed — add it in your own words.
                  </p>
                  {customTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {customTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => editTags((tags) => tags.filter((t) => t !== tag))}
                          aria-label={`Remove ${tag}`}
                          className="rounded-full border border-primary bg-primary px-3 py-1.5 text-[13px] text-primary-foreground"
                        >
                          {tag} ✕
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      maxLength={CUSTOM_TAG_MAX}
                      placeholder="e.g. Jazz bars, ceramics, rooftop views"
                      className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] outline-none focus:border-primary"
                    />
                    <button
                      onClick={addTag}
                      className="rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground"
                    >
                      Add
                    </button>
                  </div>
                  {tagNotice && (
                    <p role="status" className="mt-2 text-[12.5px] text-muted-foreground">
                      {tagNotice}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section data-guide="pref-rules" className="card-soft p-4">
              <p className="label-caps text-foreground">Hard rules</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Béa will never plan around these. Food needs, allergies, mobility, anything you
                refuse.
              </p>
              <textarea
                value={prefs.dietary_notes ?? ""}
                onChange={(e) => editNote("dietary_notes", e.target.value)}
                onBlur={() => flushNotes.current()}
                rows={2}
                placeholder="Food: e.g. no shellfish, vegetarian dinners"
                className="mt-3 w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] outline-none focus:border-primary"
              />
              <textarea
                value={prefs.avoid_notes ?? ""}
                onChange={(e) => editNote("avoid_notes", e.target.value)}
                onBlur={() => flushNotes.current()}
                rows={2}
                placeholder="Avoid: e.g. long hikes, crowded nightlife, early flights"
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px] outline-none focus:border-primary"
              />
            </section>
          </>
        )}

        <p
          role="status"
          className={`pb-2 text-center text-[13px] ${saveState === "error" ? "font-semibold text-destructive" : "text-muted-foreground"}`}
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved ✓"
              : saveState === "error"
                ? "That didn't save. Check your connection and tap it again."
                : "Everything saves automatically as you tap or type."}
        </p>
      </div>
    </AppShell>
  );
}
