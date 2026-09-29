/**
 * Reading a plan that is already a tidy list, without a model.
 *
 * Most pasted itineraries are one stop per line with the time up front —
 * "08:30 Breakfast at Café de Flore", "9am - Meiji Jingu", "13h30 Comida en
 * Cervecería Catalana" — under "Day 1" or date headings. Nothing about those
 * needs a language model, and asking one only adds a chance of a wrong time,
 * a dropped stop or a made-up note, a rate limit and a bill. This reads them
 * directly: the same answer every time, and nothing sent anywhere.
 *
 * It is deliberately a coward. Anything that is not plainly a list — a chat,
 * a paragraph, a line with no time, times that run backwards, a plan that
 * was changed ("skip", "instead", "cancelled") — returns null, and the model
 * reads it as before. A wrong confident answer here would be worse than the
 * model's, because it looks exactly as trustworthy.
 *
 * The output has the shape the AI import returns, as the calendar reader's
 * does, so review, placing and saving are the same whichever way it came in.
 */
import { looksLikeStreetAddress } from "./direction-stops.ts";
import { foldTravelLegs, isAirportArrival, isCityJourney, normalizeClock } from "./import-stop.ts";
import type { ParsedItinerary, ParsedItineraryItem } from "./itinerary.functions.ts";
import type { TimelineKind } from "./timeline-kind.ts";

/**
 * The most stops one list makes. More than the AI import's sixty: a ten-day
 * plan runs past a hundred lines, and reading it here costs nothing, where
 * the model would stop partway and drop the last days.
 */
const MAX_ITEMS = 150;
/** Fewer timed lines than this is not a list worth trusting. */
const MIN_ENTRIES = 3;
/** A longer line is prose, not a list entry. */
const MAX_LINE = 180;

export type PlainPlanOptions = {
  startDate: string | null;
  tripCity: string | null;
  /** For the year of a date with none when there is no start date. */
  today?: Date;
};

/** Emoji, flags and their joiners, which carry no text. */
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F|\u200D|\u20E3/gu;

