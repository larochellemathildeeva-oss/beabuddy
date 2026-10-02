import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Check, Globe, Navigation, Route, X } from "@/components/icons";
import { ThemePicker } from "@/components/ThemePicker";
import { startWalk } from "@/lib/tour-start";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { safeStorage } from "@/lib/tour-state";
import { TRAVEL_STYLES, TRIP_PACES } from "@/lib/travel-style-options";
import {
  markWelcomeDone,
  shouldShowWelcome,
  WELCOME_DONE_KEY,
  WELCOME_DONE_META,
  WELCOME_GOALS,
  type WelcomeGoal,
} from "@/lib/welcome";

const STEPS = ["intro", "goal", "style", "look", "ready"] as const;

/** Tell the account the welcome is done, for every other device. */
async function markAccountDone(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.updateUser({ data: { [WELCOME_DONE_META]: true } });
    return !error;
  } catch {
    return false;
  }
}
type Step = (typeof STEPS)[number];

/**
 * The first thing a new account sees: what Béa does, what they came for, how
 * they travel and a look — five short screens, every one skippable — ending
 * on their first real step, or a walk that shows them how.
 */
export function Welcome() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  /** The account the welcome is showing for; null while closed. */
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("intro");
  const [goal, setGoal] = useState<WelcomeGoal>(WELCOME_GOALS[0]!);
  const [style, setStyle] = useState<string | null>(null);
  const [pace, setPace] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /**
   * Closed in this page load, whatever storage did with the mark: a browser
   * that refuses storage would otherwise reopen it on every page.
   */
  const dismissed = useRef<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Numbers each save, so only the latest one's answer counts. */
  const saveSeq = useRef(0);
  /** The save still on its way, if any: finishing waits for it. */
  const pendingSave = useRef<Promise<boolean> | null>(null);
  /** Accounts whose account-level mark was already retried this page load. */
  const markRetried = useRef<Set<string>>(new Set());

  const userId = user?.id ?? null;
  const doneOnAccount = user?.user_metadata?.[WELCOME_DONE_META] === true;

  useEffect(() => {
    // A different account (or none) never inherits another's welcome.
    if (openFor && openFor !== userId) {
      setOpenFor(null);
      setStep("intro");
      setGoal(WELCOME_GOALS[0]!);
      setStyle(null);
      setPace(null);
      setSaveFailed(false);
      saveSeq.current += 1;
      pendingSave.current = null;
      return;
    }
    // Closed on this device, but the account never heard (the write failed):
    // try once more, so the next device does not ask again.
    if (
      userId &&
      !doneOnAccount &&
      !markRetried.current.has(userId) &&
      safeStorage().getItem(`${WELCOME_DONE_KEY}:${userId}`) === "yes"
    ) {
      markRetried.current.add(userId);
      void markAccountDone();
    }
    if (openFor || !userId || dismissed.current.has(userId)) return;
    const show = shouldShowWelcome(safeStorage(), {
      userId,
      createdAt: user?.created_at,
      path: pathname,
      now: Date.now(),
      doneOnAccount,
    });
    if (show) setOpenFor(userId);
  }, [userId, user?.created_at, pathname, openFor, doneOnAccount]);

  // A modal holds the keyboard: focus moves in, Tab stays in, and it goes
  // back where it was on close.
  const open = openFor !== null && openFor === userId;
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    // After the portal paints, or the page keeps the focus it had. The panel
    // takes it, ringed for keyboard users.
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialog) return;
      const items = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
        ),
      ];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === panelRef.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [open]);

  if (!open || !user || typeof document === "undefined") return null;

  const close = () => {
    dismissed.current.add(user.id);
    markWelcomeDone(safeStorage(), user.id);
    // On the account too, so another device does not ask again. If that
    // fails, the next visit here tries again (above).
    void markAccountDone();
    setOpenFor(null);
  };

  /** Leave the welcome, once any style save has answered: a failure shows first. */
  const finish = async (then: () => void) => {
    const saving = pendingSave.current;
    // A failure stops the first tap, to show its message; the next tap goes.
    pendingSave.current = null;
    if (saving && !(await saving)) return;
    close();
    then();
  };

  const saveStyle = () => {
    const seq = ++saveSeq.current;
    setSaveFailed(false);
    if (!style && !pace) {
      pendingSave.current = null;
      return;
    }
    const forAccount = user.id;
    const saving = Promise.resolve(
      supabase.from("profiles").upsert({
        id: forAccount,
        ...(style ? { travel_style: style } : {}),
        ...(pace ? { trip_pace: pace } : {}),
      }),
    ).then(
      ({ error }) => !error,
      () => false,
    );
    pendingSave.current = saving.then((ok) => {
      // Only the latest save gets a say; a change of account bumps the count,
      // so an earlier account's answer never lands here.
      if (seq !== saveSeq.current) return true;
      setSaveFailed(!ok);
      return ok;
    });
  };

  const index = STEPS.indexOf(step);
  const next = () => {
    if (step === "style") saveStyle();
    setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]!);
  };
  const back = () => setStep(STEPS[Math.max(index - 1, 0)]!);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Béa"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 sm:items-center"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-[460px] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex gap-1.5" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
            {STEPS.map((s, n) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  n === index
                    ? "w-6 bg-primary"
                    : n < index
                      ? "w-1.5 bg-primary"
                      : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close the welcome"
            className="-mr-2 grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-elevated"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-2 pt-3">
          {step === "intro" && (
            <div className="space-y-4">
              <img
                src="/bea/bea-run-static.png"
                alt=""
                className="art-dim mx-auto size-28 object-contain"
              />
              <h2 className="text-center font-display text-[27px] leading-tight">Welcome to Béa</h2>
              <p className="text-center text-[15px] text-muted-foreground">
                Your travel buddy, from the first idea to the last photo.
              </p>
              <ul className="space-y-3">
                {[
                  {
                    Icon: Route,
                    title: "Plans your trips",
                    body: "Day by day, from the places you've saved and how you like to travel.",
                  },
                  {
                    Icon: Navigation,
                    title: "Helps on the way",
                    body: "Today's plan, directions and your bookings. Keep a trip offline for when there's no signal.",
                  },
                  {
                    Icon: Globe,
                    title: "Remembers where you've been",
                    body: "Every country, city and photo on your own globe.",
                  },
                ].map(({ Icon, title, body }) => (
                  <li key={title} className="flex gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold">{title}</span>
                      <span className="block text-[13.5px] text-muted-foreground">{body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === "goal" && (
            <div className="space-y-3">
              <h2 className="font-display text-[24px] leading-tight">What brings you here?</h2>
              <p className="text-[14.5px] text-muted-foreground">
                Pick one to start with. Everything else is a tap away later.
              </p>
              <div role="radiogroup" aria-label="What brings you here" className="space-y-2">
                {WELCOME_GOALS.map((g) => {
                  const on = g.id === goal.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setGoal(g)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                        on ? "border-primary bg-primary-soft" : "border-border bg-card"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">{g.title}</span>
                        <span className="block text-[13px] text-muted-foreground">{g.hint}</span>
                      </span>
                      {on && <Check className="size-5 shrink-0 text-primary" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "style" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-[24px] leading-tight">How do you travel?</h2>
                <p className="mt-1 text-[14.5px] text-muted-foreground">
                  Béa reads this every time she plans. Change it any time in Travel preferences.
                </p>
              </div>
              <div>
                <p className="label-caps mb-2 text-foreground">Your style</p>
                <div className="flex flex-wrap gap-2">
                  {TRAVEL_STYLES.map((option) => (
                    <Choice
                      key={option.value}
                      label={option.value}
                      active={style === option.value}
                      onClick={() => setStyle(style === option.value ? null : option.value)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="label-caps mb-2 text-foreground">Your pace</p>
                <div className="grid grid-cols-3 gap-2">
                  {TRIP_PACES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={pace === option.value}
                      onClick={() => setPace(pace === option.value ? null : option.value)}
                      className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                        pace === option.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      <span className="block text-[14.5px] font-semibold">{option.value}</span>
                      <span
                        className={`block text-[12px] ${
                          pace === option.value
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "look" && (
            <div className="space-y-3">
              <h2 className="font-display text-[24px] leading-tight">Pick a look</h2>
              <p className="text-[14.5px] text-muted-foreground">
                It follows you to every device you sign in on. You → Appearance changes it later.
              </p>
              <ThemePicker />
            </div>
          )}

          {step === "ready" && (
            <div className="space-y-3 text-center">
              <img
                src="/bea/bea-ball-static.png"
                alt=""
                className="art-dim mx-auto size-24 object-contain"
              />
              <h2 className="font-display text-[26px] leading-tight">You're all set</h2>
              <p className="text-[14.5px] text-muted-foreground">
                {goal.id === "plan"
                  ? "Tell Béa where and when, and she drafts the days. Nothing saves until you say so."
                  : goal.id === "import"
                    ? "Paste it, or add a photo or PDF. Béa pins each stop she finds and marks any to check."
                    : goal.id === "save"
                      ? "Type a name or paste a link. Béa finds the place and keeps who told you."
                      : "Add the cities you've been to, or let your photos fill the globe in."}
              </p>
              {saveFailed && (
                <p role="status" className="text-[13px] font-medium text-destructive">
                  Your style and pace didn't save. Set them any time in You → Travel preferences.
                </p>
              )}
              <p className="text-[13px] text-muted-foreground">
                Help, under the ? on every page, has a walk for everything else.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 px-5 py-4">
          {step === "ready" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void finish(() => void navigate({ to: goal.to }));
                }}
                className="btn-primary px-4 py-3 text-[15px]"
              >
                {goal.go}
              </button>
              <button
                type="button"
                onClick={() => {
                  void finish(() => startWalk(goal.id));
                }}
                className="rounded-full border border-border px-4 py-2.5 text-[14.5px] font-semibold"
              >
                Show me how first
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className="flex-1 rounded-full border border-border px-4 py-2.5 text-[14.5px] font-semibold"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="btn-primary flex-[2] px-4 py-2.5 text-[15px]"
              >
                {step === "intro"
                  ? "Let's go"
                  : step === "style" && !style && !pace
                    ? "Skip for now"
                    : "Next"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Choice({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      }`}
    >
      {label}
    </button>
  );
}
