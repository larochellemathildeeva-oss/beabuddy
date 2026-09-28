import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { useRates } from "@/hooks/useRates";
import { localCurrencies, parseAmount, quickAmounts } from "@/lib/currency";

type Pair = { from: string; to: string };

function readPair(tripId: string): Pair | null {
  try {
    const raw = window.localStorage.getItem(`bea-fx-${tripId}`);
    const pair = raw ? (JSON.parse(raw) as Partial<Pair>) : null;
    return pair?.from && pair.to ? { from: pair.from, to: pair.to } : null;
  } catch {
    return null;
  }
}

function savePair(tripId: string, pair: Pair) {
  try {
    window.localStorage.setItem(`bea-fx-${tripId}`, JSON.stringify(pair));
  } catch {
    /* private window: the pair is only a convenience */
  }
}

/**
 * "What's that in my money?", one tap from the trip page while following the
 * day. It opens on the trip's own currency against the traveller's, keeps the
 * last pair per trip, and works from the day's saved rates when the signal
 * drops.
 */
export function CurrencySheet({
  open,
  onClose,
  tripId,
  countries,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  /** The trip's countries, the main one first. */
  countries: readonly (string | null | undefined)[];
}) {
  const rates = useRates();
  // Keyed on the names, not the array, which is new on every render.
  const countryKey = countries.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const locals = useMemo(() => localCurrencies(countries, rates.home), [countryKey, rates.home]);
  const [pair, setPair] = useState<Pair | null>(null);
  const [amount, setAmount] = useState("");

  // Settle the pair once rates are in: the last one used on this trip, else
  // the first local money that has a rate, against home.
  useEffect(() => {
    if (!open || pair || !rates.ready) return;
    const saved = readPair(tripId);
    if (saved && rates.canConvert(saved.from) && rates.canConvert(saved.to)) {
      setPair(saved);
      return;
    }
    const local = locals.find((c) => rates.canConvert(c));
    const fallback = rates.home === "USD" ? "EUR" : "USD";
    setPair({ from: local ?? fallback, to: rates.home });
  }, [open, pair, rates, locals, tripId]);

  const choose = (next: Pair) => {
    setPair(next);
    savePair(tripId, next);
  };

  const from = pair?.from ?? rates.home;
  const to = pair?.to ?? rates.home;
  const value = parseAmount(amount);
  const result = value == null ? null : rates.convertTo(value, from, to);
  const perUnitOfTo = rates.convertTo(1, to, from);
  const missing = locals.filter((c) => !rates.canConvert(c));

  const hint = rates.asOf
    ? `${rates.error ? "Offline · saved " : ""}rates of ${rates.asOf} · European Central Bank`
    : rates.error
      ? "Can't reach the exchange rates right now"
      : "Getting today's rates…";

  const select =
    "rounded-xl border border-border bg-card px-2 py-2 text-[15px] font-semibold text-foreground";

  return (
    <Sheet open={open} onClose={onClose} title="Currency" hint={hint} width="sm">
      {locals.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="This trip's money">
          {locals
            .filter((c) => rates.canConvert(c))
            .map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => choose({ from: c, to: rates.home })}
                className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${
                  from === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
        </div>
      )}

      <div className="rounded-2xl bg-elevated p-3">
        <label className="flex items-center gap-2">
          <span className="sr-only">Amount</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="Amount"
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[22px] font-semibold tabular-nums"
          />
          <select
            aria-label="From currency"
            value={from}
            onChange={(e) => choose({ from: e.target.value, to })}
            className={select}
          >
            {rates.currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="my-1.5 flex justify-center">
          <button
            type="button"
            onClick={() => choose({ from: to, to: from })}
            aria-label="Swap currencies"
            title="Swap"
            className="grid size-9 place-items-center rounded-full border border-border bg-card text-primary"
          >
            <ArrowUpDown className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <p
            className="min-w-0 flex-1 truncate px-1 font-display text-[26px] leading-tight tabular-nums"
            aria-live="polite"
          >
            {result == null ? "—" : rates.format(result, to)}
          </p>
          <select
            aria-label="To currency"
            value={to}
            onChange={(e) => choose({ from, to: e.target.value })}
            className={select}
          >
            {rates.currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rates.ready && from !== to && (
        <div className="mt-3">
          <p className="label-caps mb-1 text-muted-foreground">At a glance</p>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card text-[14.5px]">
            {quickAmounts(perUnitOfTo).map((n) => {
              const out = rates.convertTo(n, from, to);
              return (
                <li key={n}>
                  <button
                    type="button"
                    onClick={() => setAmount(String(n))}
                    className="flex w-full items-center justify-between px-3 py-2 tabular-nums"
                  >
                    <span>{rates.format(n, from)}</span>
                    <span className="font-semibold">
                      {out == null ? "—" : rates.format(out, to)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {missing.length > 0 && (
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          No daily rate for {missing.join(", ")}: the European Central Bank publishes about thirty
          currencies, and {missing.length > 1 ? "these aren't" : "this one isn't"} among them.
        </p>
      )}
    </Sheet>
  );
}
