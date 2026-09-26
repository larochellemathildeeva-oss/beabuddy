import { useEffect, useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
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
  const cls = "size-7 shrink-0 text-primary";
  if (kind === "clear") return isDay ? <Sun className={cls} /> : <Moon className={cls} />;
  if (kind === "partly")
    return isDay ? <CloudSun className={cls} /> : <CloudMoon className={cls} />;
  if (kind === "fog") return <CloudFog className={cls} />;
  if (kind === "rain") return <CloudRain className={cls} />;
  if (kind === "snow") return <CloudSnow className={cls} />;
  if (kind === "storm") return <CloudLightning className={cls} />;
  return <Cloud className={cls} />;
}

/** The tile both of Home's "At a glance" squares sit in. */
export const GLANCE_TILE =
  "rise flex min-h-[150px] min-w-0 flex-col justify-between rounded-3xl border p-4";

/**
 * Where you are and what it is like outside, as one of Home's "At a glance"
 * tiles.
 *
 * It shares Near's location and Near's consent, so there is one question
 * about your position on Home, not two. Before you have said yes it offers to
 * look, once; nothing is remembered from that tap.
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

  const tile = `${GLANCE_TILE} border-border bg-card`;

  if (!near.consentReady) return <div className={tile} aria-hidden />;

  if (!near.consent) {
    return (
      <section data-guide="home-weather" className={tile}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] text-muted-foreground">Weather here</p>
          <CloudSun className="size-7 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-[12px] leading-snug text-muted-foreground">
            Looked up once, from a position rounded to about a kilometre.
          </p>
          <button
            type="button"
            onClick={() => near.allow("once")}
            className="mt-2 rounded-xl border border-border px-3 py-1.5 text-[13px] font-semibold"
          >
            Show
          </button>
        </div>
      </section>
    );
  }

  if (near.state === "error") {
    return (
      <section data-guide="home-weather" className={tile}>
        <p className="line-clamp-3 text-[13px] text-muted-foreground">{near.error}</p>
        <button
          type="button"
          onClick={near.locate}
          className="self-start rounded-xl border border-border px-3 py-1.5 text-[13px] font-semibold"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!weather) {
    return (
      <section data-guide="home-weather" className={tile}>
        <p className="text-[15px] text-muted-foreground">Weather here</p>
        <p className="text-[13px] text-muted-foreground">
          {failed ? "Not available right now." : "Checking…"}
        </p>
      </section>
    );
  }

  const { label, kind } = describeWeather(weather.code);
  const where = place?.city?.split(",")[0]?.trim() || place?.country || "";

  return (
    <section data-guide="home-weather" className={tile}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[15px] text-muted-foreground">
          {where || "Where you are"}
        </p>
        <WeatherIcon kind={kind} isDay={weather.isDay} />
      </div>
      <div>
        <div className="flex items-end justify-between gap-2">
          <p className="font-display text-[46px] leading-none">
            {formatTemp(weather.temp, fahrenheit)}
          </p>
          <p className="min-w-0 truncate pb-1 text-right text-[13px] text-muted-foreground">
            {label}
          </p>
        </div>
        <p className="mt-1.5 truncate text-[10.5px] text-muted-foreground">
          {weather.high !== null && weather.low !== null
            ? `H ${formatTemp(weather.high, fahrenheit)} · L ${formatTemp(weather.low, fahrenheit)} · `
            : ""}
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
      </div>
    </section>
  );
}
