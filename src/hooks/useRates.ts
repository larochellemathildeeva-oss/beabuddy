import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRates, type RateTable } from "@/lib/rates.functions";

const HOME_KEY = "bea-home-currency";

export const homeCurrencies = [
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CHF",
  "JPY",
  "MXN",
  "SEK",
  "NOK",
  "NZD",
  "SGD",
] as const;

function guessHome() {
  if (typeof window === "undefined") return "CAD";
  const saved = window.localStorage.getItem(HOME_KEY);
  if (saved) return saved;
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
  const [table, setTable] = useState<RateTable | null>(null);
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
          setTable(parsed);
          if (parsed.fetchedOn === today) return;
        }
      } catch {
        /* ignore */
      }
      try {
        const fresh = await fetchRates({ data: { base } });
        setTable(fresh);
        setError(false);
        window.localStorage.setItem(cacheKey, JSON.stringify({ ...fresh, fetchedOn: today }));
      } catch {
        setError(true);
      }
    },
    [fetchRates],
  );

  useEffect(() => {
    void load(home);
  }, [home, load]);

  const setHomeCurrency = useCallback((next: string) => {
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
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${amount.toFixed(2)} ${currency}`;
      }
    },
    [home],
  );

  const canConvert = useCallback(
    (currency: string) => currency.toUpperCase() === home || !!table?.rates?.[currency.toUpperCase()],
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
      ready: !!table,
      error,
      asOf: table?.date ?? null,
    }),
    [home, setHomeCurrency, convert, convertTo, format, canConvert, table, error],
  );
}
