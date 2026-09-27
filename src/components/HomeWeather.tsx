import { useEffect, useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";
import type { useNearMe } from "@/hooks/useNearMe";
import { reverseGeocode, type Place } from "@/lib/geocode";
import { lookupWeather } from "@/lib/weather.functions";
import {
  describeWeather,
  formatTemp,
  roundCoord,
  usesFahrenheit,
  WEATHER_ATTRIBUTION,
  type Weather,
  type WeatherKind,
} from "@/lib/weather";

function WeatherIcon({ kind, isDay }: { kind: WeatherKind; isDay: boolean }) {
  const cls = "size-6 shrink-0 text-primary";
  if (kind === "clear") return isDay ? <Sun className={cls} /> : <Moon className={cls} />;
  if (kind === "partly")
    return isDay ? <CloudSun className={cls} /> : <CloudMoon className={cls} />;
  if (kind === "fog") return <CloudFog className={cls} />;
  if (kind === "rain") return <CloudRain className={cls} />;
  if (kind === "snow") return <CloudSnow className={cls} />;
  if (kind === "storm") return <CloudLightning className={cls} />;
  return <Cloud className={cls} />;
}

const PILL =
  "flex h-10 min-w-0 max-w-[160px] items-center gap-2 rounded-full border border-border bg-card px-3 shadow-xs";

/**
 * Where you are and what it is like outside, as the pill beside the date at
 * the top of Home (the master's "Montréal 13°").
 *
 * It shares Near's location and Near's consent, so there is one question
 * about your position on Home, not two. Before you have said yes it offers to
 * look, once; nothing is remembered from that tap. Open-Meteo's credit sits at
 * the foot of Home (`WeatherCredit`), where there is room for it.
 */
export function HomeWeather({ near }: { near: ReturnType<typeof useNearMe> }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [failed, setFailed] = useState(false);
  const [fahrenheit, setFahrenheit] = useState(false);

  useEffect(() => {
    setFahrenheit(
      usesFahrenheit(typeof navigator === "undefined" ? undefined : navigator.language),
    );
  }, []);

  const lat = near.here ? roundCoord(near.here.lat) : null;
  const lon = near.here ? roundCoord(near.here.lon) : null;

  useEffect(() => {
    if (lat === null || lon === null) {
      setWeather(null);
      setPlace(null);
      return;
    }
    let active = true;
    setFailed(false);
    void Promise.all([
      lookupWeather({ data: { lat, lon } }).catch(() => null),
      reverseGeocode(lat, lon),
    ]).then(([w, p]) => {
      if (!active) return;
      setWeather(w);
      setPlace(p);
      setFailed(!w);
    });
    return () => {
      active = false;
    };
  }, [lat, lon]);

  if (!near.consentReady) return <span className={`${PILL} invisible`} aria-hidden />;

  if (!near.consent) {
    return (
      <button
        type="button"
        data-guide="home-weather"
        onClick={() => near.allow("once")}
        title="Looked up once, from a position rounded to about a kilometre."
        className={PILL}
      >
        <CloudSun className="size-6 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-left leading-tight">
          <span className="block text-[11px] text-muted-foreground">Weather</span>
          <span className="block text-[13px] font-bold">Show</span>
        </span>
        <span className="sr-only">
          Looked up once, from a position rounded to about a kilometre.
        </span>
      </button>
    );
  }

  if (near.state === "error") {
    return (
      <button
        type="button"
        data-guide="home-weather"
        onClick={near.locate}
        title={near.error || "Location off"}
        className={PILL}
      >
        <CloudOff className="size-6 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-left leading-tight">
          <span className="block text-[11px] text-muted-foreground">Weather</span>
          <span className="block text-[13px] font-bold">Try again</span>
        </span>
      </button>
    );
  }

  if (!weather) {
    return (
      <span data-guide="home-weather" className={PILL} role="status">
        <CloudSun className="size-6 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-[12px] text-muted-foreground">
          {failed ? "Not available" : "Checking…"}
        </span>
      </span>
    );
  }

  const { label, kind } = describeWeather(weather.code);
  const where = place?.city?.split(",")[0]?.trim() || place?.country || "";
  const range =
    weather.high !== null && weather.low !== null
      ? ` High ${formatTemp(weather.high, fahrenheit)}, low ${formatTemp(weather.low, fahrenheit)}.`
      : "";

  return (
    <span
      data-guide="home-weather"
      className={PILL}
      title={`${label}.${range}`}
      aria-label={`${where || "Where you are"}: ${formatTemp(weather.temp, fahrenheit)}, ${label}.${range}`}
    >
      <WeatherIcon kind={kind} isDay={weather.isDay} />
      <span className="min-w-0 leading-tight" aria-hidden>
        <span className="block truncate text-[11px] text-muted-foreground">{where || "Here"}</span>
        <span className="block font-display text-[21px] leading-none">
          {formatTemp(weather.temp, fahrenheit)}
        </span>
      </span>
    </span>
  );
}

/** Open-Meteo's credit, at the foot of Home once the weather is showing. */
export function WeatherCredit() {
  return (
    <p className="text-center text-[11px] text-muted-foreground">
      Weather by{" "}
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
        title={WEATHER_ATTRIBUTION}
        className="underline underline-offset-2"
      >
        Open-Meteo
      </a>
    </p>
  );
}
