import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  describeWeather,
  formatTemp,
  rainLine,
  rainNotice,
  rainUrl,
  readRain,
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

/** A day at the place, hour by hour, from a list of chances starting at 00:00. */
function day(date: string, chances: number[], utcOffsetSeconds = 0) {
  return {
    hours: chances.map((chance, h) => ({
      time: `${date}T${String(h).padStart(2, "0")}:00`,
      chance,
    })),
    utcOffsetSeconds,
  };
}

const dry = Array.from({ length: 24 }, () => 10);

test("rainUrl asks for one day's hours at a rounded position, in the place's time", () => {
  const url = new URL(rainUrl(38.71234, -9.13987, "2026-10-03"));
  assert.equal(url.searchParams.get("latitude"), "38.71");
  assert.equal(url.searchParams.get("longitude"), "-9.14");
  assert.equal(url.searchParams.get("hourly"), "precipitation_probability");
  assert.equal(url.searchParams.get("timezone"), "auto");
  assert.equal(url.searchParams.get("start_date"), "2026-10-03");
  assert.equal(url.searchParams.get("end_date"), "2026-10-03");
});

test("readRain pairs hours with chances and keeps the place's offset", () => {
  const f = readRain({
    utc_offset_seconds: 3600,
    hourly: {
      time: ["2026-10-03T00:00", "2026-10-03T01:00"],
      precipitation_probability: [5, null],
    },
  });
  assert.deepEqual(f, { hours: [{ time: "2026-10-03T00:00", chance: 5 }], utcOffsetSeconds: 3600 });
  assert.equal(readRain(null), null);
  assert.equal(readRain({ hourly: { time: [], precipitation_probability: [] } }), null);
  assert.equal(readRain({ error: true, reason: "out of range" }), null);
});

test("rainNotice finds the spell and when it eases", () => {
  const chances = [...dry];
  chances[16] = 70;
  chances[17] = 85;
  chances[18] = 60;
  const n = rainNotice(day("2026-10-03", chances), "2026-10-03", new Date("2026-10-03T09:30:00Z"));
  assert.deepEqual(n, { from: "16:00", until: "19:00", chance: 85 });
  assert.equal(rainLine(n!), "Rain likely from 16:00 to 19:00 (85%). Worth packing a layer.");
});

test("rainNotice says nothing for a dry day, a night shower or rain already past", () => {
  const f = day("2026-10-03", dry);
  assert.equal(rainNotice(f, "2026-10-03", new Date("2026-10-03T08:00:00Z")), null);
  const night = [...dry];
  night[3] = 90;
  night[23] = 90;
  assert.equal(
    rainNotice(day("2026-10-03", night), "2026-10-03", new Date("2026-10-03T00:00:00Z")),
    null,
  );
  const morning = [...dry];
  morning[9] = 80;
  assert.equal(
    rainNotice(day("2026-10-03", morning), "2026-10-03", new Date("2026-10-03T12:00:00Z")),
    null,
  );
});

test("rainNotice reads now on the place's clock, not the phone's", () => {
  // Hiroshima is UTC+9: 06:00 UTC is 15:00 there, so rain at 12:00 is past
  // and rain at 17:00 is still ahead.
  const chances = [...dry];
  chances[12] = 90;
  chances[17] = 75;
  const n = rainNotice(
    day("2026-10-03", chances, 9 * 3600),
    "2026-10-03",
    new Date("2026-10-03T06:00:00Z"),
  );
  assert.deepEqual(n, { from: "17:00", until: "18:00", chance: 75 });
});

test("rainNotice covers a later trip day, and leaves open a spell into the evening", () => {
  const chances = [...dry];
  chances[21] = 65;
  chances[22] = 70;
  const n = rainNotice(day("2026-10-05", chances), "2026-10-05", new Date("2026-10-01T12:00:00Z"));
  assert.deepEqual(n, { from: "21:00", until: null, chance: 70 });
  assert.equal(rainLine(n!), "Rain likely from 21:00 (70%). Worth packing a layer.");
  // A day that has already gone at the place says nothing.
  assert.equal(
    rainNotice(day("2026-10-05", chances), "2026-10-05", new Date("2026-10-06T08:00:00Z")),
    null,
  );
});