/** "[07/03, 21:14] Ana:" or "3/7/26, 9:14 PM - Ana:": a chat export. */
const CHAT_LINE =
  /^\s*\[\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?,?\s+\d{1,2}:\d{2}|^\s*\d{1,2}[/.]\d{1,2}[/.]\d{2,4},?\s+\d{1,2}:\d{2}.{0,12}\s[-–]\s[^:]{1,40}:/;

/** A plan that was changed on the way needs reading, not parsing. */
const CHANGED = /~~|\b(?:cancel+ed|cancel|skip|instead|scrap|scrapped|no longer|actually)\b/i;

/** The time a list entry starts with: "08:30", "9am", "9:00–10:30", "~7:00", "13h30", "12h". */
const ENTRY_TIME =
  /^((?:~|≈|approx\.?\s*|about\s+|around\s+|ca\.\s*)?(?:\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|\d{1,2}h))(?:\s*[-–—]\s*(\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|\d{1,2}h))?(?=\s|$|[,:])/i;

const DAY_MARKER = /^(?:day|día|dia|jour|tag|giorno|dag)\s*(\d{1,2})\b/i;
const WEEKDAY =
  /\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday)?\b\.?|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const MONTHS: Record<string, number> = {
  jan: 1,
  ene: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
  dic: 12,
};
const MONTH = "(jan|ene|feb|mar|apr|abr|may|jun|jul|aug|ago|sep|oct|nov|dec|dic)[a-z]*\\.?";
const MONTH_DAY = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i");
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}(?![a-z])`, "i");
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/;

/**
 * Marked as booked in the source. Emoji first: ✅ and 🎟️ carry no word
 * boundary. "No booking needed" is the opposite and is checked separately.
 */
const BOOKED =
  /✅|🎟|\b(?:booked|reserved|confirmed|ticketed|conf|confirmation|booking ref|ref\b|tickets? (?:bought|booked)|we have tickets|reservad[oa]s?|compradas?|réservée?s?)\b|#[A-Z0-9-]{3,}/i;
/**
 * Words about tickets, seats or payment with no plain booked mark: "we have
 * seats", "got our passes", "deposit paid". Whether that is a booking is a
 * judgement, so the model makes it.
 */
const BOOKING_TALK = /\b(?:tickets?|seats?|passes|pass|deposit|paid|prepaid|reservations?)\b/i;
const NOT_BOOKED =
  /\b(?:no|not|without)\s+(?:booking|reservation|booked|tickets?)\b|\bno need to book\b/i;

/** "Lunch at X", "Comida en X", "Lunch: X" — the place is where the meal is. */
const MEAL_AT =
  /\b(?:breakfast|brunch|lunch|dinner|supper|coffee|drinks|comida|cena|desayuno|almuerzo|déjeuner|dîner|pranzo)(?:\s+(?:at|en|in|à|au|chez)\s+|\s*[:,@]\s*)(.+)$/i;
/** "Pizza at X", "cornetto @ X", "Drop bags at X": a few words, then the place. */
const THING_AT = /^((?:\S+\s+){0,3}\S+?)\s+(?:at|@)\s+(.+)$/i;
/** "Walk along the Seine to Île de la Cité": where the walk goes. */
const WALK_TO = /^(?:walk|stroll|wander|head|go)\b.*?\bto\s+(.+)$/i;
const WALK_LEAD =
  /^(?:walk|stroll|wander|paseo|passeggiata|balade|promenade)\s+(?:(?:along|around|through|in|by|por|en|dans|le long de)\s+)?(?:(?:the|el|la|les|le)\s+)?/i;
/** A segment naming a venue beats one naming a show or a neighbourhood. */
const VENUE =
  /\b(?:theat(?:re|er)|museum|stadium|hall|arena|station|airport|pier|hotel|gallery|church|cathedral)\b/i;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const DURATION =
  /^(?:about\s+|~|approx\.?\s*)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|min|mins|minutes?)(?:\s*(\d{1,2})\s*(?:min|mins|minutes?)?)?$/i;
/**
 * ", 7 Rue du Faubourg Montmartre", ", 199-206 High Holborn", or with the
 * number after the street, ", Poststraße 8", ", Hasengasse 5-7": a street address.
 */
const ADDRESS = /^\d+[\d\-–/]*[a-z]?\s+\p{L}/u;
const isAddress = (seg: string) => ADDRESS.test(seg) || looksLikeStreetAddress(seg);

/**
 * A town or district named after a street address: one to three capitalised
 * words, no number, nothing that is a note ("booked", "2nd floor").
 */
function isTownAfterAddress(seg: string): boolean {
  return (
    /^\p{Lu}[\p{L}\p{M}'’.-]*(?:\s+\p{Lu}[\p{L}\p{M}'’.-]*){0,2}$/u.test(seg) &&
    !/\b(?:floor|level|suite|unit|booked|entrance|gate|room|building|tower|station|terminal)\b/i.test(
      seg,
    )
  );
}

const FLIGHT_WORDS =
  /✈|\bflight\b|\b(?:fly|land|landing|arrive|arrival|depart|departure)\b.*\b(?:airport|terminal)\b/i;
/** "AC 764", "BA2490", "NH5": an airline's code, then the flight's number. Case matters. */
const FLIGHT_NUMBER = /\b(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}\b/;
/** "Land at JFK on AC 764": landing or leaving, with an airport code or a flight number. */
const FLIGHT_BY_CODE = /^(?:land|landing|arrive|arrival|depart|departure|fly)\b/i;
/** "LHR T5", "JFK T4": an airport code with its terminal. Case matters. */
const AIRPORT_TERMINAL = /\b[A-Z]{3}\s+T\d\b/;
const HOTEL_WORDS =
  /\b(?:hotel|hostel|ryokan|guesthouse|airbnb|check[- ]?in|check[- ]?out|overnight|drop (?:the |our |off )?(?:bags|luggage)|(?:luggage|bag) drop)\b/i;
const NOTE_WORDS = /^(?:be at|be back|meet|reminder|note)\b/i;
const TRANSPORT_WORDS =
  /\b(?:train|ferry|bus|shinkansen|eurostar|tgv|jr|line|metro|subway|tram|taxi|uber|coach|transfer)\b/i;
const WALK_WORDS = /^(?:walk|stroll|wander|hike|paseo|passeggiata|balade|promenade)\b|\bwalk\b/i;
const MEAL_WORDS =
  /\b(?:breakfast|brunch|lunch|dinner|supper|coffee|caf[eéè]|caffè|cornetto|pastry|pizza|tacos?|ramen|sushi|yakitori|okonomiyaki|anago|cacio|drinks|bar|comida|cena|desayuno|restaurant|bistro|trattoria|bouillon|cervecer[ií]a|brasserie|izakaya)\b/i;
const SIGHT_WORDS =
  /\b(?:museum|musée|museo|shrine|temple|jingu|taisha|castle|cathedral|catedral|chapelle|chapel|church|basilica|mosque|palace|market|mercat|mercado|park|parc|parque|garden|tower|bridge|sky|rooftop|view|miradouro|fountain|pantheon|colosseum|forum|monastery|gallery|tate|carousel|terrace|top of the rock|the met|square|plaza|steps|beach|playa|búnkers)\b|-(?:ji|dera)\b/i;

type Entry = { time: string; end: string | null; rest: string; raw: string };
type Heading = { dayNumber: number | null; date: string | null; titleText: string | null };

/**
 * A plan read straight from a tidy list, or null when the text is not one
 * and the model should read it instead.
 */
export function readPlainPlan(text: string, opts: PlainPlanOptions): ParsedItinerary | null {
  const lines = text
    .split(/\r?\n/)
    .map(tableRow)
    .filter((l): l is string => Boolean(l));
  if (lines.length < MIN_ENTRIES) return null;
  if (lines.some((l) => CHAT_LINE.test(l))) return null;
  if (CHANGED.test(text.replace(/skip[- ]the[- ]line/gi, ""))) return null;

  const year = yearFor(opts);
  let tripTitle: string | null = null;
  let dayNumber = 0;
  let dayDate: string | null = null;
  let inDay = 0;
  const items: ParsedItineraryItem[] = [];
  let entries = 0;
  let lastTime: string | null = null;
  /** The towns the day heading names: one, or two on a travel day ("Paris → Lyon"). */
  let dayCities: string[] = [];
  let cityAt = 0;
  /** Where a day trip has taken the traveller, from the plan's own arrivals. */
  let away: TownTrail = { town: null, before: null };

  for (const [index, raw] of lines.entries()) {
    if (raw.length > MAX_LINE) return null;
    const entry = readEntry(raw);
    if (entry) {
      if (dayNumber === 0) dayNumber = 1;
      inDay++;
      // Times that run backwards within a day are a 12-hour list with the
      // am/pm left off ("9:00 … 1:00 … 3:00"), or not a timeline at all.
      if (lastTime && entry.time < lastTime) return null;
      lastTime = entry.time;
      const stop = readStop(entry);
      if (!stop) return null;
      const dayHome =
        dayCities.length === 1 ? dayCities[0]! : dayCities.length ? null : opts.tripCity;
      // A travel day's heading already says where its journey goes.
      const moved = followTown(away, stop, entry.rest, dayCities.length > 1 ? undefined : dayHome);
      // Leaving is still where you leave from; arriving is already there.
      const here = moved.leaving ? away.town : moved.trail.town;
      away = moved.trail;
      const city = here ?? dayCities[Math.min(cityAt, dayCities.length - 1)] ?? null;
      // On a travel day, the stops after the journey are in the next town.
      // Getting to the airport is not the journey: the flight after it is.
      const journey =
        (stop.kind === "transport" && !TO_AIRPORT.test(stop.title)) ||
        (stop.kind === "flight" &&
          !(isAirportArrival(stop.title) && flightLater(lines, index, year, opts.startDate)));
      if (journey && cityAt < dayCities.length - 1) {
        cityAt++;
      }
      items.push({
        ...stop,
        city,
        day_number: dayNumber,
        day_date: dayDate ?? dateAfter(opts.startDate, dayNumber - 1),
        time_label: entry.time,
        end_time: entry.end,
      });
      entries++;
      continue;
    }
    const heading = readHeading(raw, year, opts.startDate);
    if (heading) {
      if (index === 0 && heading.titleText) tripTitle = heading.titleText;
      if (heading.dayNumber != null || heading.date || dayOnly(raw)) {
        // "Day 4 — 2026-10-15 — Lyon": the day's town. A heading naming
        // none keeps the last one: the traveller has not moved.
        const named = headingCities(heading.titleText);
        if (named.length) dayCities = named;
        else if (dayCities.length > 1) dayCities = dayCities.slice(-1);
        cityAt = 0;
        away = { town: null, before: null };
        // A second heading before any stop ("Paris — Saturday", then
        // "Oct 10") names the same day rather than starting another.
        if (heading.dayNumber != null) dayNumber = heading.dayNumber;
        else if (inDay > 0 || dayNumber === 0) dayNumber++;
        dayDate = heading.date ?? (inDay > 0 ? null : dayDate);
        inDay = 0;
        lastTime = null;
      }
      continue;
    }
    // Only the first line may be a plain title ("ROME IN A DAY", "Kyoto day").
    if (index === 0) {
      tripTitle = cleanText(raw) || null;
      continue;
    }
    return null;
  }

  if (entries < MIN_ENTRIES || items.length > MAX_ITEMS) return null;

  const folded = foldTravelLegs(items);
  const dates = folded
    .map((i) => i.day_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const days = new Set(folded.map((i) => i.day_date ?? `#${i.day_number}`)).size;
  const city = (opts.tripCity ?? "").split(",")[0]!.trim();
  return {
    summary: `${folded.length} stops over ${days} ${days === 1 ? "day" : "days"}, read line by line from your plan.`,
    trip_title: tripTitle || (city ? `${city} trip` : "Your trip"),
    start_date: dates[0] ?? opts.startDate ?? null,
    end_date: dates[dates.length - 1] ?? null,
    estimated_total: null,
    currency: null,
    costs: [],
    items: folded,
  };
}

