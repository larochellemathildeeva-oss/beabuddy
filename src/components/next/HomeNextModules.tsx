import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Coins,
  Download,
  Languages,
  LayoutGrid,
  Plus,
  Quote,
  Train,
} from "@/components/icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { HomeTripContext } from "@/hooks/useHomeTripModules";
import { HOME_SECTIONS, type HomeSectionKey } from "@/hooks/useHomeLayout";
import { useHomeNextLayout } from "@/hooks/useHomeNextLayout";
import { usePlaceNow } from "@/hooks/usePlaceNow";
import type { TripRow } from "@/hooks/useTrips";
import { bannerArtUrl } from "@/lib/banner-art";
import { HOME_STATE_LABEL, HOME_STATES, type HomeState } from "@/lib/home-next-layout";
import { placeArtFor, placeArtUrl } from "@/lib/place-art";
import { describeWeather, localTimeAt, usesFahrenheit } from "@/lib/weather";

type Icon = ComponentType<{ className?: string }>;

type Action =
  | {
      label: string;
      icon?: Icon;
      to: string;
      params?: Record<string, string>;
      search?: Record<string, string>;
    }
  | { label: string; icon?: Icon; href: string };

/**
 * A module tile of the references' "Customizable trip home" board: the
 * title in serif, a line under it, a picture filling the lower part (or a
 * pastel ground in Colorful), and a round glass button in the corner. Two
 * sit side by side; the whole tile is the button's target.
 */
