import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { preferenceGroups } from "@/data/atlas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/preferences")({
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
      <span className="block text-[12.5px] font-medium">{label}</span>
      {hint && (
        <span
          className={`block text-[11px] ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

function PreferencesPage() {
  const { user, loading } = useAuth();
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
  const [saved, setSaved] = useState(false);

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
      .then(({ data }) => {
        if (!active || !data) return;
        setPrefs({
          preferences: data.preferences ?? [],
          travel_style: data.travel_style,
          budget_level: data.budget_level,
          trip_pace: data.trip_pace,
          preferred_countries: data.preferred_countries ?? [],
          dietary_notes: data.dietary_notes ?? "",
          avoid_notes: data.avoid_notes ?? "",
          home_currency: data.home_currency,
        });
      });
    return () => {
      active = false;
    };
  }, [user]);

  const save = async (patch: Partial<Prefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    if (!user) return;
    await supabase.from("profiles").upsert({ id: user.id, ...patch });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const addCountry = () => {
    const value = countryDraft.trim();
    if (!value) return;
    if (!prefs.preferred_countries.includes(value))
      void save({ preferred_countries: [...prefs.preferred_countries, value] });
    setCountryDraft("");
  };

  return (
    <AppShell eyebrow="Béa's brain" title="Travel preferences">
      <div className="space-y-4">
        <p className="text-[13px] text-muted-foreground">
          Everything here goes straight into Béa's planning. The more you set, the closer her
          itineraries, restaurant picks and trip comparisons land to what you actually want.
        </p>

        {!loading && !user && (
          <div className="card-soft p-4 text-[13px]">
            <p className="font-medium">Sign in to save your preferences</p>
            <Link to="/auth" className="mt-2 inline-block font-semibold text-primary underline">
              Sign in
            </Link>
          </div>
        )}

        <section data-guide="pref-style" className="card-soft p-4">
          <p className="label-caps text-foreground">Travel style</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Pick as many as feel true.</p>
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
          <p className="label-caps mt-4 text-foreground">Show prices in</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {currencies.map((c) => (
              <button
                key={c}
                onClick={() =>
                  void save({ home_currency: prefs.home_currency === c ? null : c })
                }
                aria-pressed={prefs.home_currency === c}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${
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
          <p className="mt-1 text-[12px] text-muted-foreground">
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
                  className="rounded-full border border-primary bg-primary px-3 py-1.5 text-[12px] text-primary-foreground"
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
              className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
            />
            <button
              onClick={addCountry}
              className="rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
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
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] text-muted-foreground"
                >
                  + {c}
                </button>
              ))}
          </div>
        </section>

        <section data-guide="pref-interests" className="card-soft p-4">
          <p className="label-caps text-foreground">Interests</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            These are your travel tags — the same ones that weight Opportunities near you.
          </p>
          <div className="mt-3 space-y-4">
            {preferenceGroups.map((group) => (
              <div key={group.title}>
                <p className="text-[13px] font-medium">{group.title}</p>
                <p className="text-[11.5px] text-muted-foreground">{group.hint}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        void save({ preferences: toggleIn(prefs.preferences, tag) })
                      }
                      aria-pressed={prefs.preferences.includes(tag)}
                      className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
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
          </div>
        </section>

        <section data-guide="pref-rules" className="card-soft p-4">
          <p className="label-caps text-foreground">Hard rules</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Béa will never plan around these. Food needs, allergies, mobility, anything you refuse.
          </p>
          <textarea
            value={prefs.dietary_notes ?? ""}
            onChange={(e) => setPrefs((p) => ({ ...p, dietary_notes: e.target.value }))}
            onBlur={() => void save({ dietary_notes: prefs.dietary_notes })}
            rows={2}
            placeholder="Food: e.g. no shellfish, vegetarian dinners"
            className="mt-3 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
          />
          <textarea
            value={prefs.avoid_notes ?? ""}
            onChange={(e) => setPrefs((p) => ({ ...p, avoid_notes: e.target.value }))}
            onBlur={() => void save({ avoid_notes: prefs.avoid_notes })}
            rows={2}
            placeholder="Avoid: e.g. long hikes, crowded nightlife, early flights"
            className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
          />
        </section>

        <p className="pb-2 text-center text-[12px] text-muted-foreground">
          {saved ? "Saved ✓" : "Everything saves as you tap."}
        </p>
      </div>
    </AppShell>
  );
}
