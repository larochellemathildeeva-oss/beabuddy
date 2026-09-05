import { createServerFn } from "@tanstack/react-start";

export type RateTable = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

/** Live exchange rates from the European Central Bank feed (frankfurter.dev). */
export const getRates = createServerFn({ method: "GET" })
  .inputValidator((data: { base?: string }) => ({
    base: (data?.base ?? "CAD").toUpperCase().slice(0, 3),
  }))
  .handler(async ({ data }): Promise<RateTable> => {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(data.base)}`,
    );
    if (!res.ok) throw new Error("Could not reach the exchange rate service");
    const json = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
    return {
      base: json.base ?? data.base,
      date: json.date ?? new Date().toISOString().slice(0, 10),
      rates: { ...(json.rates ?? {}), [json.base ?? data.base]: 1 },
    };
  });
