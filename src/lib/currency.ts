/**
 * Which money a country spends, and reading an amount as a traveller types it.
 * Pure, so the trip's currency sheet can be tested without a network.
 */
import { countryCode } from "./country-names.ts";

const EURO = [
  "AD",
  "AT",
  "BE",
  "BG",
  "BL",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GF",
  "GP",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MC",
  "ME",
  "MF",
  "MQ",
  "MT",
  "NL",
  "PM",
  "PT",
  "RE",
  "SI",
  "SK",
  "SM",
  "VA",
  "XK",
  "YT",
];

const DOLLAR = ["US", "PR", "EC", "SV", "PA", "TL", "VG", "BQ", "FM", "MH", "PW", "TC"];

/** ISO 3166 country → ISO 4217 currency, for the places people travel to. */
const BY_COUNTRY: Record<string, string> = {
  ...Object.fromEntries(EURO.map((c) => [c, "EUR"])),
  ...Object.fromEntries(DOLLAR.map((c) => [c, "USD"])),
  AE: "AED",
  AL: "ALL",
  AM: "AMD",
  AR: "ARS",
  AU: "AUD",
  AW: "AWG",
  AZ: "AZN",
  BA: "BAM",
  BB: "BBD",
  BD: "BDT",
  BH: "BHD",
  BO: "BOB",
  BR: "BRL",
  BS: "BSD",
  BW: "BWP",
  BZ: "BZD",
  CA: "CAD",
  CH: "CHF",
  CI: "XOF",
  CL: "CLP",
  CM: "XAF",
  CN: "CNY",
  CO: "COP",
  CR: "CRC",
  CU: "CUP",
  CV: "CVE",
  CW: "ANG",
  CZ: "CZK",
  DK: "DKK",
  DO: "DOP",
  DZ: "DZD",
  EG: "EGP",
  ET: "ETB",
  FJ: "FJD",
  FO: "DKK",
  GB: "GBP",
  GE: "GEL",
  GG: "GBP",
  GH: "GHS",
  GI: "GIP",
  GL: "DKK",
  GT: "GTQ",
  HK: "HKD",
  HN: "HNL",
  HU: "HUF",
  ID: "IDR",
  IL: "ILS",
  IM: "GBP",
  IN: "INR",
  IS: "ISK",
  JE: "GBP",
  JM: "JMD",
  JO: "JOD",
  JP: "JPY",
  KE: "KES",
  KH: "KHR",
  KR: "KRW",
  KW: "KWD",
  KZ: "KZT",
  LA: "LAK",
  LB: "LBP",
  LI: "CHF",
  LK: "LKR",
  MA: "MAD",
  MD: "MDL",
  MG: "MGA",
  MK: "MKD",
  MN: "MNT",
  MO: "MOP",
  MU: "MUR",
  MV: "MVR",
  MX: "MXN",
  MY: "MYR",
  NA: "NAD",
  NC: "XPF",
  NG: "NGN",
  NI: "NIO",
  NO: "NOK",
  NP: "NPR",
  NZ: "NZD",
  OM: "OMR",
  PE: "PEN",
  PF: "XPF",
  PH: "PHP",
  PK: "PKR",
  PL: "PLN",
  PY: "PYG",
  QA: "QAR",
  RO: "RON",
  RS: "RSD",
  RU: "RUB",
  RW: "RWF",
  SA: "SAR",
  SC: "SCR",
  SE: "SEK",
  SG: "SGD",
  SN: "XOF",
  TH: "THB",
  TN: "TND",
  TR: "TRY",
  TT: "TTD",
  TW: "TWD",
  TZ: "TZS",
  UA: "UAH",
  UG: "UGX",
  UY: "UYU",
  UZ: "UZS",
  VN: "VND",
  ZA: "ZAR",
  ZM: "ZMW",
};

/** The currency spent in a country, from its name in any language or its code. */
export function currencyForCountry(country: string | null | undefined): string | null {
  const code = countryCode(country);
  return code ? (BY_COUNTRY[code] ?? null) : null;
}

/**
 * The local currencies of a trip's countries, in the order given and each
 * once, leaving out the traveller's own money.
 */
export function localCurrencies(
  countries: readonly (string | null | undefined)[],
  home: string,
): string[] {
  const out: string[] = [];
  for (const country of countries) {
    const cur = currencyForCountry(country);
    if (cur && cur !== home && !out.includes(cur)) out.push(cur);
  }
  return out;
}

/**
 * An amount as typed: "12.50", "12,50", "1 234,5", "1,234.50", "€20".
 * The last "." or "," is the decimal mark when one or two digits follow it;
 * every other separator groups thousands. Null for anything not a number.
 */
export function parseAmount(input: string): number | null {
  const raw = input.replace(/[\s']/g, "").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(raw)) return null;
  const mark = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  let text = raw;
  if (mark >= 0) {
    const tail = raw.slice(mark + 1);
    const head = raw.slice(0, mark).replace(/[.,]/g, "");
    text = tail.length > 0 && tail.length <= 2 ? `${head}.${tail}` : head + tail;
  }
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Round amounts to show for a currency: a 1-yen coin is not worth a row. */
export function quickAmounts(rateToHome: number | null): number[] {
  // rateToHome: how many units of the currency one unit of home money buys.
  const steps = [
    1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000,
    500000, 1000000,
  ];
  const unit = rateToHome && rateToHome > 0 ? rateToHome : 1;
  const found = steps.findIndex((s) => s >= unit * 0.9);
  const start = found < 0 ? steps.length - 6 : Math.min(found, steps.length - 6);
  return steps.slice(start, start + 6);
}