/** Whether a flight leaves after line `index`, before the next day starts. */
function flightLater(
  lines: readonly string[],
  index: number,
  year: number,
  startDate: string | null,
): boolean {
  for (const raw of lines.slice(index + 1)) {
    const entry = readEntry(raw);
    if (!entry) {
      const heading = readHeading(raw, year, startDate);
      if (heading && (heading.dayNumber != null || heading.date || dayOnly(raw))) return false;
      continue;
    }
    const stop = readStop(entry);
    if (stop?.kind === "flight" && !isAirportArrival(stop.title)) return true;
  }
  return false;
}

/**
 * A table row as a plain line: "| 09:00–09:40 | Brandenburg Gate | stop |"
 * or the same with tabs, as a table copied out of a chat comes. The time
 * cell leads and the others follow as notes. The header row ("Time | Place
 * / note") and the rule under it say nothing, so they go.
 */
function tableRow(raw: string): string | null {
  const line = raw.trim();
  if (!line) return null;
  if (/^\|?[\s:|-]+\|[\s:|-]*$/.test(line)) return null;
  const cells = line.includes("|")
    ? line.replace(/^\||\|$/g, "").split("|")
    : line.includes("\t")
      ? line.split(/\t+/)
      : null;
  const parts = (cells ?? [line]).map((c) => c.trim()).filter(Boolean);
  if (parts.length > 1 && /^time$/i.test(parts[0]!)) return null;
  if (!cells || parts.length < 2) return parts.join(" ") || null;
  return `${parts[0]} ${parts.slice(1).join(" - ")}`;
}

