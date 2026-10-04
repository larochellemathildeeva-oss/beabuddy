export const HOME_CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD", "CHF", "JPY", "MXN", "SEK", "NOK", "NZD", "SGD"] as const;
// A fixed rate table, so the Expenses sample can convert.
export const getRates = async ({ data }: { data?: { base?: string } } = {}) => {
  const base = (data?.base ?? "CAD").toUpperCase();
  return { base, date: "2026-10-01", rates: { CAD: 1, USD: 0.72, EUR: 0.66, GBP: 0.56, JPY: 108, [base]: 1 } };
};