function NextModuleCard({
  title,
  sub,
  art,
  tone,
  action,
  children,
  guide,
}: {
  title: string;
  sub?: ReactNode;
  art?: string | null;
  tone?: 1 | 2 | 3 | 4 | 5;
  action?: Action;
  children?: ReactNode;
  guide?: string;
}) {
  const ActionIcon = action?.icon ?? ArrowRight;
  const body = (
    <>
      {art ? (
        <span className="absolute inset-x-0 bottom-0 h-[64%]">
          <img src={art} alt="" decoding="async" className="art-dim size-full object-cover" />
          <span aria-hidden className="hn-module-fade absolute inset-0" />
        </span>
      ) : null}
      <span className="relative block pe-1">
        <span className="block font-display text-[20px] leading-[1.1]">{title}</span>
        {sub ? (
          <span className="mt-1 block text-[13.5px] leading-snug text-muted-foreground">{sub}</span>
        ) : null}
      </span>
      {children ? <span className="relative mt-2.5 block">{children}</span> : null}
      {action ? (
        <span className="hn-module-btn absolute bottom-3 right-3">
          <ActionIcon className="size-5" aria-hidden />
        </span>
      ) : null}
    </>
  );
  const cls = `hn-module ${art ? "" : tone ? `hn-module-tone tile-fill-${tone}` : ""}`;
  if (!action) {
    return (
      <section data-guide={guide} className={cls}>
        {body}
      </section>
    );
  }
  if ("href" in action) {
    return (
      <a
        data-guide={guide}
        href={action.href}
        target="_blank"
        rel="noreferrer"
        aria-label={`${title}: ${action.label}`}
        className={cls}
      >
        {body}
      </a>
    );
  }
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

function temperature(celsius: number): string {
  const f = usesFahrenheit(typeof navigator === "undefined" ? undefined : navigator.language);
  return f ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;
}

/** The time now, moved on at each new minute while the tile is open. */
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

function waitingLine(status: ReturnType<typeof usePlaceNow>["status"]): string {
  if (status === "unplaced") return "Béa needs the town's position first.";
  if (status === "unavailable") return "The weather there can't be read right now.";
  return "Asking the sky…";
}

/**
 * One trip module, as the traveller arranged them: the same modules, data
 * and links as Home's (`HomeTripModule`), drawn as the references' tiles.
 */
export function HomeNextModule({
  module: key,
  trip,
  ctx,
  me,
}: {
  module: HomeSectionKey;
  trip: TripRow;
  ctx: HomeTripContext;
  me: { id: string | null; name: string };
}): ReactNode {
  switch (key) {
    case "saved":
      return (
        <NextModuleCard
          guide="home-module-saved"
          title="Saved for this trip"
          sub={`${ctx.savedHere.length} ${ctx.savedHere.length === 1 ? "place" : "places"}`}
          art={ctx.art}
          action={{ label: "Open your saved places", icon: Bookmark, to: "/recommendations" }}
        />
      );
    case "now":
      return (
        <NowThere
          place={ctx.here.city || trip.title}
          lat={ctx.here.lat}
          lon={ctx.here.lon}
          art={ctx.art}
        />
      );
    case "weatherThere":
      return (
        <WeatherThere
          place={ctx.here.city || trip.title}
          lat={ctx.here.lat}
          lon={ctx.here.lon}
          art={ctx.art}
        />
      );
    case "group":
      return (
        <NextModuleCard
          guide="home-module-group"
          title="Group plans"
          sub={`${ctx.people.length} ${ctx.people.length === 1 ? "person" : "people"}`}
          tone={3}
          action={{
            label: "Invite someone",
            icon: Plus,
            to: "/trips/$tripId",
            params: { tripId: trip.id },
            search: { menu: "invite" },
          }}
        >
          <span className="flex -space-x-2.5">
            {ctx.people.slice(0, 4).map((m) => (
              <span key={m.id} className="hn-face" aria-hidden>
                {(m.display_name?.trim() || (m.user_id === me.id ? me.name : "") || "T")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </span>
            ))}
          </span>
        </NextModuleCard>
      );
    case "tools":
      return <TripTools trip={trip} />;
    case "detour":
      return ctx.detour ? (
        <NextModuleCard
          guide="home-module-detour"
          title="Worth a detour"
          sub={ctx.detour.name}
          art={placeArtUrl(placeArtFor(ctx.detour))}
          action={{ label: "Open your saved places", to: "/recommendations" }}
        />
      ) : (
        <NextModuleCard
          guide="home-module-detour"
          title="Worth a detour"
          sub="Save a place in this trip's towns and Béa keeps it here until it's in the plan."
          tone={4}
          action={{ label: "Save a place", to: "/recommendations" }}
        />
      );
    case "notes":
      return (
        <NextModuleCard guide="home-module-notes" title="Notes from Béa" tone={5}>
          <span className="hn-note-icon">
            <Quote className="size-5" aria-hidden />
          </span>
          <span className="mt-2 block font-display text-[16px] italic leading-snug">
            “{ctx.note}”
          </span>
        </NextModuleCard>
      );
    default:
      return null;
  }
}

/** "Right now there": the clock and the sky now where the trip is. */
function NowThere({
  place,
  lat,
  lon,
  art,
}: {
  place: string;
  lat: number | null;
  lon: number | null;
  art: string | null;
}) {
  const now = usePlaceNow(lat, lon);
  const minute = useMinute();
  const weather = now.status === "ready" ? now.weather : null;
  const time = weather?.utcOffset !== undefined ? localTimeAt(weather.utcOffset, minute) : null;
  return (
    <NextModuleCard
      guide="home-module-now"
      title="Right now there"
      sub={
        <span className="font-semibold text-[var(--acc-ink,var(--primary))]">
          Live from {place}
        </span>
      }
      art={art}
    >
      {weather ? (
        <span className="hn-glass-note mt-[46px]">
          {time ? (
            <span className="block text-[18px] font-bold tabular-nums leading-tight">{time}</span>
          ) : null}
          <span className="block text-[13px] leading-tight">
            {temperature(weather.temp)} · {describeWeather(weather.code).label}
          </span>
        </span>
      ) : now.status === "unavailable" ? (
        <span className="block text-[13px] text-muted-foreground">{waitingLine(now.status)}</span>
      ) : null}
    </NextModuleCard>
  );
}

/** "Weather there": today's sky where the trip is. */
function WeatherThere({
  place,
  lat,
  lon,
  art,
}: {
  place: string;
  lat: number | null;
  lon: number | null;
  art: string | null;
}) {
  const now = usePlaceNow(lat, lon);
  const weather = now.status === "ready" ? now.weather : null;
  return (
    <NextModuleCard guide="home-module-weather" title="Weather there" sub={place} art={art}>
      {weather ? (
        <span className="block">
          <span className="block font-display text-[34px] leading-none tabular-nums">
            {temperature(weather.temp)}
          </span>
          <span className="mt-1 block text-[13px] leading-tight text-muted-foreground">
            {describeWeather(weather.code).label}
            {weather.high !== null && weather.low !== null
              ? ` · ${temperature(weather.high)} / ${temperature(weather.low)}`
              : ""}
          </span>
        </span>
      ) : (
        <span className="block text-[13px] text-muted-foreground">{waitingLine(now.status)}</span>
      )}
    </NextModuleCard>
  );
}

/** "Trip tools": currency, transport, translate and offline, a tap away (the same links as Home's). */
function TripTools({ trip }: { trip: TripRow }) {
  const tools = [
    { label: "Currency", icon: Coins, search: { menu: "currency" } },
    { label: "Transport", icon: Train, search: { view: "bookings" } },
    { label: "Translate", icon: Languages, href: "https://translate.google.com/" },
    { label: "Offline", icon: Download, search: { menu: "offline" } },
  ];
  const cls =
    "flex min-h-11 min-w-0 flex-col items-center gap-1 text-center text-[13px] leading-tight text-muted-foreground";
  return (
    <NextModuleCard guide="home-module-tools" title="Trip tools" tone={2}>
      <span className="mt-1 grid grid-cols-2 gap-x-1 gap-y-2.5">
        {tools.map((tool, i) => {
          const body = (
            <>
              <span className="hn-tool">
                <tool.icon className={`seq-text-${i + 1} size-[19px]`} aria-hidden />
              </span>
              <span className="max-w-full break-words">{tool.label}</span>
            </>
          );
          return tool.href ? (
            <a key={tool.label} href={tool.href} target="_blank" rel="noreferrer" className={cls}>
              {body}
            </a>
          ) : (
            <Link
              key={tool.label}
              to="/trips/$tripId"
              params={{ tripId: trip.id }}
              search={tool.search as never}
              className={cls}
            >
              {body}
            </Link>
          );
        })}
      </span>
    </NextModuleCard>
  );
}

/**
 * "Customize home" at the foot of Home: the references' card, opening the
 * modules for the trip state Home is in now (the other two a tap away).
 * Each state keeps its own list on this phone; the account's Home layout is
 * where each starts, and Reset goes back to it.
 */
export function CustomizeHomeNext({ state }: { state: HomeState }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HomeState>(state);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setEditing(state);
      }}
    >
      <SheetTrigger asChild>
        <button
          type="button"
          data-guide="customize-home"
          className="mx-auto flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LayoutGrid className="size-4" aria-hidden /> Customize home
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Customize home</SheetTitle>
          <SheetDescription>
            Each moment has its own modules: before a trip, during one, and with none planned. Kept
            on this phone; your account's Home layout is where each list starts.
          </SheetDescription>
        </SheetHeader>
        <div role="tablist" aria-label="Which moment" className="trips-tabs mt-3">
          {HOME_STATES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={editing === s}
              onClick={() => setEditing(s)}
            >
              {HOME_STATE_LABEL[s]}
              {s === state ? <span className="sr-only"> (now)</span> : null}
            </button>
          ))}
        </div>
        <ModuleList key={editing} state={editing} />
      </SheetContent>
    </Sheet>
  );
}