type TownTrail = { town: string | null; before: string | null };

/** "Take the Haruka to Kansai Airport": still the town it leaves; the flight is the journey. */
const TO_AIRPORT = /\bto\s+(?:\S+\s+){0,3}(?:airport|terminal)\b|空港/i;
/** "Train from Edinburgh Waverley to Stirling": where a journey between towns goes. */
const JOURNEY_TO = /\bfrom\s+.+?\s+(?:back\s+)?to\s+(.+)$/i;

/** Arriving by rail or boat names the town: "Hiroshima Station — arrival". */
const ARRIVAL_PLACE = /^(.+?)\s+(?:station|pier|port|ferry terminal)$/i;
/** "morning departure toward Himeji", "return to Osaka": the town only, one word. */
const HEADING_TO = /\b(?:toward|towards|to)\s+(\p{Lu}[\p{L}-]+)(?![\p{L}-])(?!\s+\p{Lu})/u;
/** The note says only that this is an arrival: "arrival", "island arrival". */
const ARRIVAL_NOTE = /^(?:[\p{L}-]+\s+)?arriv(?:al|e|ing)$/iu;
/** A name alone, with nothing to say it is a venue: "Miyajima". */
const BARE_TOWN = /^\p{Lu}[\p{L}-]+(?:\s\p{Lu}[\p{L}-]+)?$/u;

