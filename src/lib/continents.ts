/**
 * The continent a country is in, so a city you have been to also counts
 * its continent: Montreal is Québec, Canada and North America.
 *
 * Seven continents, the way most travellers count them. Central America and
 * the Caribbean are North America; Russia is Europe (its capital and most of
 * its people); Türkiye and the Caucasus are Asia; Egypt is Africa. Keyed
 * by ISO 3166-1 alpha-2, as `countryKey` returns it.
 *
 * Kept free of the globe so it can be tested under node.
 */

export type Continent =
  "Africa" | "Antarctica" | "Asia" | "Europe" | "North America" | "Oceania" | "South America";

const CODES: Record<Continent, string> = {
  Africa:
    "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW",
  Antarctica: "AQ BV GS HM TF",
  Asia: "AF AM AZ BH BD BT BN KH CN GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE IO CX CC",
  Europe:
    "AX AL AD AT BY BE BA BG HR CY CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB",
  "North America":
    "AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM",
  Oceania: "AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF",
  "South America": "AR BO BR CL CO EC FK GF GY PY PE SR UY VE",
};

const BY_CODE = new Map<string, Continent>();
for (const [continent, codes] of Object.entries(CODES) as [Continent, string][]) {
  for (const code of codes.split(" ")) BY_CODE.set(code, continent);
}
// `countryKey` does not read plain "Hong Kong" as HK (only "Hong Kong SAR"),
// so a Hong Kong city stays a city; its folded name is its key instead.
BY_CODE.set("HONG KONG", "Asia");

/** The continent of a country's ISO code (`countryKey`), or null when it is not one. */
export function continentOf(countryKey: string | null | undefined): Continent | null {
  return BY_CODE.get((countryKey ?? "").toUpperCase()) ?? null;
}

export type ContinentVisits = {
  continent: Continent;
  /** The countries you have been to there, in the order given. */
  countries: string[];
};

/**
 * The continents you have been to, A–Z, each with its countries. A country
 * whose name was not recognised (so has no ISO code) counts toward none.
 */
export function visitedContinents(
  countries: readonly { key: string; country: string }[],
): ContinentVisits[] {
  const found = new Map<Continent, ContinentVisits>();
  for (const { key, country } of countries) {
    const continent = continentOf(key);
    if (!continent) continue;
    const seen = found.get(continent) ?? { continent, countries: [] };
    seen.countries.push(country);
    found.set(continent, seen);
  }
  return [...found.values()].sort((a, b) => a.continent.localeCompare(b.continent));
}
