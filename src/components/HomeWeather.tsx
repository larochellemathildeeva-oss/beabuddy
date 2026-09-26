import { useEffect, useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  Moon,
  Sun,
} from "lucide-react";
import type { useNearMe } from "@/hooks/useNearMe";
import { reverseGeocode, type Place } from "@/lib/geocode";
import { formatTripLocation } from "@/lib/place-label";
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
  const cls = "size-8 shrink-0 text-primary";
  if (kind === "clear") return isDay ? <Sun className={cls} /> : <Moon className={cls} />;
  if (kind === "partly")
    return isDay ? <CloudSun className={cls} /> : <CloudMoon className={cls} />;
  if (kind === "fog") return <CloudFog className={cls} />;
  if (kind === "rain") return <CloudRain className={cls} />;
  if (kind === "snow") return <CloudSnow className={cls} />;
  if (kind === "storm") return <CloudLightning className={cls} />;
  return <Cloud className={cls} />;
}

/**
 * Where you are and what it is like outside, at the top of Home.
 *
 * It shares Near's location and Near's consent, so there is one question
 * about your position on Home, not two. Before you have said yes it is a
 * single line offering to look, once; nothing is remembered from that tap.
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

  if (!near.consentReady) return null;

  if (!near.consent) {
    return (
      <section data-guide="home-weather" className="rise surface flex items-center gap-3 p-3.5">
        <CloudSun className="size-6 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-[13.5px] text-muted-foreground">
          See the weather where you are. Béa looks it up once, from a position rounded to about a
          kilometre.
        </p>
        <button
          type="button"
          onClick={() => near.allow("once")}
          className="shrink-0 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
        >
          Show
        </button>
      </section>
    );
  }

  if (near.state === "error") {
    return (
      <section data-guide="home-weather" className="rise surface flex items-center gap-3 p-3.5">
        <p className="min-w-0 flex-1 text-[13.5px] text-muted-foreground">{near.error}</p>
        <button
          type="button"
          onClick={near.locate}
          className="shrink-0 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!weather) {
    return (
      <section data-guide="home-weather" className="rise surface p-3.5">
        <p className="text-[13.5px] text-muted-foreground">
          {failed
            ? "The weather isn't available right now."
            : "Checking the weather where you are…"}
        </p>
      </section>
    );
  }

  const { label, kind } = describeWeather(weather.code);
  const where = place ? formatTripLocation(place.city, place.country) : "";

  return (
    <section data-guide="home-weather" className="rise surface p-3.5">
      <div className="flex items-center gap-3">
        <WeatherIcon kind={kind} isDay={weather.isDay} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{where || "Where you are"}</span>
          </p>
          <p className="text-[15px] font-semibold">
            {label}
            {weather.feelsLike !== null && weather.feelsLike !== weather.temp && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · feels like {formatTemp(weather.feelsLike, fahrenheit)}
              </span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-[28px] leading-none">
            {formatTemp(weather.temp, fahrenheit)}
          </p>
          {weather.high !== null && weather.low !== null && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              H {formatTemp(weather.high, fahrenheit)} · L {formatTemp(weather.low, fahrenheit)}
            </p>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {WEATHER_ATTRIBUTION}
        </a>
      </p>
    </section>
  );
}