/**
 * Which town the traveller is in, after this stop, when the plan says it only
 * by moving: "Hiroshima Station — arrival" puts the rest of the day in
 * Hiroshima, "Miyajima — island arrival" on the island, and "return boat"
 * back where they came from; "departure toward Himeji" sends them on. A
 * train with no destination leaves them nowhere the plan names, and the
 * trip's own town for the day answers. The day's heading starts afresh.
 *
 * Only a plain arrival counts: an airport is where a trip lands, not a town
 * to look its stops up in.
 */
function followTown(
  trail: TownTrail,
  stop: { kind: string; title: string; detail: string | null },
  rest: string,
  /** The town the day is in; undefined on a travel day, whose heading names the journey. */
  home: string | null | undefined,
): { trail: TownTrail; leaving: boolean } {
  const note = (stop.detail ?? "").trim();
  const journey = stop.kind === "transport" || stop.kind === "flight";
  // "Train from Edinburgh Waverley to Stirling": a day trip, on a day whose
  // heading names one town. The stops after it are in Stirling until the
  // train back to the town the day is in ("… back to Edinburgh Waverley").
  const to =
    home !== undefined && stop.kind === "transport" && isCityJourney(stop.title)
      ? stop.title.match(JOURNEY_TO)
      : null;
  if (to) {
    // "Train from Sintra to Rossio Station", on a day trip to Sintra: back
    // where the day started, whatever the station there is called.
    const from = stop.title.match(/\bfrom\s+(.+?)\s+(?:back\s+)?to\s/i)?.[1] ?? "";
    if (trail.town && from.toLowerCase().includes(trail.town.toLowerCase())) {
      return { trail: { town: trail.before, before: null }, leaving: true };
    }
    const dest = cleanText(to[1]!.replace(/\s*[(（].*$/, ""));
    const homeTown = (home ?? "").split(",")[0]!.trim().toLowerCase();
    if (homeTown && dest.toLowerCase().includes(homeTown)) {
      return { trail: { town: null, before: null }, leaving: true };
    }
    const town = dest.match(ARRIVAL_PLACE)?.[1] ?? dest;
    // A second hop (train to Machu Picchu Station, then the bus up) keeps
    // where the day trip started, so the train back goes home, not a hop back.
    const before = trail.town ? trail.before : null;
    if (BARE_TOWN.test(town)) return { trail: { town, before }, leaving: true };
  }
  const heading = /\b(?:depart|departure|return|back)\b/i.test(note)
    ? note.match(HEADING_TO)
    : null;
  if (heading) return { trail: { town: heading[1]!, before: trail.town }, leaving: true };
  if (ARRIVAL_NOTE.test(note) && !/\bairport\b/i.test(rest)) {
    const place = stop.title.match(ARRIVAL_PLACE)?.[1];
    const town = place ?? (BARE_TOWN.test(stop.title) ? stop.title : null);
    if (town) return { trail: { town, before: trail.town }, leaving: false };
  }
  if (/\breturn\b/i.test(note))
    return { trail: { town: trail.before, before: null }, leaving: true };
  if (journey) return { trail: { town: null, before: null }, leaving: true };
  return { trail, leaving: false };
}

/** A line that starts with a time, split into the time and what follows. */
function readEntry(raw: string): Entry | null {
  const line = stripLead(raw.replace(EMOJI, " ").replace(/\s+/g, " ").trim());
  const m = line.match(ENTRY_TIME);
  if (!m) return null;
  const time = normalizeClock(m[1]);
  if (!time) return null;
  // "9:00–10:30": an end time, when it reads as one.
  const end = m[2] ? normalizeClock(m[2]) : null;
  const rest = line
    .slice(m[0].length)
    .replace(/^\s*[-–—:|·]\s*/, "")
    .trim();
  if (!rest) return null;
  return { time, end: end && end > time ? end : null, rest, raw };
}

/** Bullets and arrows people put before a time: "- 9:00", "• 9:00", "> 9:00". */
function stripLead(line: string): string {
  return line.replace(/^[\s\-–—•*·>]+/, "").trim();
}

/** Emoji, doubled spaces and dangling punctuation gone. */
function cleanText(s: string): string {
  return s
    .replace(EMOJI, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:·—–-]+|[\s,;:·—–-]+$/g, "")
    .trim();
}

