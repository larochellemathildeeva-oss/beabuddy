import type { ReactNode } from "react";
import { Check } from "@/components/icons";
import { PlacePicture } from "@/components/PlacePicture";
import { DayWeather } from "@/components/day/DayWeather";
import type { ItineraryRow } from "@/hooks/useTrips";
import { untilLabel } from "@/lib/home-now";
import { frameStay } from "@/lib/trip-frame";

type Stop = ItineraryRow;

/**
 * The top of Live, as the Figma "Trip companion" frame draws it: where and
 * when, the stop you are at (or are heading to) with the day's progress and
 * the next three, and the next destination with when to leave.
 */
export function LiveStatus({
  place,
  dayLabel,
  selected,
  stops,
}: {
  place: string;
  dayLabel: string;
  /** The stop in focus. */
  selected: string;
  stops: readonly Stop[];
}) {
  return (
    <section className="lv-card flex items-start justify-between gap-3 !p-3">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold">
          {[place, dayLabel].filter(Boolean).join(" · ")}
        </p>
        <p className="truncate text-[12px] text-muted-foreground">
          Live companion{selected ? ` · ${selected} selected stop` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em]">Live companion</p>
        <DayWeather items={stops} />
      </div>
    </section>
  );
}

function Dots({ stops, at }: { stops: readonly Stop[]; at: Stop | null }) {
  return (
    <ol className="lv-dots" aria-label="The day's stops">
      {stops.map((stop, i) => {
        const reached = Boolean(stop.arrived_at);
        const here = stop.id === at?.id;
        return (
          <li key={stop.id} aria-current={here ? "step" : undefined}>
            {i > 0 ? (
              <span aria-hidden className={`lv-line ${reached || here ? "is-on" : ""}`} />
            ) : null}
            <span
              className={`lv-dot ${here ? "is-here" : reached ? "is-done" : ""}`}
              title={stop.title}
            >
              {reached && !here ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function LiveCurrent({
  kicker,
  stop,
  here,
  stops,
  later,
  now,
  onLook,
  children,
}: {
  kicker: string;
  stop: Stop;
  /** True while the traveller has arrived at it. */
  here: boolean;
  stops: readonly Stop[];
  /** The next stops after this one, nearest first. */
  later: readonly Stop[];
  now: Date | null;
  onLook?: ((id: string) => void) | undefined;
  children?: ReactNode;
}) {
  const line = stop.detail?.trim() || stop.address?.trim() || "";
  return (
    <section className="lv-card" aria-labelledby="live-stop">
      <div className="flex gap-3">
        <PlacePicture
          name={stop.title}
          kind={stop.kind}
          lat={stop.lat}
          lon={stop.lon}
          className="h-[110px] w-[84px] shrink-0 rounded-[6px] border border-border"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold">{kicker}</p>
          <h2
            id="live-stop"
            className="mt-1 flex items-center gap-2 text-[20px] font-semibold leading-tight"
          >
            <span aria-hidden className="size-3 shrink-0 rounded-full bg-foreground" />
            <span className="min-w-0 break-words">{stop.title}</span>
          </h2>
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
            {stop.planned_stay_minutes ? <span>{frameStay(stop.planned_stay_minutes)}</span> : null}
            {here ? <span>Here now</span> : null}
          </p>
          {line ? <p className="mt-1.5 line-clamp-3 text-[14px] leading-snug">{line}</p> : null}
        </div>
      </div>
      {stops.length > 1 ? <Dots stops={stops} at={stop} /> : null}
      {later.length > 0 ? (
        <ul className="lv-next3">
          {later.slice(0, 3).map((s, i) => {
            const label = i === 0 ? "Next" : (now && untilLabel(s.time_label, now)) || "Later";
            const body = (
              <>
                <PlacePicture
                  name={s.title}
                  kind={s.kind}
                  lat={s.lat}
                  lon={s.lon}
                  className="size-9 rounded-full border border-border"
                />
                <span className="mt-1 block truncate text-[13px] font-semibold">{s.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{label}</span>
              </>
            );
            return (
              <li key={s.id}>
                {onLook ? (
                  <button type="button" onClick={() => onLook(s.id)} className="w-full text-left">
                    {body}
                  </button>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {children}
    </section>
  );
}

export function LiveNextDestination({
  stop,
  line,
}: {
  stop: Stop;
  /** "Next stop · Leave by 11:20 · 25 min to get there". */
  line: string;
}) {
  return (
    <section className="lv-card" aria-labelledby="live-next">
      <p className="text-[12px] font-semibold">Next destination</p>
      <h2 id="live-next" className="mt-1 text-[22px] font-semibold leading-tight">
        {stop.title}
      </h2>
      {line ? <p className="mt-1 text-[12px] text-muted-foreground">{line}</p> : null}
    </section>
  );
}
