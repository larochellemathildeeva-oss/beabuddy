import { useEffect, useRef, useState } from "react";
import { loadingLine, type BeaAction, type BeaWork } from "@/lib/bea-personality";
import { beaRecent, rememberBeaLine, useBeaSettings } from "@/hooks/useBeaSettings";

/** Not shown for waits shorter than this, so a quick answer never flashes it. */
const SHOW_AFTER_MS = 300;
/** Once shown, it stays at least this long, so it never flickers. */
const MIN_VISIBLE_MS = 650;
/** A new line no sooner than this. */
const ROTATE_MS = 9000;
/** A long wait may earn the rare ball (or, while digging, bone) once. */
const EASTER_EGG_AFTER_MS = 20000;
const EASTER_EGG_CHANCE = 0.08;

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    setReduce(query.matches);
    const on = (e: MediaQueryListEvent) => setReduce(e.matches);
    query.addEventListener?.("change", on);
    return () => query.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

/**
 * Whether the loader shows: only after a short delay, and then for a minimum
 * time, so fast work never flashes it and slow work never flickers it.
 */
function useShown(active: boolean): boolean {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (active) {
      const t = window.setTimeout(() => {
        since.current = Date.now();
        setShown(true);
      }, SHOW_AFTER_MS);
      return () => window.clearTimeout(t);
    }
    if (!shown) return;
    const left = Math.max(0, MIN_VISIBLE_MS - (Date.now() - since.current));
    const t = window.setTimeout(() => setShown(false), left);
    return () => window.clearTimeout(t);
  }, [active, shown]);
  return shown;
}

/**
 * "Béa is working on it…" — the one loader for every wait where Béa is
 * actually doing something: a small animation of what she is doing, one line
 * in the traveller's chosen personality, and four dots.
 *
 * `status` is the real step, when the work has one ("Placing your stops…"):
 * the joke is never the only word on what is happening. `serious` keeps the
 * line plain. Reduce Motion gets the still picture and no rotation.
 */
export function BeaLoader({
  active,
  action,
  status,
  serious = false,
  compact = false,
}: {
  active: boolean;
  action: BeaWork;
  status?: string | undefined;
  serious?: boolean;
  compact?: boolean;
}) {
  const settings = useBeaSettings();
  const shown = useShown(active);
  const reduce = useReducedMotion();
  const [pose, setPose] = useState<BeaAction>(action);
  const [line, setLine] = useState("");

  useEffect(() => {
    if (!shown) return;
    const start = Date.now();
    let egged = false;
    const say = (a: BeaAction) => {
      const next = loadingLine({ action: a, settings, recent: beaRecent(), serious });
      rememberBeaLine(next);
      setLine(next);
    };
    setPose(action);
    say(action);
    if (reduce) return;
    const timer = window.setInterval(() => {
      const long = Date.now() - start > EASTER_EGG_AFTER_MS;
      if (!egged && long && !serious && settings.surprises && Math.random() < EASTER_EGG_CHANCE) {
        egged = true;
        const egg: BeaAction = action === "dig" && Math.random() < 0.5 ? "bone" : "ball";
        setPose(egg);
        say(egg);
        return;
      }
      // After the Easter egg, straight back to the work.
      setPose(action);
      say(action);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [shown, action, serious, reduce, settings]);

  if (!shown) return null;
  const size = compact ? "size-12" : "size-24";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Béa is working on it"
      className={`flex flex-col items-center text-center ${compact ? "gap-1.5 py-3" : "gap-3 py-8"}`}
    >
      <img
        src={reduce ? `/bea/bea-${pose}-static.png` : `/bea/bea-${pose}.webp`}
        alt=""
        aria-hidden
        className={`${size} object-contain`}
      />
      <p className={`font-display leading-tight ${compact ? "text-[18px]" : "text-[26px]"}`}>
        Béa is working on it…
      </p>
      {status ? <p className="text-[13px] font-semibold text-foreground/80">{status}</p> : null}
      {line ? (
        <p className="max-w-[18rem] text-[13.5px] leading-snug text-muted-foreground">{line}</p>
      ) : null}
      <span aria-hidden className="bea-dots mt-1 flex gap-1.5">
        <span />
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