function readStop(
  entry: Entry,
): Omit<ParsedItineraryItem, "day_number" | "day_date" | "time_label" | "end_time"> | null {
  const notBooked = NOT_BOOKED.test(entry.raw);
  const booked = BOOKED.test(entry.raw) && !notBooked;
  if (!booked && !notBooked && BOOKING_TALK.test(entry.raw)) return null;
  let text = entry.rest.replace(EMOJI, " ").replace(/\s+/g, " ").trim();

  // Parentheses: a local-language name stays with the place, a length is
  // the stay, anything else is a note.
  const notes: string[] = [];
  let duration: number | null = null;
  let bracketPlace: string | null = null;
  text = text.replace(/\s*\(([^()]*)\)/g, (whole, inner: string) => {
    const body = inner.trim();
    if (!body) return "";
    if (CJK.test(body) && !/[a-z]{3}/i.test(body)) return whole;
    const d = body.match(DURATION);
    if (d) {
      const n = Number(d[1]);
      const unit = d[2]!.toLowerCase();
      duration = Math.round(unit.startsWith("h") ? n * 60 + Number(d[3] ?? 0) : n);
      return "";
    }
    // "(booked, Kyoto Gion Yuki)": the booking names the actual venue.
    const named = body
      .split(/\s*,\s*/)
      .find(
        (seg) => !BOOKED.test(seg) && /^\p{Lu}/u.test(seg) && /\s/.test(seg) && !/\d/.test(seg),
      );
    if (named) bracketPlace = named;
    notes.push(body);
    return "";
  });
  text = cleanText(text.replace(/\s*(?:🎟|✅)?\s*\bbooked\b\s*$/i, ""));

  // " — go early", " — reservation confirmed #8843": the rest is a note.
  let main = text;
  let dashNote: string | null = null;
  // A plain hyphen with spaces round it does the same job in most plans
  // ("Städel Museum, Schaumainkai 63 - 700 years of European art"), except
  // on a journey, where it joins two towns ("Train Paris - Lyon").
  const dash =
    text.match(/^(.+?)\s+[—–]\s+(.+)$/) ??
    (TRANSPORT_WORDS.test(text) || FLIGHT_WORDS.test(text)
      ? null
      : text.match(/^(.+?)\s+-\s+(.+)$/));
  if (dash) {
    main = cleanText(dash[1]!);
    dashNote = cleanText(dash[2]!);
  }

  // A street address given after a comma is kept verbatim and taken out of the title.
  let address: string | null = null;
  const segments = main.split(/\s*,\s*/);
  const addrAt = segments.findIndex((seg, i) => i > 0 && isAddress(seg));
  if (addrAt > 0) {
    address = segments[addrAt]!;
    // "Leura Garage, 84 Railway Parade, Leura": the town after the street is
    // where the street is. Railway Parade runs through Katoomba too.
    const town = segments[addrAt + 1];
    const tail = addrAt + 2 === segments.length && town && isTownAfterAddress(town);
    if (tail) address = `${address}, ${town}`;
    segments.splice(addrAt, tail ? 2 : 1);
    main = segments.join(", ");
  }
  if (!main) return null;

  const kind = kindFor(`${main} ${dashNote ?? ""}`, entry.raw, booked);
  let place = placeFor(main, kind);
  let title = main;
  if (dashNote) {
    // "Back in Hiroshima — okonomiyaki at Okonomimura": the stop is the meal.
    const inNote = !MEAL_AT.test(main) && !THING_AT.test(main) ? mealPlace(dashNote) : null;
    if (inNote) {
      place = inNote;
      title = `${main} — ${dashNote}`;
      dashNote = null;
    }
  }
  if (bracketPlace && kind === "meal") place = bracketPlace;

  const detail = [dashNote, ...notes].filter(Boolean).join(" · ") || null;
  return {
    duration_minutes: duration,
    kind,
    title: title.slice(0, 200),
    detail: detail ? detail.slice(0, 300) : null,
    place: place || null,
    address,
    city: null,
    estimated_cost: null,
    currency: null,
    source: null,
    booked,
  };
}

