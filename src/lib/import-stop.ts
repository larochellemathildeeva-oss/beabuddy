/**
 * Turning one parsed row of an imported plan into a timeline stop: its time,
 * how long it lasts, which place to look it up in, and whether its pin is
 * trusted enough to save.
 *
 * Pure, so each rule is tested on its own rather than through the sheet.
 */
import { looksLikeStreetAddress } from "./direction-stops.ts";
import type { Confidence } from "./match-confidence.ts";

/**
 * A clock time as the timeline stores it, "HH:MM" in 24 hours, or null.
 *
 * The model is asked for 24-hour times, and mostly gives them, but a pasted
 * plan says "9am", "9.30", "21h30" or "noon", and whatever comes through is
 * saved as the stop's time. A time the timeline cannot sort is worse than no
 * time: it lands the stop in the wrong place in the day.
 */
export function normalizeClock(value: string | null | undefined): string | null {
  // "~19:30", "around 9:00", "09:00-ish": a rough time is still the time.
  // Dropping it left "Arrive Hiroshima Station" with no place in the day.
  const raw = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^(?:~|≈|approx(?:\.|imately)?|about|around|circa|ca\.?)\s*/, "")
    .replace(/\s*-?\s*ish$/, "")
    .trim();
  if (!raw) return null;
  if (raw === "noon" || raw === "midday") return "12:00";
  if (raw === "midnight") return "00:00";
  const m = raw.match(/^(\d{1,2})(?:\s*[:.h]\s*(\d{2})|\s*h)?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const half = m[3]?.replace(/\./g, "");
  // A bare "9" is not a time: it is as likely a day or a stop number. "19h"
  // is: the French and Spanish way to write the hour, as "21h30" is with
  // its minutes.
  const hourMark = /^\d{1,2}\s*h$/.test(raw);
  if (!m[2] && !half && !hourMark) return null;
  if (half === "pm" && hour < 12) hour += 12;
  if (half === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const pad = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/**
 * Every clock time a pasted plan gives, as HH:MM: "09:00", "9.30", "13h30",
 * "9am", "7 p.m.", "19h", "noon", and a bare hour after a time word or before
 * a range ("around 11", "a las 11", "9–11am"), which counts as morning or
 * evening. What the model may put on a stop and still be the source's.
 */
export function clockTimesIn(text: string): Set<string> {
  const out = new Set<string>();
  const written =
    /\b\d{1,2}(?:\s*[:.h]\s*\d{2}|\s*h\b)?\s*(?:am|pm|a\.m\.|p\.m\.)?|\bnoon\b|\bmidday\b|\bmidnight\b/gi;
  for (const m of text.matchAll(written)) {
    const time = normalizeClock(m[0]);
    if (time) out.add(time);
  }
  const bare =
    /\b(?:at|around|about|by|until|till|from|las|à|vers|um|gegen|alle|ore)\s+(\d{1,2})\b|(?<![\d\-–/.])\b(\d{1,2})(?=\s*(?:-|–|to)\s*\d{1,2}(?:[:.h]\d{2}|\s*(?:am|pm|a\.m\.|p\.m\.)))/gi;
  for (const m of text.matchAll(bare)) {
    const hour = Number(m[1] ?? m[2]);
    if (hour > 23) continue;
    out.add(pad(hour));
    if (hour < 12) out.add(pad(hour + 12));
  }
  return out;
}

/**
 * The rows without clock times the source never gave. Told a plan says
 * "morning" or "after lunch", a model can still answer 09:00 or 14:00, and a
 * made-up time moves the stop and reads as fact. Only for a pasted plan: a
 * photo or PDF has no text to check against.
 */
export function withoutInventedTimes<
  T extends { time_label: string | null; end_time?: string | null | undefined },
>(rows: readonly T[], source: string): T[] {
  const given = clockTimesIn(source);
  return rows.map((row) => {
    const start = row.time_label && !given.has(row.time_label) ? null : row.time_label;
    const end = row.end_time && !given.has(row.end_time) ? null : row.end_time;
    return start === row.time_label && end === row.end_time
      ? row
      : { ...row, time_label: start, ...(row.end_time !== undefined ? { end_time: end } : {}) };
  });
}

/** Longest stay taken from a source; anything more is a misread, not a plan. */
const MAX_STAY_MIN = 12 * 60;

/**
 * How long the stop lasts, in minutes, when the source says: a length ("2h",
 * given as duration_minutes) or an end time after the start. Becomes the
 * stop's planned stay, which is what Companion counts down and "Leave by"
 * works from. Null when the source did not say — never a guess.
 */
export function stayMinutesFrom(row: {
  time_label?: string | null | undefined;
  end_time?: string | null | undefined;
  duration_minutes?: number | null | undefined;
}): number | null {
  const given = row.duration_minutes;
  if (given != null && Number.isFinite(given) && given > 0 && given <= MAX_STAY_MIN) {
    return Math.round(given);
  }
  const start = normalizeClock(row.time_label);
  const end = normalizeClock(row.end_time);
  if (!start || !end) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const span = toMin(end) - toMin(start);
  return span > 0 && span <= MAX_STAY_MIN ? span : null;
}

/**
 * Where to look a stop up. The stop's own town when the plan names one — a
 * Miyajima lunch on a Hiroshima trip, a Kyoto day on a Tokyo one — carrying
 * the trip's country along so "Kyoto" is not asked for worldwide. The trip's
 * area otherwise.
 */
export function stopArea(
  city: string | null | undefined,
  tripArea: string | null | undefined,
): string {
  const trip = (tripArea ?? "").trim();
  const own = (city ?? "").trim();
  if (!own) return trip;
  if (!trip) return own;
  const tripParts = trip
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const lower = own.toLowerCase();
  // Already the trip's city ("Hiroshima" on a "Hiroshima, Japan" trip).
  if (tripParts.some((p) => p.toLowerCase() === lower)) return trip;
  const country = tripParts.length > 1 ? tripParts[tripParts.length - 1] : "";
  if (!country || own.toLowerCase().includes(country.toLowerCase())) return own;
  return `${own}, ${country}`;
}

export type PinChoice = "keep" | "drop";

/**
 * Whether a found pin is saved with the stop.
 *
 * A confident or plausible match is saved unless the person removed it. A
 * doubtful one — a café that came back as a neighbourhood — is not saved
 * unless they chose to keep it: the review says "Check this one", and a pin
 * nobody looked at should not reach the map just because it exists.
 */
export function pinIsSaved(confidence: Confidence, choice: PinChoice | undefined): boolean {
  if (choice) return choice === "keep";
  return confidence !== "low";
}

/**
 * Getting from one stop to the next, which is not a stop.
 *
 * "Travel to Peace Memorial Park", "Walk to the museum", "Take the ferry to
 * Miyajima": plans write the journey as a line of its own, and each became a
 * card on the timeline with "No place yet" — a stop that is really the gap
 * between two stops, which the paws between cards already are.
 *
 * Movement *to* somewhere counts, written "to" or as an arrow
 * ("JR line Hiroshima → Miyajimaguchi", "Hiroshima Station → Peace Park"),
 * and so does arriving ("Arrive Hiroshima Station"): its time is kept on the
 * stop it leads to. A meal, a hotel, a flight or anything booked is somewhere
 * to be and is never touched.
 */
const MOVEMENT =
  /^(?:travel|walk|stroll|head|go|drive|ride|cycle|bike|return|transfer|move|make your way|get|hop|catch|take|board|bus|train|tram|metro|subway|taxi|cab|uber|ferry|boat|shinkansen|jr|monorail|streetcar|start|set off|leave|depart|continue|proceed|cross)\b.*(?:\b(?:to|toward|towards|back|for)\b|→|->)/i;

/** "Hibiya Line to Ginza", "NYC Ferry to Pier 11": a named line or service, then where it goes. */
const LINE_TO =
  /^(?:[\p{L}\d-]+\s+){1,2}(?:line|ferry|bus|tram|shuttle|express)\s+(?:to|toward|towards)\b/iu;

/**
 * "Shin-Osaka Station → Hiroshima Station", "Hiroshima Station → Peace
 * Memorial Park": two named ends and an arrow. A named route ahead of a colon
 * ("World Heritage Sea Route: Peace Park → Miyajima") is a cruise or tour you
 * take, and stays.
 */
const ARROW_ROUTE = /^([^:：]*?\S)\s*(?:→|->|⟶|➔|➜)\s*(\S.*)$/u;

/** Somewhere you catch or leave a train, boat, bus or plane. */
const HUB =
  /\b(?:station|stn|pier|port|harbou?r|terminal|airport|bus stop|stop|platform|ferry)\b|駅|港|空港/i;

/**
 * An arrow row is a journey when it is written as transport, or when one of
 * its ends is a station or pier — whatever kind the parse gave it. Plans
 * written this way came back as sights, and each became a card with "No place
 * yet". Between two sights ("Trevi Fountain → Spanish Steps") it is a stroll
 * you do, and stays.
 */
/**
 * Where an arrow journey ends, when that is somewhere to visit rather than a
 * station or pier: "Tha Tien Pier → cross-river ferry to Wat Arun" → "Wat Arun".
 */
export function arrowDestination(title: string): string | null {
  const m = title.match(ARROW_ROUTE);
  // Only "→ ferry to Wat Arun": a plain "Hiroshima → Miyajimaguchi" is a
  // train to a town, and the stop after it is where the day goes on.
  if (!m || !/\bto\s+\S/i.test(m[2]!)) return null;
  const dest = m[2]!
    .replace(/^.*\b(?:to|towards?)\s+/i, "")
    .replace(/\s+[-–—]\s+.*$/, "")
    .trim();
  return dest && !HUB.test(dest) ? dest : null;
}

/** "Ferry from Circular Quay to Manly": a boat, bus or tram between two named ends. */
const LOCAL_CROSSING =
  /^(?:(?:cross[- ]river|harbou?r|river|local|city)\s+)?(?:ferry|boat|water taxi|river taxi|bus|tram|streetcar|cable car|funicular)\b.*\bfrom\s+(.+?)\s+(?:back\s+)?to\s+(\S.*)$/i;

const townOf = (row: object): string =>
  "city" in row
    ? String(row.city ?? "")
        .split(",")[0]!
        .trim()
        .toLowerCase()
    : "";

/**
 * A ferry, bus or tram written as a journey between towns that never leaves
 * town: "Ferry from Circular Quay to Manly" between two Sydney stops. The
 * model writes it that way because it is told to title journeys between
 * towns so, and as its own stop it was an extra card with "To book".
 * Only when the stops on both sides are known to be in the same town.
 */
function isLocalCrossing<T extends FoldableRow>(rows: readonly T[], i: number): boolean {
  const row = rows[i]!;
  if (row.kind !== "transport" || row.booked === true || !LOCAL_CROSSING.test(row.title.trim()))
    return false;
  const here = townOf(row);
  if (!here) return false;
  const around = [rows[i - 1], rows[i + 1]].filter(
    (r): r is T => r != null && sameDay(r, row) && !LOCAL_CROSSING.test(r.title.trim()),
  );
  return around.length > 0 && around.every((r) => townOf(r) === here);
}

/** A boat ride to somewhere: "Ferry to Wat Arun", "Take the boat to Wat Arun". */
const BOAT_TO =
  /^(?:take\s+(?:the\s+|a\s+)?)?(?:(?:cross[- ]river|river|harbou?r)\s+)?(?:ferry|boat|water taxi|river taxi)\b.*?\bto\s+(\S.*)$/i;

/**
 * A boat ride to a sight ("Ferry to Wat Arun"), not to a town or an island
 * whose stops follow ("Take the ferry to Miyajima", then the shrine there).
 */
const BOAT_SIGHT = new RegExp(
  `${BOAT_TO.source.slice(0, -1)}(?<=\\b(?:wat|temple|shrine|museum|palace|castle|tower|fort|fortress|cathedral|church|basilica|monastery|abbey|statue|gallery|lighthouse)\\b.*)$`,
  "i",
);

/**
 * Where a crossing written "Ferry from Tha Tien Pier to Wat Arun" goes, or a
 * boat ride "Ferry to Wat Arun", when that is a place to visit, not a pier.
 */
function crossingDestination(title: string): string | null {
  const text = title.trim();
  const dest = (text.match(LOCAL_CROSSING)?.[2] ?? text.match(BOAT_TO)?.[1])
    ?.replace(/\s+[-–—]\s+.*$/, "")
    .trim();
  return dest && !HUB.test(dest) ? dest : null;
}

function isArrowJourney(kind: string, title: string): boolean {
  const m = title.match(ARROW_ROUTE);
  if (!m) return false;
  return kind === "transport" || HUB.test(m[1]!) || HUB.test(m[2]!);
}

/**
 * "Arrive Hiroshima Station", "Arrive by 09:15 at Peace Park", "Arrival at
 * the pier": the end of a journey, not somewhere to spend time. The place it
 * names is the next stop, or the one after the next journey.
 */
const ARRIVAL = /^(?:arriv(?:e|al|ing)|get\s+(?:to|in)(?:to)?|reach)\b/i;

/** Getting to an airport: "Arrive at Kansai International Airport", "Reach Terminal 2". */
const AIRPORT = /\b(?:airport|terminal)\b|空港/i;

/**
 * Being at the airport for a flight, not the flight itself, when a flight
 * leaves later the same day. Read as a flight, it was a second "To book"
 * beside the real one, it moved the day on to the town the flight goes to,
 * and it was looked up on its own ("Hotel Kansai" for Kansai Airport).
 * As an arrival it folds into the flight as "Getting there", time kept.
 * A landing ("Arrive at Narita Airport" on the first day) has no flight
 * after it and stays what it was.
 */
export function isAirportArrival(title: string): boolean {
  const text = title.trim();
  return ARRIVAL.test(text) && AIRPORT.test(text) && !/\bflight\b|✈/i.test(text);
}

/**
 * An airport arrival however the rows put it: "Arrive at Narita International
 * Airport", or "Barcelona El Prat Airport" with the note "Arrive at airport".
 */
function arrivesAtAirport(row: { title: string; detail?: string | null | undefined }): boolean {
  if (isAirportArrival(row.title)) return true;
  return (
    AIRPORT.test(row.title) &&
    !/\bflight\b|✈/i.test(row.title) &&
    ARRIVAL.test((row.detail ?? "").trim())
  );
}

/**
 * Airport arrivals, filed the same way whichever kind the reading gave them.
 * With a flight after it the same day, it is getting there: an arrival, which
 * folds into that flight. With none, it is the landing: the flight in.
 */
export function settleAirportArrivals<T extends DayRow & { detail?: string | null }>(
  rows: readonly T[],
): T[] {
  return rows.map((row, i) => {
    if (row.booked === true || !arrivesAtAirport(row)) return row;
    if (!["flight", "transport", "activity"].includes(row.kind)) return row;
    let flightAfter = false;
    for (let j = i + 1; j < rows.length && sameDay(rows[j]!, row); j++) {
      const next = rows[j]!;
      if (next.kind === "flight" && !arrivesAtAirport(next)) flightAfter = true;
    }
    if (!flightAfter) return row.kind === "flight" ? row : { ...row, kind: "flight" };
    // Worded as an arrival, so the fold reads it as the end of a journey.
    const title = isAirportArrival(row.title) ? row.title : `Arrive at ${row.title.trim()}`;
    return { ...row, kind: "activity", title };
  });
}

/**
 * "Train from Paris Gare de Lyon to Lyon Part-Dieu": a journey between two
 * towns. It needs a ticket and fixes the day around it, so it stays a stop of
 * its own rather than a "Getting there" note on the next one.
 */
const CITY_JOURNEY =
  /^(?:(?:night|overnight|high[- ]speed|regional|intercity)\s+)?(?:train|ferry|bus|coach|shinkansen|eurostar|tgv|ice|flight|drive)\b.*\bfrom\s+\S.*\bto\s+\S/i;

export function isCityJourney(title: string): boolean {
  const text = title.trim();
  if (!CITY_JOURNEY.test(text)) return false;
  // "Train from Osaka Station to Kansai Airport": getting to a flight, which
  // is the journey. As its own stop it was a second "To book" beside it.
  return (
    /^(?:flight|fly)\b/i.test(text) ||
    !/\bto\s+(?:\S+\s+){0,3}(?:airport|terminal)\b|空港\s*$/i.test(text)
  );
}

/** Kinds that are somewhere to be, however their title is worded. */
const NEVER_A_LEG = new Set(["meal", "lodging", "hotel", "flight", "reservation"]);

export function isTravelLeg(row: {
  kind: string;
  title: string;
  booked?: boolean | null | undefined;
}): boolean {
  // A booked ferry is a thing you must be on, not the gap between stops,
  // however it is worded ("Take the ferry to Miyajima 🚢 BOOKED").
  if (row.booked === true) return false;
  const title = row.title.trim();
  if (isCityJourney(title)) return false;
  if (row.kind === "transport" && (MOVEMENT.test(title) || LINE_TO.test(title))) return true;
  if (NEVER_A_LEG.has(row.kind)) return false;
  return isArrowJourney(row.kind, title) || ARRIVAL.test(title);
}

type RouteCity = {
  city: string;
  country?: string | null | undefined;
  arrive_on?: string | null | undefined;
  depart_on?: string | null | undefined;
};

/**
 * Where the trip is on a given day, from its route: "Hiroshima, Japan" on
 * Oct 7 of a Tokyo–Kyoto–Hiroshima trip. A stop is looked up there, not in
 * the trip's home city, which on a multi-city trip is the wrong place for
 * most of it.
 *
 * The city you are in on a date is the last one arrived at by then; on a
 * travel day, the one arrived at that day. Null without a date or a route.
 */
export function routeCityOn(
  cities: readonly RouteCity[],
  date: string | null | undefined,
): string | null {
  const here = routeStopOn(cities, date);
  return here ? [here.city.trim(), here.country?.trim()].filter(Boolean).join(", ") : null;
}

/** The route stop itself, for its pin as well as its name. */
export function routeStopOn<T extends RouteCity>(
  cities: readonly T[],
  date: string | null | undefined,
): T | null {
  if (!date || cities.length === 0) return null;
  const latestFirst = (a: T, b: T) => b.arrive_on!.localeCompare(a.arrive_on!);
  const dated = cities.filter((c) => c.city.trim() && c.arrive_on);
  const here = dated
    .filter((c) => c.arrive_on! <= date && (!c.depart_on || date <= c.depart_on))
    .sort(latestFirst)[0];
  if (here) return here;
  // Past the last departure, or no departures written: the latest arrival.
  const before = dated.filter((c) => c.arrive_on! <= date).sort(latestFirst)[0];
  if (before) return before;
  // A one-city route with no dates is still where the trip is.
  const named = cities.filter((c) => c.city.trim());
  return named.length === 1 ? named[0]! : null;
}

/** The country a route runs through, when it is only one: the area of last resort. */
export function routeCountry(cities: readonly RouteCity[]): string | null {
  const countries = new Set(
    cities.map((c) => c.country?.trim()).filter((c): c is string => Boolean(c)),
  );
  return countries.size === 1 ? [...countries][0]! : null;
}

type FoldableRow = {
  kind: string;
  title: string;
  booked?: boolean | null | undefined;
  detail: string | null;
  time_label: string | null;
  day_date: string | null;
  day_number: number | null;
};

/**
 * The plan with its travel legs folded into the stop they lead to: "Getting
 * there: Take the ferry to Miyajima, 10:30" is added to that stop's detail,
 * so the departure time is kept. A leg with no stop after it on the same day
 * goes onto the stop before it as "Afterwards: …"; a leg alone on its day stays.
 */
export function foldTravelLegs<T extends FoldableRow>(rows: readonly T[]): T[] {
  const out = settleAirportArrivals(rows).map((row) => ({ ...row }));
  const drop = new Set<number>();
  /** The stop the last leg went into, for an arrival that ends that same journey. */
  let lastInto = -1;
  const crossing = out.map((_, i) => isLocalCrossing(out, i));
  out.forEach((row, i) => {
    if (!crossing[i] && !isTravelLeg(row)) return;
    const target = legTarget(out, i, drop);
    if (!target) return;
    const into = out[target.index]!;
    // "Tha Tien Pier → ferry to Wat Arun", then lunch somewhere else: the
    // ferry is how Wat Arun is reached, and Wat Arun is the visit. Folded
    // into lunch, the temple was lost from the day.
    const dest = target.after
      ? null
      : crossing[i] || BOAT_SIGHT.test(row.title.trim())
        ? crossingDestination(row.title)
        : arrowDestination(row.title);
    if (
      dest &&
      !fold(`${into.title} ${"place" in into ? String(into.place ?? "") : ""}`).includes(fold(dest))
    ) {
      out[i] = {
        ...row,
        kind: "activity",
        title: dest,
        ...("place" in row ? { place: dest } : {}),
        detail: withLegNote(
          row.detail,
          { title: row.title, time_label: null, detail: null },
          false,
        ),
      };
      return;
    }
    // "Take the Haruka to Kansai Airport, 14:30", then "Arrive at Kansai
    // International Airport, 15:45": one journey, so one note with both times.
    if (lastInto === target.index && drop.has(i - 1) && ARRIVAL.test(row.title.trim())) {
      if (row.time_label) into.detail = `${into.detail}, arriving ${row.time_label}`;
    } else {
      into.detail = withLegNote(into.detail, row, target.after);
    }
    lastInto = target.index;
    drop.add(i);
  });
  return out.filter((_, i) => !drop.has(i));
}

type DayRow = {
  kind: string;
  title: string;
  day_date: string | null;
  day_number?: number | null;
  booked?: boolean | null | undefined;
};

const sameDay = (a: DayRow, b: DayRow) =>
  (a.day_date ?? "") === (b.day_date ?? "") && (a.day_number ?? 0) === (b.day_number ?? 0);

/**
 * The stop a travel leg belongs to: the next stop that day, or — when it is
 * the day's last movement — the stop before it. Null when it is alone.
 */
export function legTarget(
  rows: readonly DayRow[],
  i: number,
  skip: ReadonlySet<number> = new Set(),
): { index: number; after: boolean } | null {
  const row = rows[i]!;
  for (let j = i + 1; j < rows.length && sameDay(rows[j]!, row); j++) {
    if (!isTravelLeg(rows[j]!)) return { index: j, after: false };
  }
  for (let j = i - 1; j >= 0 && sameDay(rows[j]!, row); j--) {
    if (!isTravelLeg(rows[j]!) && !skip.has(j)) return { index: j, after: true };
  }
  return null;
}

/** Words that say how, not which journey. */
const GENERIC_LEG_WORDS = new Set([
  "take",
  "travel",
  "walk",
  "head",
  "from",
  "toward",
  "towards",
  "line",
  "back",
  "getting",
  "there",
]);

/**
 * The stop's note already describes this journey: same departure time, or —
 * when the leg has no time — a word naming the same service or place.
 */
function alreadyNoted(
  detail: string,
  label: string,
  leg: Pick<FoldableRow, "title" | "time_label">,
): boolean {
  const notes = detail
    .split(" · ")
    .filter((n) => n.startsWith(`${label}:`))
    .map((n) => n.toLowerCase());
  if (!notes.length) return false;
  if (leg.time_label) return notes.some((n) => n.includes(leg.time_label!));
  const words = leg.title
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 && !GENERIC_LEG_WORDS.has(w));
  return notes.some((n) => words.some((w) => n.includes(w)));
}

/** A stop's note with the leg added: "Getting there: Take the ferry to Miyajima, 10:30". */
export function withLegNote(
  detail: string | null,
  leg: Pick<FoldableRow, "title" | "time_label" | "detail">,
  after: boolean,
): string {
  const label = after ? "Afterwards" : "Getting there";
  // The model sometimes writes the journey into the stop *and* as a line of
  // its own; the second copy is the same journey, not another one.
  if (detail && alreadyNoted(detail, label, leg)) return detail;
  const what = [leg.title, leg.time_label, leg.detail].filter(Boolean).join(", ");
  const note = `${label}: ${what}`;
  return detail ? `${detail} · ${note}` : note;
}

type NestableRow = {
  kind: string;
  title: string;
  detail: string | null;
  place?: string | null | undefined;
  time_label: string | null;
  end_time?: string | null | undefined;
  duration_minutes?: number | null | undefined;
  day_date: string | null;
  day_number: number | null;
  booked?: boolean | null | undefined;
  /** The title of the earlier stop this one is inside, as the parse wrote it. */
  within?: string | null | undefined;
};

const fold = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The stop a row is inside: the nearest earlier stop that day whose title
 * is the one it names ("Peace Memorial Museum" for "the museum's east
 * wing"), else whose place is; or -1. A name that matches nothing leaves the
 * row on its own rather than hanging it off a guess.
 *
 * A row that is itself inside something is never a parent. The model gives
 * each gallery the museum as its place ("Winged Victory", place "Louvre"),
 * so matching on place alone made each gallery the parent of the next.
 */
export function parentIndex(rows: readonly NestableRow[], i: number): number {
  const row = rows[i];
  const want = fold(row?.within);
  if (!row || want.length < 3) return -1;
  const matches = (name: string | null | undefined) => {
    const n = fold(name);
    return n.length >= 3 && (n === want || n.includes(want) || want.includes(n));
  };
  let byPlace = -1;
  for (let j = i - 1; j >= 0 && sameDay(rows[j]!, row); j--) {
    const candidate = rows[j]!;
    if (fold(candidate.within)) continue;
    if (matches(candidate.title)) return j;
    if (byPlace < 0 && matches(candidate.place)) byPlace = j;
  }
  return byPlace;
}

/**
 * Things seen inside a place, folded into it when they are only a list.
 *
 * "Visit Peace Memorial Museum", then "East building: Hiroshima before the
 * bomb", "Main building: personal effects": the plan names one visit and what
 * to see during it. As stops, each took a card, a "Travelling to…" gap and a
 * map search — for a room. Untimed, they become the visit's "Inside:" note.
 *
 * With a time of its own (the Cenotaph at 10:45, after the museum at 9:30),
 * a place inside another stays a stop — it is when you are there — and keeps
 * `within`, so it is looked up beside its parent rather than across the city.
 * Booked rows always stay, and so does everything listed under an area
 * (`isAreaStop`), or pinned to a venue of its own under anything that is not
 * one site: the stalls of a market or the cafés of a neighbourhood are
 * places of their own, to be pinned, not rooms of one building.
 */
export function nestWithin<T extends NestableRow>(rows: readonly T[]): T[] {
  const out = rows.map((row) => ({ ...row }));
  const drop = new Set<number>();
  out.forEach((row, i) => {
    const parent = parentIndex(out, i);
    if (parent < 0 || drop.has(parent)) {
      row.within = null;
      return;
    }
    row.within = out[parent]!.title;
    const ownTime = Boolean(row.time_label || row.end_time || row.duration_minutes);
    const area = out[parent]!;
    if (ownTime || row.booked === true || isAreaStop(area)) return;
    if (hasOwnVenue(row, area) && !isSiteStop(area)) return;
    out[parent]!.detail = withInsideNote(out[parent]!.detail, row.title);
    drop.add(i);
  });
  return out.filter((_, i) => !drop.has(i));
}

/**
 * Words that make a stop an area rather than one site: somewhere with many
 * separate places in it. Letters around the word are checked by hand, since
 * `\b` does not see "é" as part of a word.
 */
const AREA_WORDS =
  /(?<!\p{L})(?:neighbou?rhoods?|district|quarter|quartier|barrio|area|old town|downtown|chinatown|bazaar|souk|markets?|marché|mercado|mercato|markt|streets?|avenue|shotengai|arcade|yokocho|dori|dōri)(?!\p{L})/iu;

/** One site, however long the stroll there: its monuments and halls fold into its list. */
const SITE_WORDS =
  /(?<!\p{L})(?:park|parc|parque|gardens?|jardin|jardín|temple|shrine|dera|jinja|taisha|jingu|church|cathedral|basilica|mosque|abbey|monastery|castle|palace|museum|musée|museo|gallery|hall|tower|fort|fortress|cemetery|trail|hike|beach|forest|island|lake|river|mountain|mount|waterfall|zoo|aquarium)(?!\p{L})/iu;

const lastWord = (name: string) => name.trim().split(/\s+/).pop() ?? "";

/**
 * A neighbourhood, market or street, where each spot listed under it is a
 * place of its own: a stop whose title or place names one ("Nishiki
 * Market", "Gion district"), or a stroll through somewhere that is not one
 * site ("Walk in Le Marais", but not "Walk in Jardin du Luxembourg"). The
 * last word says what a place is, so "Old Town Hall" is a hall and "Temple
 * Street Night Market" a market.
 */
export function isAreaStop(row: Pick<NestableRow, "kind" | "title" | "place">): boolean {
  const names = [row.title, row.place ?? ""].filter((n) => n.trim());
  if (names.some((n) => SITE_WORDS.test(lastWord(n)))) return false;
  if (names.some((n) => AREA_WORDS.test(n))) return true;
  return row.kind.toLowerCase() === "walk" && !names.some((n) => SITE_WORDS.test(n));
}

/** One site by name ("Peace Memorial Park", "Kiyomizu-dera"), whose parts fold into it. */
function isSiteStop(row: Pick<NestableRow, "title" | "place">): boolean {
  return SITE_WORDS.test(row.title) || SITE_WORDS.test(row.place ?? "");
}

/**
 * A row pinned to a venue of its own ("Place des Vosges" under "Le
 * Marais"), not to the stop it is inside: the model gives a gallery the
 * museum as its place.
 */
function hasOwnVenue(row: NestableRow, parent: NestableRow): boolean {
  const own = fold(row.place);
  if (own.length < 3) return false;
  return [parent.title, parent.place].every((name) => {
    const n = fold(name);
    return !n || !(n === own || n.includes(own) || own.includes(n));
  });
}

/**
 * Spots timed inside an area's span in a plain list ("16:00–19:00 Walk in
 * Le Marais", then "16:10 Place des Vosges"): each is set `within` the
 * area, so it is looked up beside it. The area's end then goes: its span
 * holds those visits, and kept as the area's own stay it would count their
 * time twice.
 */
export function linkAreaSpots<T extends NestableRow>(rows: readonly T[]): T[] {
  const out = rows.map((row) => ({ ...row }));
  out.forEach((area, i) => {
    if (!area.time_label || !area.end_time || fold(area.within)) return;
    if (!isAreaStop(area)) return;
    let linked = false;
    for (let j = i + 1; j < out.length && sameDay(out[j]!, area); j++) {
      const spot = out[j]!;
      if (!spot.time_label || spot.time_label < area.time_label) break;
      if (spot.time_label >= area.end_time) break;
      spot.within = area.title;
      linked = true;
    }
    if (linked) area.end_time = null;
  });
  return out;
}

/** "Inside: East building · Main building", one note however many are added. */
export function withInsideNote(detail: string | null, title: string): string {
  const notes = (detail ?? "").split(" · ").filter(Boolean);
  const at = notes.findIndex((n) => n.startsWith("Inside: "));
  if (at < 0) return [...notes, `Inside: ${title}`].join(" · ");
  const listed = notes[at]!.slice("Inside: ".length).split(", ");
  if (!listed.some((l) => fold(l) === fold(title))) listed.push(title);
  notes[at] = `Inside: ${listed.join(", ")}`;
  return notes.join(" · ");
}

/**
 * Stops split into lookup batches of about `size`, never between a stop and
 * the ones inside it: a child is looked up beside its parent's pin, which
 * only the same request has. `parents[i]` is parentIndex, -1 for none.
 */
export function placeBatches(parents: readonly number[], size: number): [number, number][] {
  const out: [number, number][] = [];
  let start = 0;
  for (let i = 1; i < parents.length; i++) {
    if (i - start >= size && parents[i]! < start) {
      out.push([start, i]);
      start = i;
    }
  }
  if (parents.length) out.push([start, parents.length]);
  return out;
}

/**
 * A journey that takes you to another town: a flight, an intercity or
 * high-speed train, or anything of an hour or more. "S-Bahn to Ostbahnhof"
 * is not one; "direct ICE, about 4h" is.
 */
const LONG_JOURNEY =
  /\b(?:flight|fly|flew|plane|ICE|TGV|AVE|IC|EC|intercity|eurostar|thalys|shinkansen|railjet|frecciarossa|amtrak|overnight train|night train|ferry)\b|\b\d+(?:[.,]\d+)?\s*(?:h|hrs?|hours?)\b/i;

/**
 * Whether a long journey comes just before this stop, so it is not in the
 * town of the stop before it: the row before is a flight or a journey, or
 * the stop's own note says how it was reached ("getting there: direct ICE,
 * about 4h", folded in by foldTravelLegs).
 */
export function afterJourney(
  row: { detail?: string | null | undefined },
  previous: { kind: string; title: string; detail?: string | null | undefined } | undefined,
): boolean {
  // Landing is a journey too: "Kansai International Airport — arrival", then
  // a hotel in Kyoto, 90 km on. It was looked for beside the airport, and a
  // namesake there was pinned for the hotel and its breakfasts.
  if (
    previous &&
    /\b(?:airport|aeroport|aeropuerto|aeroporto|flughafen)\b/i.test(previous.title) &&
    /\barriv/i.test(previous.detail ?? "")
  ) {
    return true;
  }
  if (previous && (previous.kind === "flight" || previous.kind === "transport")) {
    return (
      previous.kind === "flight" || LONG_JOURNEY.test(`${previous.title} ${previous.detail ?? ""}`)
    );
  }
  const reached = (row.detail ?? "")
    .split(" · ")
    .filter((note) => /^getting there\b/i.test(note))
    .join(" ");
  return LONG_JOURNEY.test(reached);
}

/**
 * Whether any ride comes just before this stop: a train, a bus, a flight.
 * Short or long, it may end a day out ("Train from Katoomba back to Sydney
 * Central"), so the stop after it is not looked for beside the one before.
 */
export function afterRide(previous: { kind: string } | undefined): boolean {
  return previous?.kind === "transport" || previous?.kind === "flight";
}

/** A stay, by what the row says happens there. */
const STAY_WORDS = /\b(?:overnight|check[- ]?in|check[- ]?out|(?:luggage|bag) drop)\b/i;

/**
 * A row the model read, set straight where it copied the source too closely.
 *
 * "Neues Museum, Bodestraße 1-3 - Egyptian and prehistoric collections" came
 * back as the title, with the address left in it and null beside it: the stop
 * then printed its address and "no address" together, and was looked up by a
 * title with a street in it. The street goes to the address, a note the
 * detail already carries leaves the title, and a night at the hotel filed as
 * an activity is a stay.
 */
export function tidyImportedRow<
  T extends {
    kind: string;
    title: string;
    detail: string | null;
    address?: string | null | undefined;
  },
>(row: T): T {
  let title = row.title.trim();
  let address = row.address?.trim() || null;
  const detail = row.detail?.trim() || null;
  const dash = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  let note = dash ? dash[2]!.trim() : null;
  let main = dash ? dash[1]!.trim() : title;
  const parts = main.split(/\s*,\s*/);
  const at = parts.findIndex((part, i) => i > 0 && looksLikeStreetAddress(part));
  if (at > 0) {
    if (!address) address = parts[at]!;
    parts.splice(at, 1);
    main = parts.join(", ");
  }
  if (note && detail?.toLowerCase().includes(note.toLowerCase())) note = null;
  title = note ? `${main} - ${note}` : main;
  const kind =
    row.kind === "activity" && STAY_WORDS.test(`${title} ${detail ?? ""}`) ? "lodging" : row.kind;
  return { ...row, title, kind, ...(address ? { address } : {}) };
}
