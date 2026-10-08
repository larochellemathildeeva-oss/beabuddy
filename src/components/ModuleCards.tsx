import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "@/components/icons";
import { usePlaceNow } from "@/hooks/usePlaceNow";
import { describeWeather, localTimeAt, usesFahrenheit } from "@/lib/weather";

type Icon = ComponentType<{ className?: string }>;

export type ModuleAction =
  | { label: string; icon?: Icon; onClick: () => void }
  | {
      label: string;
      icon?: Icon;
      to: string;
      params?: Record<string, string>;
      search?: Record<string, string>;
    };

/**
 * One of the mockups' module cards: a title, a line under it, a picture or
 * whatever the module shows, and a round button in the corner. Two sit side
 * by side; the whole card is the button's target too.
 */
export function ModuleCard({
  title,
  label,
  big,
  headline,
  sub,
  art,
  tone,
  action,
  children,
  guide,
}: {
  title: string;
  /** The small mono label shown instead of the title, when the title is the longer name. */
  label?: string;
  /** One large figure (a count, a temperature) under the label. */
  big?: ReactNode;
  /** A line in the headline face, larger than `sub`. */
  headline?: ReactNode;
  sub?: ReactNode;
  /** A picture filling the right-hand panel of the card. */
  art?: string | null;
  /** A pastel ground (tile-fill-N), kept for Colorful. */
  tone?: number;
  action?: ModuleAction;
  children?: ReactNode;
  guide?: string;
}) {
  const ActionIcon = action?.icon ?? ArrowRight;
  const button = action ? (
    <span className="module-card-action absolute bottom-3 right-3 grid size-11 place-items-center bg-card text-foreground">
      <ActionIcon className="size-5" aria-hidden />
    </span>
  ) : null;
  const body = (
    <>
      <span className="relative flex min-w-0 flex-1 flex-col">
        <span className="label-caps block">{label ?? title}</span>
        {big ? <span className="module-big mt-1.5 block font-bold tabular-nums">{big}</span> : null}
        {headline ? (
          <span className="mt-1.5 block text-[20px] leading-[1.4]">{headline}</span>
        ) : null}
        {sub && <span className="mt-1.5 block text-[14px] leading-[1.4]">{sub}</span>}
        {children && <span className="relative mt-2 block">{children}</span>}
      </span>
      {art && (
        <span className="module-photo relative -my-4 -mr-4 ml-4 block w-[112px] shrink-0 self-stretch overflow-hidden">
          <img src={art} alt="" className="art-dim absolute inset-0 size-full object-cover" />
        </span>
      )}
      {button}
    </>
  );
  const cls = `relative flex min-h-[168px] w-full overflow-hidden border border-border p-4 text-left ${
    tone ? `tile-fill-${tone}` : "bg-card"
  }`;
  if (!action) {
    return (
      <section data-guide={guide} className={cls}>
        {body}
      </section>
    );
  }
  if ("to" in action) {
    return (
      <Link
        data-guide={guide}
        to={action.to}
        params={action.params as never}
        search={action.search as never}
        aria-label={`${title}: ${action.label}`}
        className={cls}
      >
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      data-guide={guide}
      onClick={action.onClick}
      aria-label={`${title}: ${action.label}`}
      className={cls}
    >
      {body}
    </button>
  );
}

function temperature(celsius: number): string {
  const f = usesFahrenheit(typeof navigator === "undefined" ? undefined : navigator.language);
  return f ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${celsius}°C`;
}

/** The time now, moved on at each new minute while the card is open. */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(
        () => {
          setNow(new Date());
          next();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    next();
    return () => window.clearTimeout(timer);
  }, []);
  return now;
}

/** What a weather card says while it has no answer to show. */
function waitingLine(now: ReturnType<typeof usePlaceNow>): string {
  if (now.status === "unplaced") return "Béa needs the town's position first.";
  if (now.status === "unavailable") return "The weather there can't be read right now.";
  return "Asking the sky…";
}

/** "Right now there": the clock and the sky now in a place. */
export function NowThereCard({
  place,
  lat,
  lon,
  art,
  action,
  guide,
}: {
  place: string;
  lat: number | null;
  lon: number | null;
  art: string | null;
  action?: ModuleAction;
  guide?: string;
}) {
  const now = usePlaceNow(lat, lon);
  const minute = useMinute();
  const weather = now.status === "ready" ? now.weather : null;
  const time = weather?.utcOffset !== undefined ? localTimeAt(weather.utcOffset, minute) : null;
  return (
    <ModuleCard
      title="Right now there"
      sub={<span className="font-medium text-primary">Live from {place}</span>}
      art={art}
      {...(action ? { action } : {})}
      {...(guide ? { guide } : {})}
    >
      {weather ? (
        <span className="module-weather-reading mt-[52px] inline-flex flex-col rounded-xl bg-black/45 px-2.5 py-1.5 text-white backdrop-blur-sm">
          {time && (
            <span className="text-[17px] font-semibold tabular-nums leading-tight">{time}</span>
          )}
          <span className="text-[12px] leading-tight">
            {temperature(weather.temp)} · {describeWeather(weather.code).label}
          </span>
        </span>
      ) : now.status === "unavailable" ? (
        <span className="block text-[13px] text-muted-foreground">{waitingLine(now)}</span>
      ) : null}
    </ModuleCard>
  );
}

/** "Weather there": today's sky where the trip is. */
export function WeatherThereCard({
  place,
  lat,
  lon,
  art,
  guide,
}: {
  place: string;
  lat: number | null;
  lon: number | null;
  art: string | null;
  guide?: string;
}) {
  const now = usePlaceNow(lat, lon);
  const weather = now.status === "ready" ? now.weather : null;
  return (
    <ModuleCard
      title="Weather there"
      art={art}
      big={weather ? temperature(weather.temp) : undefined}
      sub={
        weather
          ? `${place} · ${describeWeather(weather.code).label}${
              weather.high !== null && weather.low !== null
                ? ` · ${temperature(weather.high)} / ${temperature(weather.low)}`
                : ""
            }`
          : place
      }
      {...(guide ? { guide } : {})}
    >
      {weather ? null : (
        <span className="block text-[13px] text-muted-foreground">{waitingLine(now)}</span>
      )}
    </ModuleCard>
  );
}
