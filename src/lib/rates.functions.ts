import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RateTable = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

export const HOME_CURRENCIES = [
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

export type HomeCurrency = (typeof HOME_CURRENCIES)[number];

const ALLOWED_BASE = new Set<string>(HOME_CURRENCIES);

function parseBase(data: { base?: string } | undefined): { base: HomeCurrency } {
  const base = (data?.base ?? "CAD").toUpperCase();
  if (!ALLOWED_BASE.has(base)) throw new Error("Unsupported currency");
  return { base: base as HomeCurrency };
}

/** Live exchange rates from the European Central Bank feed (frankfurter.dev). */
export const getRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { base?: string }) => parseBase(data))
  .handler(async ({ data }): Promise<RateTable> => {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(data.base)}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) throw new Error("Could not reach the exchange rate service");
    const json = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
    return {
      base: json.base ?? data.base,
      date: json.date ?? new Date().toISOString().slice(0, 10),
      rates: { ...(json.rates ?? {}), [json.base ?? data.base]: 1 },
    };
  });
