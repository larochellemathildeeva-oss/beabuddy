import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { safeStorage } from "@/lib/tour-state";
import { readTryPlan, savePendingTryPlan, TRY_PLAN_PRESETS, tryKindLabel } from "@/lib/try-plan";

/** Where a saved try lands once the account exists: a new trip, its import open. */
const AFTER_SIGN_UP = "/trips?new=true&plan=import&from=try";

/**
 * Pick a ready-made trip, see it as days — before any account. Preset rather
 * than pasted (`TRY_PLAN_PRESETS`), so a visitor's first result is a clean one;
 * read in the browser by the plain-list reader, so nothing is sent anywhere
 * until they sign up and save it.
 */
export function LandingTryPlan() {
  const navigate = useNavigate();
  const [presetId, setPresetId] = useState(TRY_PLAN_PRESETS[0]?.id ?? "");
  const [notKept, setNotKept] = useState(false);
  const preset = TRY_PLAN_PRESETS.find((p) => p.id === presetId) ?? TRY_PLAN_PRESETS[0];
  const read = useMemo(() => (preset ? readTryPlan(preset.text) : null), [preset]);

  if (!preset || !read) return null;

  const save = () => {
    // Without storage the plan cannot wait through sign-up: say so rather
    // than arrive at an empty import.
    if (!savePendingTryPlan(safeStorage(), preset.text)) {
      setNotKept(true);
      return;
    }
    void navigate({ to: "/auth", search: { mode: "signup", redirect: AFTER_SIGN_UP } });
  };

  const stops = read.days.reduce((n, d) => n + d.items.length, 0);

  return (
    <section className="surface border border-border/50 p-4">
      <p className="label-caps">Try it, no account</p>
      <h2 className="mt-1 font-display text-[22px] leading-tight">Pick a trip to start from.</h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
        Save it and Béa pins every stop on a map and gives directions between them. Change anything
        once it's yours.
      </p>

      <div role="radiogroup" aria-label="Sample trip" className="mt-3 grid grid-cols-3 gap-2">
        {TRY_PLAN_PRESETS.map((p) => {
          const on = p.id === preset.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setPresetId(p.id);
                setNotKept(false);
              }}
              className={`min-h-[var(--h-button)] rounded-[var(--r-button)] border px-2 text-[14.5px] font-semibold ${
                on ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-4" aria-live="polite">
        <p className="text-[13.5px] text-muted-foreground">
          {preset.blurb} · {stops} stops
        </p>
        {read.days.map((day) => (
          <div key={day.day}>
            <p className="font-display text-[18px] leading-snug">Day {day.day}</p>
            <ol className="mt-1.5 space-y-1.5">
              {day.items.map((item, i) => (
                <li key={`${item.title}-${i}`} className="flex items-baseline gap-2 text-[14px]">
                  <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                    {item.time_label ?? ""}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold leading-snug">{item.title}</span>
                  <span className="shrink-0 text-[12px] text-muted-foreground">
                    {tryKindLabel(item.kind)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
        <div className="space-y-2 border-t border-border/50 pt-4">
          <button type="button" onClick={save} className="btn-primary w-full px-4 text-[14.5px]">
            Start free with this {preset.label} trip
          </button>
          {notKept && (
            <p className="text-[13px] leading-relaxed text-destructive" role="alert">
              This browser won't keep the trip while you sign up (a private window can do that).
              Create your account and Béa will help you plan one from there.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
