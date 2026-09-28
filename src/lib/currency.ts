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

/** ISO 3166 country → ISO 4217 currency: every inhabited country and territory. */
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
  CW: "XCG",
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
  AF: "AFN",
  AG: "XCD",
  AI: "XCD",
  AO: "AOA",
  AS: "USD",
  AX: "EUR",
  BF: "XOF",
  BI: "BIF",
  BJ: "XOF",
  BM: "BMD",
  BN: "BND",
  BT: "BTN",
  BV: "NOK",
  BY: "BYN",
  CC: "AUD",
  CD: "CDF",
  CF: "XAF",
  CG: "XAF",
  CK: "NZD",
  CX: "AUD",
  DJ: "DJF",
  DM: "XCD",
  EH: "MAD",
  ER: "ERN",
  FK: "FKP",
  GA: "XAF",
  GD: "XCD",
  GM: "GMD",
  GN: "GNF",
  GQ: "XAF",
  GS: "GBP",
  GU: "USD",
  GW: "XOF",
  GY: "GYD",
  HM: "AUD",
  HT: "HTG",
  IO: "USD",
  IQ: "IQD",
  IR: "IRR",
  KG: "KGS",
  KI: "AUD",
  KM: "KMF",
  KN: "XCD",
  KP: "KPW",
  KY: "KYD",
  LC: "XCD",
  LR: "LRD",
  LS: "LSL",
  LY: "LYD",
  ML: "XOF",
  MM: "MMK",
  MP: "USD",
  MR: "MRU",
  MS: "XCD",
  MW: "MWK",
  MZ: "MZN",
  NE: "XOF",
  NF: "AUD",
  NR: "AUD",
  NU: "NZD",
  PG: "PGK",
  PN: "NZD",
  PS: "ILS",
  SB: "SBD",
  SD: "SDG",
  SH: "SHP",
  SJ: "NOK",
  SL: "SLE",
  SO: "SOS",
  SR: "SRD",
  SS: "SSP",
  ST: "STN",
  SX: "XCG",
  SY: "SYP",
  SZ: "SZL",
  TD: "XAF",
  TF: "EUR",
  TG: "XOF",
  TJ: "TJS",
  TK: "NZD",
  TM: "TMT",
  TO: "TOP",
  TV: "AUD",
  UM: "USD",
  VC: "XCD",
  VE: "VES",
  VI: "USD",
  VU: "VUV",
  WF: "XPF",
  WS: "WST",
  YE: "YER",
  ZW: "ZWG",
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

/** How many digits a currency writes after its decimal mark: 2, 0 for yen, 3 for dinars. */
export function minorDigits(currency: string | null | undefined): number {
  if (!currency) return 2;
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * An amount as typed: "12.50", "12,50", "1 234,5", "1,234.50", "€20",
 * "12.345" in dinars. The last "." or "," is the decimal mark when the other
 * separator also appears, when it follows a lone 0, or when no more digits
 * follow it than the currency writes (two unless it is given); otherwise it
 * groups thousands, as every other separator does. Null for anything not a number.
 */
export function parseAmount(input: string, currency?: string): number | null {
  const raw = input.replace(/[\s']/g, "").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(raw)) return null;
  const mark = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  let text = raw;
  if (mark >= 0) {
    const tail = raw.slice(mark + 1);
    const head = raw.slice(0, mark);
    const bothMarks = head.includes(raw[mark] === "." ? "," : ".");
    const decimal =
      tail.length > 0 &&
      (bothMarks || /^0?$/.test(head) || tail.length <= Math.max(2, minorDigits(currency)));
    const whole = head.replace(/[.,]/g, "");
    text = decimal ? `${whole}.${tail}` : whole + tail;
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
