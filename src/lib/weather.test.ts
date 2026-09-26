import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  describeWeather,
  formatTemp,
  readWeather,
  roundCoord,
  usesFahrenheit,
  weatherUrl,
} from "./weather.ts";

test("weatherUrl sends the position rounded to about a kilometre", () => {
  const url = new URL(weatherUrl(45.501689, -73.567256));
  assert.equal(url.host, "api.open-meteo.com");
  assert.equal(url.searchParams.get("latitude"), "45.5");
  assert.equal(url.searchParams.get("longitude"), "-73.57");
  assert.equal(url.searchParams.get("timezone"), "auto");
  assert.equal(roundCoord(1.23456), 1.23);
});

test("readWeather reads the current reading and today's range", () => {
  const w = readWeather({
    current: { temperature_2m: 17.6, apparent_temperature: 16.2, weather_code: 2, is_day: 1 },
    daily: { temperature_2m_max: [21.4], temperature_2m_min: [9.5] },
  });
  assert.deepEqual(w, { temp: 18, feelsLike: 16, high: 21, low: 10, code: 2, isDay: true });
});

test("readWeather gives up without a temperature or a code, and tolerates no daily", () => {
  assert.equal(readWeather(null), null);
  assert.equal(readWeather({ current: { weather_code: 1 } }), null);
  assert.equal(readWeather({ current: { temperature_2m: 3 } }), null);
  const w = readWeather({ current: { temperature_2m: -2, weather_code: 71, is_day: 0 } });
  assert.equal(w?.high, null);
  assert.equal(w?.isDay, false);
});

test("describeWeather puts WMO codes into plain words", () => {
  assert.equal(describeWeather(0).label, "Clear");
  assert.equal(describeWeather(3).kind, "cloudy");
  assert.equal(describeWeather(48).kind, "fog");
  assert.equal(describeWeather(63).label, "Rain");
  assert.equal(describeWeather(65).label, "Heavy rain");
  assert.equal(describeWeather(75).kind, "snow");
  assert.equal(describeWeather(81).label, "Showers");
  assert.equal(describeWeather(95).kind, "storm");
});

test("temperatures follow the locale's unit", () => {
  assert.equal(usesFahrenheit("en-US"), true);
  assert.equal(usesFahrenheit("en-CA"), false);
  assert.equal(usesFahrenheit("fr"), false);
  assert.equal(usesFahrenheit(undefined), false);
  assert.equal(formatTemp(18, false), "18°");
  assert.equal(formatTemp(18, true), "64°");
  assert.equal(formatTemp(-40, true), "-40°");
});
