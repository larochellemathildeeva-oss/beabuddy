import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { safeStorage } from "@/lib/tour-state";
import {
  readTryPlan,
  savePendingTryPlan,
  TRY_PLAN_MAX,
  TRY_PLAN_SAMPLE,
  tryKindLabel,
  type TryRead,
} from "@/lib/try-plan";

/** Where a saved try lands once the account exists: a new trip, its import open. */
const AFTER_SIGN_UP = "/trips?new=true&plan=import&from=try";

/**
 * Paste a plan, see it as days — before any account. Read in the browser by
 * the plain-list reader alone (`try-plan.ts`), so nothing is sent anywhere
 * until the visitor signs up and saves it.
 */
export function LandingTryPlan() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [read, setRead] = useState<TryRead | null>(null);
  /** The text the preview was read from: what Save keeps. */
  const [readText, setReadText] = useState("");
  const [missed, setMissed] = useState(false);
  const [notKept, setNotKept] = useState(false);

  const readIt = (value: string) => {
    const result = readTryPlan(value);
    setRead(result);
    setReadText(result ? value : "");
    setMissed(!result);
    setNotKept(false);
  };

  const trySample = () => {
    setText(TRY_PLAN_SAMPLE);
    readIt(TRY_PLAN_SAMPLE);
  };

  const save = () => {
    // Without storage the plan cannot wait through sign-up: say so rather
    // than arrive at an empty import.
    if (!savePendingTryPlan(safeStorage(), readText)) {
      setNotKept(true);
      return;
    }
    void navigate({ to: "/auth", search: { mode: "signup", redirect: AFTER_SIGN_UP } });
  };

  const stops = read?.days.reduce((n, d) => n + d.items.length, 0) ?? 0;

  return (
    <section className="surface border border-border/50 p-4">
      <p className="label-caps">Try it, no account</p>
      <h2 className="mt-1 font-display text-[22px] leading-tight">
        Paste a plan you already have.
      </h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
        Béa reads it right here on your device.
      </p>
      <label htmlFor="try-plan" className="mt-3 block text-[13.5px] font-semibold">
        Your plan: one stop per line with a time, days as headings
      </label>
      <textarea
        id="try-plan"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // The preview belongs to the text it was read from.
          setRead(null);
          setMissed(false);
          setNotKept(false);
        }}
        maxLength={TRY_PLAN_MAX}
        rows={6}
        placeholder={
          "Day 1 — Lisbon\n09:30 Pastéis de Belém\n12:30 Lunch at Time Out Market\n15:00 Alfama wander"
        }
        className="mt-1.5 w-full rounded-[var(--r-card)] border border-border bg-card p-3 text-[16px] leading-snug outline-none focus:border-primary"
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => readIt(text)}
          disabled={!text.trim()}
          className="btn-primary px-4 text-[14.5px] disabled:opacity-60"
        >
          Read my plan
        </button>
        <button
          type="button"
          onClick={trySample}
          className="min-h-[var(--h-button)] rounded-[var(--r-button)] border border-border px-4 text-[14.5px] font-semibold"
        >
          Use a sample plan
        </button>
      </div>

      {missed && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground" role="status">
          Béa reads tidy lists here: a time, then the stop, one per line. Notes, emails, links and
          screenshots she reads once you have an account.
        </p>
      )}

      {read && (
        <div className="mt-4 space-y-4" aria-live="polite">
          <p className="text-[13.5px] text-muted-foreground">
            {stops} {stops === 1 ? "stop" : "stops"} over {read.days.length}{" "}
            {read.days.length === 1 ? "day" : "days"}
            {read.plan.trip_title ? ` · ${read.plan.trip_title}` : ""}
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
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              Save it and Béa pins every stop on a map and gives directions between them.
            </p>
            <button type="button" onClick={save} className="btn-primary w-full px-4 text-[14.5px]">
              Save this trip — start free
            </button>
            {notKept && (
              <p className="text-[13px] leading-relaxed text-destructive" role="alert">
                This browser won't keep the plan while you sign up (a private window can do that).
                Copy it, create your account, then paste it into a new trip.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
