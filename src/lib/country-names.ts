/**
 * One country, whatever it is called.
 *
 * Countries on pins are free text, written by whoever saved them and in
 * whatever language they think in: "Japan", "Japon", "日本", "Japón". Matched
 * as strings, those were four countries — four entries in a list, and a
 * globe that shaded Japan for one of them only. So every name is read down
 * to its ISO 3166 code first.
 *
 * The names come from the browser's own Intl data, in the languages below,
 * so no list of translations has to be kept here; the aliases cover what
 * Intl does not say (USA, Holland) and the shortened names on the globe's
 * outline data ("Dem. Rep. Congo").
 */

import { foldAccents } from "./fuzzy.ts";

/** ISO 3166-1 alpha-2, every assigned code. */
const CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS " +
  "BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE " +
  "EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM " +
  "HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC " +
  "LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA " +
  "NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO " +
  "TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ");

/** The languages names are recognised in: the ones travellers most write in. */
const LOCALES = [
  "en",
  "fr",
  "es",
  "de",
  "it",
  "pt",
  "nl",
  "sv",
  "da",
  "nb",
  "fi",
  "pl",
  "cs",
  "hu",
  "ro",
  "el",
  "tr",
  "ru",
  "uk",
  "ar",
  "he",
  "fa",
  "hi",
  "th",
  "vi",
  "id",
  "ms",
  "ja",
  "ko",
  "zh",
  "zh-Hant",
  "ca",
];

/** What Intl does not say, and the short forms on the globe's own outlines. */
const ALIASES: Record<string, string[]> = {
  US: [
    "usa",
    "us",
    "u s",
    "u s a",
    "america",
    "united states of america",
    "etats unis",
    "estados unidos de america",
    "eeuu",
    "ee uu",
  ],
  GB: ["uk", "u k", "great britain", "britain", "england", "scotland", "wales", "northern ireland"],
  NL: ["holland", "the netherlands"],
  CZ: ["czech republic", "czechia", "tchequie"],
  KR: ["korea", "republic of korea", "south korea"],
  KP: ["north korea", "dprk", "dem rep korea"],
  CD: ["dem rep congo", "democratic republic of the congo", "drc", "dr congo", "congo kinshasa"],
  CG: ["congo", "congo brazzaville", "republic of the congo"],
  CI: ["ivory coast", "cote divoire", "cote d ivoire"],
  SZ: ["swaziland", "eswatini"],
  MK: ["macedonia", "north macedonia"],
  MM: ["burma"],
  CV: ["cape verde"],
  TL: ["east timor", "timor leste"],
  BA: ["bosnia and herz", "bosnia"],
  CF: ["central african rep"],
  DO: ["dominican rep"],
  GQ: ["eq guinea"],
  SB: ["solomon is"],
  SS: ["s sudan"],
  EH: ["w sahara"],
  TF: ["fr s antarctic lands", "french southern and antarctic lands"],
  HM: ["heard island and mcdonald islands"],
  VC: ["st vincent and the grenadines"],
  FK: ["falkland is"],
  RS: ["republic of serbia"],
  TZ: ["united republic of tanzania"],
  RU: ["russian federation"],
  SY: ["syrian arab republic"],
  IR: ["islamic republic of iran"],
  VA: ["vatican", "holy see"],
  PS: ["palestine", "gaza strip", "west bank"],
  TW: ["taiwan province of china"],
  CY: [
    "n cyprus",
    "northern cyprus",
    "dhekelia sovereign base area",
    "akrotiri sovereign base area",
  ],
  XK: ["kosovo"],
  LA: ["lao pdr", "laos"],
  VN: ["viet nam"],
  BN: ["brunei darussalam"],
  TR: ["turkey", "turkiye", "turquie", "turquia", "turkei"],
  SO: ["somaliland"],
  HK: ["hong kong s a r", "hong kong sar"],
  MO: ["macau s a r", "macau sar", "macau", "macao"],
  FM: ["federated states of micronesia", "micronesia"],
  GS: ["south georgia and the islands"],
  UM: ["united states minor outlying islands"],
  VI: ["united states virgin islands", "us virgin islands"],
  // Territories the outline data names on their own, read as the country
  // that holds them.
  AU: ["ashmore and cartier islands", "coral sea islands", "indian ocean territories"],
  FR: ["clipperton island"],
  KZ: ["baykonur cosmodrome"],
  IN: ["siachen glacier"],
  CU: ["us naval base guantanamo bay"],
};

/** Accents, case, punctuation and a leading "the" do not change a country. */
function fold(name: string): string {
  return (
    foldAccents(name)
      .replace(/&/g, " and ")
      .replace(/[.'’`´,()]/g, " ")
      .replace(/[-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^the /, "")
      // "Saint Kitts" and "St. Kitts" are one place.
      .replace(/\bsaint\b/g, "st")
  );
}

let byName: Map<string, string> | null = null;

function table(): Map<string, string> {
  if (byName) return byName;
  const map = new Map<string, string>();
  const add = (name: string, code: string) => {
    const key = fold(name);
    // The first language to claim a name keeps it: English before the rest.
    if (key && !map.has(key)) map.set(key, code);
  };
  for (const locale of LOCALES) {
    let names: Intl.DisplayNames;
    try {
      names = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
    } catch {
      continue; // a runtime without this language
    }
    for (const code of CODES) {
      const name = names.of(code);
      if (name) add(name, code);
    }
  }
  for (const [code, aliases] of Object.entries(ALIASES)) for (const a of aliases) add(a, code);
  byName = map;
  return map;
}

/** The ISO 3166 code for a country name in any of the languages above, or null. */
export function countryCode(name: string | null | undefined): string | null {
  const raw = (name ?? "").trim();
  if (!raw) return null;
  // Already a code: "JP", "jp".
  if (/^[a-z]{2}$/i.test(raw) && CODES.includes(raw.toUpperCase())) {
    return raw.toUpperCase();
  }
  return table().get(fold(raw)) ?? null;
}

/**
 * A stable key for a country name: its code when it is recognised, else the
 * folded name — so an unknown spelling still counts once, not never.
 */
export function countryKey(name: string | null | undefined): string {
  return countryCode(name) ?? fold(name ?? "");
}

/** The country's name in a language, for display; the name as given when unknown. */
export function countryDisplayName(name: string | null | undefined, locale = "en"): string {
  const code = countryCode(name);
  if (!code) return (name ?? "").trim();
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? (name ?? "").trim();
  } catch {
    return (name ?? "").trim();
  }
}
