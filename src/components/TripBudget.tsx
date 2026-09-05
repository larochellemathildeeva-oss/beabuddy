import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { expenseCategories } from "@/hooks/useExpenses";
import { useTripBudget } from "@/hooks/useTripBudget";

const currencies = ["CAD", "USD", "EUR", "GBP", "JPY", "MXN"];

export function TripBudget({ tripId }: { tripId: string }) {
  const b = useTripBudget(tripId);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(b.budget.currency);
  const [draft, setDraft] = useState({ label: "", category: "Meals", amount: "" });
  const cur = b.budget.currency;

  return (
    <div className="mb-3 rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label-caps text-foreground">Budget</p>
          <p className="text-[11px] text-muted-foreground">
            {b.totals.target > 0
              ? `${b.totals.spent.toFixed(2)} of ${b.totals.target.toFixed(2)} ${cur} spent`
              : "Set what you plan to spend"}
          </p>
        </div>
        <button
          onClick={() => {
            setAmount(b.budget.amount ? String(b.budget.amount) : "");
            setCurrency(b.budget.currency);
            setEditing(!editing);
          }}
          className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
        >
          {b.budget.amount > 0 ? "Change" : "Set a budget"}
        </button>
      </div>

      {editing && (
        <div className="mt-2 flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Total budget"
            className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-xl border border-border bg-elevated px-2 py-2 text-[13px]"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              await b.setTripBudget(Number(amount || 0), currency);
              setEditing(false);
            }}
            className="rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            Save
          </button>
        </div>
      )}

      {b.totals.target > 0 && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                b.totals.over ? "bg-destructive" : "bg-primary"
              }`}
              style={{ width: `${Math.max(2, b.totals.pct)}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px]">
            <span className="font-semibold">
              {b.totals.spent.toFixed(2)} {cur} spent
            </span>
            <span className={b.totals.over ? "text-destructive" : "text-muted-foreground"}>
              {b.totals.over
                ? `${Math.abs(b.totals.remaining).toFixed(2)} ${cur} over`
                : `${b.totals.remaining.toFixed(2)} ${cur} left`}
            </span>
            <span className="text-muted-foreground">
              {b.totals.receipts} receipt{b.totals.receipts === 1 ? "" : "s"} ·{" "}
              {b.totals.claimable.toFixed(2)} {cur} claimable
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {b.items.map((i) => {
          const catSpent = b.totals.byCategory.find(([c]) => c === i.category)?.[1].spent ?? 0;
          return (
            <div key={i.id} className="flex items-center justify-between gap-2 text-[13px]">
              <div className="min-w-0">
                <p className="truncate font-medium">{i.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {i.category} · {catSpent.toFixed(2)} of {i.amount.toFixed(2)} {i.currency} spent
                </p>
              </div>
              <button
                onClick={() => void b.removeItem(i.id)}
                className="shrink-0 text-[11px] text-muted-foreground underline"
              >
                Remove
              </button>
            </div>
          );
        })}
        {b.items.length === 0 && (
          <p className="text-[12px] text-muted-foreground">
            Add what you expect to spend — flights, hotel, meals — and Béa tracks it against your
            receipts.
          </p>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Planned expense"
            className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
          />
          <input
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            inputMode="decimal"
            placeholder="Amount"
            className="w-24 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
          >
            {expenseCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            disabled={!draft.label.trim()}
            onClick={async () => {
              await b.addItem({
                label: draft.label.trim(),
                category: draft.category,
                amount: Number(draft.amount || 0),
                currency: cur,
              });
              setDraft({ ...draft, label: "", amount: "" });
            }}
            className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            Add plan
          </button>
        </div>
        <Link
          to="/expenses"
          className="block text-center text-[12px] font-semibold text-primary underline"
        >
          Add a receipt to this trip
        </Link>
      </div>
    </div>
  );
}