function ModuleList({ state }: { state: HomeState }) {
  const { modules, fixed, toggle, move, reset } = useHomeNextLayout(state);
  const byKey = new Map(HOME_SECTIONS.map((m) => [m.key, m]));
  const shown = modules.order.filter((k) => modules.on.has(k));
  const off = modules.order.filter((k) => !modules.on.has(k));
  const movable = shown.filter((k) => !fixed.has(k));
  const row = (key: HomeSectionKey) => {
    const info = byKey.get(key);
    if (!info) return null;
    const on = modules.on.has(key);
    const index = movable.indexOf(key);
    return (
      <li key={key} className="flex items-center gap-2 py-2">
        {on && index >= 0 ? (
          <span className="flex shrink-0">
            <button
              type="button"
              aria-label={`Move ${info.label} up`}
              disabled={index === 0}
              onClick={() => move(key, -1)}
              className="grid size-11 place-items-center rounded-s-xl border border-border text-muted-foreground disabled:opacity-30"
            >
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Move ${info.label} down`}
              disabled={index === movable.length - 1}
              onClick={() => move(key, 1)}
              className="grid size-11 place-items-center rounded-e-xl border border-s-0 border-border text-muted-foreground disabled:opacity-30"
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{info.label}</p>
          <p className="text-[13px] leading-snug text-muted-foreground">{info.hint}</p>
        </div>
        <Switch
          className="relative after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']"
          checked={on}
          onCheckedChange={() => toggle(key)}
          aria-label={`Show ${info.label}`}
        />
      </li>
    );
  };
  return (
    <>
      <p className="label-caps mt-4">On Home · {HOME_STATE_LABEL[state].toLowerCase()}</p>
      {shown.length ? (
        <ul className="divide-y divide-border">{shown.map(row)}</ul>
      ) : (
        <p className="py-3 text-[14px] text-muted-foreground">Nothing yet. Add a module below.</p>
      )}
      {off.length > 0 ? (
        <>
          <p className="label-caps mt-4">More modules</p>
          <ul className="divide-y divide-border">{off.map(row)}</ul>
        </>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-11 w-full rounded-xl border border-border px-4 py-2.5 text-[15px] font-semibold transition-colors hover:bg-elevated"
      >
        Reset to default
      </button>
    </>
  );
}
