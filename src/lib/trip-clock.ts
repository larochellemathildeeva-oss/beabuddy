/**
 * The trip's clock beside the reader's, for a shared link read from another
 * time zone: "It's 09:14 in Japan, 21:14 for you". The trip's zone comes from
 * its stops' pins (worked out on the server); everything here is plain Intl
 * arithmetic, so it is pure and tested.
 */

/** Minutes `zone` is ahead of UTC at `instant` (Tokyo: 540). */
export function offsetMinutes(zone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60_000);
}

/** The date in `zone` at `instant`, as YYYY-MM-DD. */
export function dateIn(zone: string, instant: number): string {
  const shifted = new Date(instant + offsetMinutes(zone, instant) * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** "09:14" in `zone` at `instant`. */
export function clockIn(zone: string, instant: number): string {
  const shifted = new Date(instant + offsetMinutes(zone, instant) * 60_000);
  return shifted.toISOString().slice(11, 16);
}

/**
 * The instant a wall-clock time ("14:00" on 2026-10-03) happens in `zone`.
 * Null for anything that is not a clock time ("Morning"). Asked twice, so a
 * time just after a daylight-saving change lands on the right side of it.
 */
export function wallTimeToInstant(day: string, time: string, zone: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const naive = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  let instant = naive - offsetMinutes(zone, naive) * 60_000;
  instant = naive - offsetMinutes(zone, instant) * 60_000;
  return instant;
}

/** How far the trip is from the reader: "9 h ahead", "2 h 30 min behind", or null when level. */
export function zoneGap(tripZone: string, readerZone: string, instant: number): string | null {
  const diff = offsetMinutes(tripZone, instant) - offsetMinutes(readerZone, instant);
  if (diff === 0) return null;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const size = [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
  return `${size} ${diff > 0 ? "ahead" : "behind"}`;
}
