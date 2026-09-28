import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRates, HOME_CURRENCIES, type RateTable } from "@/lib/rates.functions";

const HOME_KEY = "bea-home-currency";

export const homeCurrencies = HOME_CURRENCIES;
const ALLOWED_HOME = new Set<string>(HOME_CURRENCIES);

function guessHome() {
  if (typeof window === "undefined") return "CAD";
  const saved = window.localStorage.getItem(HOME_KEY);
  if (saved && ALLOWED_HOME.has(saved)) return saved;
  try {
    const region = new Intl.Locale(navigator.language).region;
    const map: Record<string, string> = {
      CA: "CAD",
      US: "USD",
      GB: "GBP",
      AU: "AUD",
      NZ: "NZD",
      CH: "CHF",
      JP: "JPY",
      MX: "MXN",
      SE: "SEK",
      NO: "NOK",
      SG: "SGD",
    };
    if (region && map[region]) return map[region];
    if (region) return "EUR";
  } catch {
    /* ignore */
  }
  return "CAD";
}

/**
 * Converts any receipt amount into one home currency using live rates.
 * Rates are cached for the day so the screens stay fast offline.
 */
export function useRates() {
  const fetchRates = useServerFn(getRates);
  const [home, setHome] = useState("CAD");
  // Kept per base, so a late answer for another home currency can never be
  // read as this one's rates.
  const [tables, setTables] = useState<Record<string, RateTable>>({});
  const table = tables[home]?.base === home ? tables[home] : null;
  const keep = useCallback((base: string, next: RateTable) => {
    if (next.base !== base) return;
    setTables((all) => ({ ...all, [base]: next }));
  }, []);
  const [error, setError] = useState(false);

  useEffect(() => {
    setHome(guessHome());
  }, []);

  const load = useCallback(
    async (base: string) => {
      const cacheKey = `bea-rates-${base}`;
      const today = new Date().toISOString().slice(0, 10);
      try {
        const cached = window.localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as RateTable & { fetchedOn?: string };
          keep(base, parsed);
          if (parsed.fetchedOn === today) return;
        }
      } catch {
        /* ignore */
      }
      try {
        const fresh = await fetchRates({ data: { base } });
        keep(base, fresh);
        setError(false);
        window.localStorage.setItem(cacheKey, JSON.stringify({ ...fresh, fetchedOn: today }));
      } catch {
        setError(true);
      }
    },
    [fetchRates, keep],
  );

  useEffect(() => {
    void load(home);
  }, [home, load]);

  const setHomeCurrency = useCallback((next: string) => {
    if (!ALLOWED_HOME.has(next)) return;
    window.localStorage.setItem(HOME_KEY, next);
    setHome(next);
  }, []);

  const convert = useCallback(
    (amount: number, currency: string) => {
      const cur = (currency || home).toUpperCase();
      if (cur === home) return amount;
      const rate = table?.rates?.[cur];
      if (!rate) return null;
      return amount / rate;
    },
    [home, table],
  );

  const convertTo = useCallback(
    (amount: number, from: string, to: string) => {
      const a = (from || home).toUpperCase();
      const b = (to || home).toUpperCase();
      if (a === b) return amount;
      const rateA = a === home ? 1 : table?.rates?.[a];
      const rateB = b === home ? 1 : table?.rates?.[b];
      if (!rateA || !rateB) return null;
      return (amount / rateA) * rateB;
    },
    [home, table],
  );

  const format = useCallback(
    (amount: number, currency = home) => {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
        }).format(amount);
      } catch {
        return `${amount.toFixed(2)} ${currency}`;
      }
    },
    [home],
  );

  const canConvert = useCallback(
    (currency: string) =>
      currency.toUpperCase() === home || !!table?.rates?.[currency.toUpperCase()],
    [home, table],
  );

  /** Every currency today's table can convert, home included. */
  const currencies = useMemo(
    () => Array.from(new Set([home, ...Object.keys(table?.rates ?? {})])).sort(),
    [home, table],
  );

  return useMemo(
    () => ({
      home,
      setHomeCurrency,
      convert,
      convertTo,
      format,
      canConvert,
      currencies,
      ready: !!table,
      error,
      asOf: table?.date ?? null,
    }),
    [home, setHomeCurrency, convert, convertTo, format, canConvert, currencies, table, error],
  );
}