function mealPlace(text: string): string | null {
  if (!MEAL_AT.test(text) && !(MEAL_WORDS.test(text) && THING_AT.test(text))) return null;
  return placeFor(text, "meal");
}

/** The one place to look this stop up by. */
function placeFor(main: string, kind: TimelineKind): string {
  const meal = main.match(MEAL_AT);
  // "Lunch: anago-meshi at Ueno": the dish, then where.
  if (meal) return trimPlace(meal[1]!.match(THING_AT)?.[2] ?? meal[1]!);
  const at = main.match(THING_AT);
  if (at) return trimPlace(at[2]!);
  if (kind === "walk") {
    const to = main.match(WALK_TO);
    if (to) return trimPlace(to[1]!);
  }
  let text = main;
  // "Broadway: Hamilton": a short label, then the thing.
  const label = text.match(/^(\S+(?:\s\S+)?):\s+(.+)$/);
  if (label) text = label[2]!;
  const segments = text.split(/\s*,\s*/);
  const venue = segments.find((seg) => VENUE.test(seg));
  let first = venue ?? segments[0]!;
  if (kind === "transport" || kind === "flight") {
    first = first.split(/\s*(?:→|->)\s*/)[0]!;
    // "Eurostar 9O 9031 London St Pancras": the service, then where it leaves.
    first = first.replace(/^(?:\p{L}+\s+)?(?:[A-Z0-9]{1,3}\s*\d{2,5}\s+)+/u, "");
    first = first.replace(/^(?:land|arrive|depart)\s+(?:at\s+|from\s+|in\s+)?/i, "");
    // "JFK on AC 764": the airport, not the flight that lands there.
    first = first.replace(/\s+(?:on|with|via)\s+(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}\b.*$/, "");
    // "Train from Paris Gare de Lyon to Lyon Part-Dieu": where it leaves.
    // "Train from Stirling back to Edinburgh": Stirling, not "Stirling back".
    const from = first.match(/\bfrom\s+(.+?)\s+(?:back\s+)?to\s+\S/i);
    if (from) first = from[1]!;
  }
  return trimPlace(first.replace(WALK_LEAD, ""));
}

/** The place without what comes after it: "X / Y", "X + Y", "X for yakitori". */
function trimPlace(text: string): string {
  return cleanText(
    text
      .split(/\s*,\s*/)[0]!
      .split(/\s+(?:\/|\+|→|->)\s+/)[0]!
      .replace(/\s+(?:by|before|from)\s+\d.*$/i, "")
      .replace(/\s+(?:for|para|pour|per)\s+.*$/i, "")
      .replace(/\s+(?:breakfast|brunch|lunch|dinner|walk|tour|visit)$/i, ""),
  );
}

function kindFor(text: string, raw: string, booked: boolean): TimelineKind {
  // A flight is fixed in the day and needs a ticket, booked or not: kept as
  // a flight, it stays a stop at the airport and counts as a plan to book.
  if (FLIGHT_WORDS.test(text) || AIRPORT_TERMINAL.test(raw)) return "flight";
  if (FLIGHT_BY_CODE.test(text) && (FLIGHT_NUMBER.test(raw) || /\b[A-Z]{3}\b/.test(text))) {
    return "flight";
  }
  // "Breakfast at the Hotel Adlon" is a meal, wherever it is eaten.
  if (/^(?:breakfast|brunch|lunch|dinner|supper)\b/i.test(text)) return "meal";
  if (HOTEL_WORDS.test(text)) return booked ? "hotel" : "lodging";
  if (NOTE_WORDS.test(text)) return "note";
  // "Hanoi Train Street" is a street to walk, not a train to catch.
  const moving = text.replace(/\btrain street\b/gi, "");
  if (TRANSPORT_WORDS.test(moving) || /^(?:take|catch|board|hop on)\b.*\bto\b/i.test(moving)) {
    return "transport";
  }
  if (WALK_WORDS.test(text)) return "walk";
  if (MEAL_WORDS.test(text)) return "meal";
  if (SIGHT_WORDS.test(text)) return "sight";
  return "activity";
}

