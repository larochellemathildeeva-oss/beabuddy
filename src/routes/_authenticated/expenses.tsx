import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { expenseCategories, toCsv, useExpenses } from "@/hooks/useExpenses";
import { homeCurrencies, useRates } from "@/hooks/useRates";
import { useTrips } from "@/hooks/useTrips";
import { downscaleImage } from "@/lib/image";
import { extractReceiptFields } from "@/lib/receipt.functions";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Receipts & expenses — Béa" },
      {
        name: "description",
        content:
          "Snap a photo of a receipt and keep a tidy business expense record for every trip, ready to export.",
      },
      { property: "og:title", content: "Receipts & expenses — Béa" },
      {
        property: "og:description",
        content: "Photograph receipts on the road and export a clean expense report from Béa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExpensesPage,
});

const currencies = ["CAD", "USD", "EUR", "GBP", "AUD", "CHF", "JPY", "MXN", "SEK", "NOK"];

function ExpensesPage() {
  const { rows, urls, loading, addExpense, removeExpense } = useExpenses();
  const rates = useRates();
  const t = useTrips();
  const camera = useRef<HTMLInputElement>(null);

  const library = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [category, setCategory] = useState<string>("Meals");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [billable, setBillable] = useState(true);
  const [tripId, setTripId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const smallImage = useRef<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("bea-expense-disclaimer"),
  );

  const acceptDisclaimer = () => {
    localStorage.setItem("bea-expense-disclaimer", "2026-09-05");
    setShowDisclaimer(false);
  };


  const pick = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    smallImage.current = null;
    setScanNote(null);
    if (!f) return;
    // Autofill the form by reading the receipt photo.
    void (async () => {
      setScanning(true);
      try {
        const small = await downscaleImage(f);
        smallImage.current = small;
        const found = await extractReceiptFields({ data: { imageDataUrl: small } });
        if (found.merchant) setMerchant(found.merchant);
        if (found.amount !== null && found.amount > 0) setAmount(String(found.amount));
        if (found.currency && currencies.includes(found.currency.toUpperCase()))
          setCurrency(found.currency.toUpperCase());
        if (found.spentOn && /^\d{4}-\d{2}-\d{2}$/.test(found.spentOn)) setSpentOn(found.spentOn);
        if (found.category && (expenseCategories as readonly string[]).includes(found.category))
          setCategory(found.category);
        if (found.summary) setNotes(found.summary);
        setScanNote(
          found.merchant || found.amount
            ? "Filled in from your photo — give it a quick check."
            : "Couldn't read much from that photo — fill it in by hand.",
        );
      } catch {
        setScanNote("Couldn't read that photo — fill it in by hand.");
      } finally {
        setScanning(false);
      }
    })();
  };

  const reset = () => {
    pick(null);
    setMerchant("");
    setAmount("");
    setNotes("");
    setBillable(true);
    setTripId("");
    setSpentOn(new Date().toISOString().slice(0, 10));
    if (camera.current) camera.current.value = "";
    if (library.current) library.current.value = "";
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await addExpense({
        file,
        merchant: merchant.trim() || null,
        amount: Number(amount || 0),
        currency,
        category,
        spent_on: spentOn,
        billable,
        trip_id: tripId || null,
        notes: notes.trim() || null,
      });

      setStatus("Saved to your expense record.");
      reset();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save that one. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>();
    let billableHome = 0;
    let allHome = 0;
    let missing = 0;
    for (const r of rows) {
      byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.amount);
      const converted = rates.convert(r.amount, r.currency);
      if (converted === null) {
        missing += 1;
        continue;
      }
      allHome += converted;
      if (r.billable) billableHome += converted;
    }
    return {
      byCurrency: Array.from(byCurrency.entries()),
      allHome,
      billableHome,
      missing,
      count: rows.length,
    };
  }, [rows, rates]);


  const exportCsv = () => {
    const blob = new Blob([toCsv(rows, { home: rates.home, convert: rates.convert })], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bea-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell eyebrow="Business expenses" title="Receipts, kept tidy">
      {showDisclaimer && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={acceptDisclaimer}
        >
          <div
            role="dialog"
            aria-label="Expense tracking disclaimer"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl bg-card p-5 sm:rounded-2xl"
          >
            <p className="font-display text-[21px] leading-snug">Before you start</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Béa is here to help you stay organised — nothing more. This is not tax advice and the
              export is not an official document. Béa is not responsible for any tax issue, missing
              receipt or filing problem. Always check the figures with your accountant or tax
              authority before you submit anything.
            </p>
            <button
              onClick={acceptDisclaimer}
              className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground"
            >
              I understand
            </button>
          </div>
        </div>
      )}
      <div className="space-y-5">
        <p className="text-[13px] text-muted-foreground">
          Photograph a receipt the moment you pay. Béa keeps the picture privately in your account
          and builds a spending record you can send to accounting.
        </p>

        <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          Organising help only — not tax advice, and not an official document. Béa isn’t responsible
          for any tax issue; check the numbers with your accountant.
        </p>


        <div data-guide="new-receipt" className="card-soft space-y-3 p-4">
          <p className="label-caps text-foreground">New receipt</p>

          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <input
            ref={library}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />

          {preview ? (
            <div className="space-y-2">
              <img
                src={preview}
                alt="Receipt preview"
                className="max-h-52 w-full rounded-xl object-contain"
              />
              {scanning && (
                <p className="text-[12px] text-muted-foreground">
                  Reading your receipt to fill in the details…
                </p>
              )}
              {!scanning && scanNote && (
                <p className="text-[12px] text-muted-foreground">{scanNote}</p>
              )}
              <button
                onClick={() => pick(null)}
                className="text-[12px] font-medium text-muted-foreground underline"
              >
                Remove this picture
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => camera.current?.click()}
                className="rounded-xl bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground"
              >
                Take a photo
              </button>
              <button
                onClick={() => library.current?.click()}
                className="rounded-xl border border-border px-4 py-3 text-[14px] font-semibold"
              >
                Choose a picture
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Where you paid"
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-[14px]"
            />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Amount"
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-[14px]"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-[14px]"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-[14px]"
            >
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-[14px]"
            />
            <select
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-[14px]"
            >
              <option value="">No trip</option>
              {t.trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was it for?"
            rows={2}
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[14px]"
          />

          <label className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Claim this back as a business expense
          </label>

          <button
            onClick={() => void save()}
            disabled={busy || (!file && !amount)}
            className="w-full rounded-xl bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save receipt"}
          </button>
          {status && <p className="text-[12px] text-muted-foreground">{status}</p>}
        </div>

        {rows.length > 0 && (
          <div className="card-soft space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="label-caps text-foreground">Your totals</p>
              <select
                value={rates.home}
                onChange={(e) => rates.setHomeCurrency(e.target.value)}
                aria-label="Your home currency"
                className="rounded-lg border border-border bg-card px-2 py-1 text-[12px]"
              >
                {homeCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[22px] font-semibold">{rates.format(totals.allHome)}</p>
              <p className="text-[12px] text-muted-foreground">
                Everything together in {rates.home}
                {rates.asOf ? ` · rates from ${rates.asOf}` : ""}
              </p>
            </div>

            <p className="text-[13px]">
              <span className="font-semibold">{rates.format(totals.billableHome)}</span>{" "}
              <span className="text-muted-foreground">marked claimable</span>
            </p>

            <div className="space-y-0.5 border-t border-border pt-2">
              {totals.byCurrency.map(([cur, sum]) => (
                <p key={cur} className="text-[12px] text-muted-foreground">
                  {sum.toFixed(2)} {cur}
                  {cur !== rates.home && rates.convert(sum, cur) !== null
                    ? ` · ${rates.format(rates.convert(sum, cur) as number)}`
                    : ""}
                </p>
              ))}
            </div>

            <p className="text-[12px] text-muted-foreground">
              {totals.count} receipt{totals.count > 1 ? "s" : ""}
              {totals.missing > 0
                ? ` · ${totals.missing} left out, no rate for that currency yet`
                : ""}
              {rates.error && !rates.ready ? " · today's rates could not be fetched" : ""}
            </p>

            <button
              data-guide="expense-export"
              onClick={exportCsv}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold"
            >
              Download a spreadsheet
            </button>
          </div>
        )}


        <div className="space-y-3">
          {loading && <p className="text-[13px] text-muted-foreground">Loading…</p>}
          {!loading && rows.length === 0 && (
            <div className="card-soft p-5 text-center">
              <p className="text-[14px] font-semibold">No receipts yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Take a photo of your next one and it will land here.
              </p>
            </div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="card-soft flex gap-3 p-3">
              {urls[r.id] ? (
                <img
                  src={urls[r.id]}
                  alt={`Receipt from ${r.merchant ?? "a shop"}`}
                  className="size-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border text-[10px] text-muted-foreground">
                  No photo
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{r.merchant || r.category}</p>
                <p className="text-[12px] text-muted-foreground">
                  {r.spent_on} · {r.category}
                  {r.billable ? " · claimable" : ""}
                </p>
                {r.notes && <p className="mt-1 text-[12px] text-muted-foreground">{r.notes}</p>}
              </div>
              <div className="flex flex-col items-end justify-between">
                <div className="text-right">
                  <p className="text-[14px] font-semibold">
                    {r.amount.toFixed(2)} {r.currency}
                  </p>
                  {r.currency !== rates.home && rates.convert(r.amount, r.currency) !== null && (
                    <p className="text-[11px] text-muted-foreground">
                      ≈ {rates.format(rates.convert(r.amount, r.currency) as number)}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => void removeExpense(r)}
                  className="text-[11px] text-muted-foreground underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <Link to="/profile" className="block text-center text-[13px] text-muted-foreground underline">
          Back to your profile
        </Link>
      </div>
    </AppShell>
  );
}
