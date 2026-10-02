import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "@/components/icons";
import { startLiveLocation, stopLiveLocation, useLiveLocation } from "@/hooks/useLiveLocation";
import type { ItineraryRow } from "@/hooks/useTrips";
import {
  followAlong,
  followKey,
  fromHere,
  fromHereLine,
  ON_TIME_MINUTES,
  type FollowKind,
  type Sighting,
} from "@/lib/live-companion";
import type { TravelChoice } from "@/lib/travel-mode";

/**
 * "Follow along" on Now: off until asked for, and only while this screen is
 * open. It offers "I'm here" and "Leaving" when the phone's position says
 * so; the traveller's tap is still what saves them, because those marks are
 * on the trip for everyone on it. The position is not sent or kept.
 */
export function FollowAlong({
  dayStops,
  busy,
  now,
  onArrive,
  onLeave,
}: {
  dayStops: ItineraryRow[];
  busy: boolean;
  /** The minute clock, so a wait that has lasted is noticed between readings. */
  now: Date | null;
  onArrive: (stop: ItineraryRow) => void;
  onLeave: (stop: ItineraryRow) => void;
}) {
  const live = useLiveLocation();
  const sighting = useRef<Sighting>(null);
  const dismissed = useRef(new Set<string>());
  const [suggest, setSuggest] = useState<{ kind: FollowKind; stop: ItineraryRow } | null>(null);
  /** Turned on here: then leaving Now turns it off, even if the map is open next. */
  const startedHere = useRef(false);
  useEffect(
    () => () => {
      if (startedHere.current) stopLiveLocation();
    },
    [],
  );
  const start = () => {
    startedHere.current = true;
    startLiveLocation();
  };

  useEffect(() => {
    if (!live.on || !live.fix || live.stale) {
      sighting.current = null;
      setSuggest(null);
      return;
    }
    const out = followAlong(sighting.current, dayStops, live.fix, Date.now(), dismissed.current);
    sighting.current = out.sighting;
    setSuggest(out.suggest);
  }, [live.on, live.fix, live.stale, dayStops, now]);

  const wave = (kind: FollowKind, stop: ItineraryRow) => {
    dismissed.current.add(followKey(kind, stop.id));
    setSuggest(null);
  };

  if (!live.on) {
    return (
      <section aria-labelledby="follow-along" className="plain-card space-y-2 p-3.5">
        <p id="follow-along" className="flex items-center gap-2 text-[13.5px] font-semibold">
          <LocateFixed className="size-4 text-primary" aria-hidden />
          Follow along
        </p>
        <p className="text-[12.5px] text-muted-foreground">
          While this screen is open, Béa can use your location to spot when you reach a stop and say
          if you're running late. It stays on this phone and isn't saved.
        </p>
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-[14px] font-semibold"
        >
          Use my location
        </button>
        {live.error && (
          <p role="alert" className="text-[12.5px] font-semibold text-destructive">
            {live.error}
          </p>
        )}
      </section>
    );
  }

  return (
    <>
      <div className="plain-card flex items-center justify-between gap-2 px-3.5 py-2">
        <p className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
          <LocateFixed className="size-4 shrink-0 text-primary" aria-hidden />
          {live.locating
            ? "Finding you…"
            : live.stale
              ? "Following along · waiting for a new position"
              : "Following along · stays on this phone"}
        </p>
        <button
          type="button"
          onClick={() => {
            startedHere.current = false;
            stopLiveLocation();
          }}
          className="min-h-11 min-w-11 shrink-0 px-2 text-[13px] font-semibold text-primary underline underline-offset-2"
        >
          Stop
        </button>
      </div>
      {suggest && (
        <section role="status" className="plain-card space-y-2 border-primary/40 p-3.5">
          <p className="text-[14.5px] leading-snug">
            {suggest.kind === "arrive" ? "Looks like you're at " : "Looks like you've left "}
            <span className="font-semibold">{suggest.stop.title}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSuggest(null);
                if (suggest.kind === "arrive") onArrive(suggest.stop);
                else onLeave(suggest.stop);
              }}
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {suggest.kind === "arrive" ? "I'm here" : "Leaving"}
            </button>
            <button
              type="button"
              onClick={() => wave(suggest.kind, suggest.stop)}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-[14px] font-semibold text-muted-foreground"
            >
              {suggest.kind === "arrive" ? "Not yet" : "Still here"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * The journey to the next stop from where you are, while following along:
 * "Running about 11 min late · 16 min away · ETA 12:41". An estimate from
 * the distance, worked out on the phone.
 */
export function FromHereLine({
  next,
  travel,
  nowMinutes,
  atAStop,
}: {
  next: ItineraryRow;
  travel: TravelChoice;
  nowMinutes: number;
  atAStop: boolean;
}) {
  const live = useLiveLocation();
  if (!live.on || !live.fix || live.stale) return null;
  const r = fromHere(live.fix, next, travel, nowMinutes);
  if (!r) return null;
  const late = r.lateBy != null && r.lateBy > ON_TIME_MINUTES;
  return (
    <p
      className={`flex items-start gap-1.5 py-1 text-[13px] ${late ? "font-semibold text-destructive" : "text-muted-foreground"}`}
    >
      <LocateFixed className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        {fromHereLine(r, atAStop)}
        <span className="font-normal text-muted-foreground"> · from where you are, estimated</span>
      </span>
    </p>
  );
}