/** Words a day heading uses for a theme, not a town: "Arrival", "Free day". */
const THEME_WORDS =
  /^(?:arrival|arrive|arriving|departure|depart|departing|free|rest|travel|travelling|traveling|leisure|explore|exploring|relax|day|trip|morning|afternoon|evening|last|first|final|full|half|optional|museums?|food|beach|shopping|home|flight|fly|drive|road|getting)\b/i;
/** Lower-case words a town's name may carry: "Aix-en-Provence", "Frankfurt am Main". */
const NAME_JOINERS = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "del",
  "di",
  "da",
  "do",
  "dos",
  "am",
  "an",
  "im",
  "sur",
  "en",
  "upon",
  "on",
  "of",
  "y",
  "e",
  "el",
  "al",
  "and",
]);

/**
 * The towns a day heading names after its date: "Lyon", "Lyon, France", or
 * "Paris → Lyon" on a travel day. Empty for a theme ("Museums and markets",
 * "Arrival") — a wrong town would send every lookup that day astray, and the
 * trip's own area is the better guess.
 */
export function headingCities(text: string | null): string[] {
  if (!text) return [];
  const parts = text.split(/\s*(?:→|->|⟶|➔|➜)\s*/).map((p) => cleanText(p));
  if (parts.length > 3 || parts.some((p) => !looksLikeTown(p))) return [];
  return parts;
}

function looksLikeTown(text: string): boolean {
  if (!text || text.length > 60 || THEME_WORDS.test(text)) return false;
  if (!/^[\p{L}\p{M}\s,'’.-]+$/u.test(text)) return false;
  const words = text.split(/[\s,]+/).filter(Boolean);
  if (words.length > 6) return false;
  return words.every(
    (w) => /^\p{Lu}/u.test(w) || NAME_JOINERS.has(w.toLowerCase()) || !/^\p{L}/u.test(w),
  );
}

/** A day or date heading, or the plan's title line. Null for anything else. */
function readHeading(raw: string, year: number, startDate: string | null): Heading | null {
  const line = cleanText(raw);
  if (!line || line.length > 100) return null;
  const day = line.match(DAY_MARKER);
  const date = readDate(line, year, startDate);
  const rest = cleanText(
    line
      .replace(DAY_MARKER, "")
      .replace(ISO_DATE, "")
      .replace(MONTH_DAY, "")
      .replace(DAY_MONTH, "")
      .replace(new RegExp(WEEKDAY.source, "gi"), ""),
  );
  const titleText = /\p{L}{3,}/u.test(rest) ? rest : null;
  if (!day && !date && !dayOnly(line)) return null;
  return { dayNumber: day ? Number(day[1]) : null, date, titleText };
}

/** "Paris — Saturday": a weekday alone still starts a day. */
function dayOnly(raw: string): boolean {
  return WEEKDAY.test(raw) && !ENTRY_TIME.test(stripLead(raw));
}

function readDate(line: string, year: number, startDate: string | null): string | null {
  const iso = line.match(ISO_DATE);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const md = line.match(MONTH_DAY);
  const dm = md ? null : line.match(DAY_MONTH);
  const month = md
    ? MONTHS[md[1]!.slice(0, 3).toLowerCase()]
    : dm
      ? MONTHS[dm[2]!.slice(0, 3).toLowerCase()]
      : null;
  const dayOfMonth = md ? Number(md[2]) : dm ? Number(dm[1]) : null;
  if (!month || !dayOfMonth || dayOfMonth > 31) return null;
  let y = year;
  // A date well before the trip starts is next year's ("Jan 3" on a December trip).
  if (startDate && isoOf(y, month, dayOfMonth) < dateAfter(startDate, -180)!) y++;
  return isoOf(y, month, dayOfMonth);
}

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function yearFor(opts: PlainPlanOptions): number {
  const fromStart = opts.startDate?.match(/^(\d{4})-\d{2}-\d{2}$/);
  return fromStart ? Number(fromStart[1]) : (opts.today ?? new Date()).getFullYear();
}

/** The date `days` after an ISO date, or null without one. */
function dateAfter(iso: string | null, days: number): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
