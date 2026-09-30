import type { LegMode } from "./travel-mode.ts";

/**
 * How long a journey takes when the router could not say.
 *
 * The public router is a demo service and fails now and then; without a
 * duration there is no "Leave by", which is the one thing Companion is for.
 * Two pins are still two pins, so the straight line between them, stretched
 * for streets that do not run straight, gives a fair estimate — shown as one.
 *
 * Walking at 4.5 km/h with streets 1.3× the straight line; driving at an
 * average of 30 km/h in town with roads 1.4× the line; transit at 20 km/h
 * along lines 1.3× the line, plus eight minutes to reach the stop and wait.
 * Rounded up to a whole minute, and never under one.
 *
 * Past a town's width a ride leaves town: the rest of the way is timed at
 * a train's or a highway's pace (75 and 70 km/h, 1.2× and 1.25× the line).
 * At town speeds alone Himeji to Kobe, 40 minutes by JR, read 3 h 18 min.
 */
export function estimatedLegSeconds(straightMeters: number, mode: LegMode): number {
  if (!(straightMeters > 0)) return 0;
  if (mode === "walking") return roundedUp((straightMeters * 1.3) / (4500 / 3600));
  const [town, detour, speed, outDetour, outSpeed, extra] =
    mode === "transit"
      ? [TRANSIT_TOWN_M, 1.3, 20000 / 3600, 1.2, 75000 / 3600, TRANSIT_WAIT_S]
      : [DRIVE_TOWN_M, 1.4, 30000 / 3600, 1.25, 70000 / 3600, 0];
  const inTown = Math.min(straightMeters, town);
  const outOfTown = straightMeters - inTown;
  return roundedUp((inTown * detour) / speed + (outOfTown * outDetour) / outSpeed + extra);
}

function roundedUp(seconds: number): number {
  return Math.max(60, Math.ceil(seconds / 60) * 60);
}

/** How far a ride stays at town pace, in a straight line: a bus or tram, town roads. */
const TRANSIT_TOWN_M = 5_000;
const DRIVE_TOWN_M = 10_000;

/** Walking to the stop and waiting for what comes, on a transit estimate. */
const TRANSIT_WAIT_S = 8 * 60;

/** The distance that estimate assumes, in metres along the way. */
export function estimatedLegMeters(straightMeters: number, mode: LegMode): number {
  if (!(straightMeters > 0)) return 0;
  return Math.round(straightMeters * (mode === "driving" ? 1.4 : 1.3));
}

/** Stops that are a station or a pier: the ride between two is the train or boat itself. */
const STATION_KINDS = new Set(["transport", "train"]);
/** A journey row that names where it boards: not a transfer, taxi or "get to the airport". */
const STATION_WORD =
  /\b(?:station|stn|pier|port|terminal|airport|ferry)\b|駅|桟橋|港|空港|gare|bahnhof|estaci[oó]n/i;

type RideEnd = {
  title?: string | null | undefined;
  address?: string | null | undefined;
  kind?: string | null | undefined;
  day_date?: string | null | undefined;
  time_label?: string | null | undefined;
};

/** "07:11" as minutes past midnight, or null. */
function clockMinutes(label: string | null | undefined): number | null {
  const m = label?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes < 24 * 60 ? minutes : null;
}

/**
 * The ride between two timed stations the same day, as the plan has it:
 * "Kyoto Station 14:45" then "Shin-Osaka Station 15:00" is a 15-minute
 * Shinkansen, which no estimate from the distance gets near (it read
 * 2 h 31 min). Null unless both ends are journey rows named or addressed
 * as a station, pier, port or airport, with times in order, at most twelve
 * hours apart: two timed transfers are not one ride.
 */
export function plannedRideSeconds(from: RideEnd, to: RideEnd): number | null {
  if (!STATION_KINDS.has((from.kind ?? "").toLowerCase())) return null;
  if (!STATION_KINDS.has((to.kind ?? "").toLowerCase())) return null;
  const boards = (end: RideEnd) => STATION_WORD.test(`${end.title ?? ""} ${end.address ?? ""}`);
  if (!boards(from) || !boards(to)) return null;
  if (!from.day_date || from.day_date !== to.day_date) return null;
  const start = clockMinutes(from.time_label);
  const end = clockMinutes(to.time_label);
  if (start == null || end == null || end <= start || end - start > 12 * 60) return null;
  return (end - start) * 60;
}
