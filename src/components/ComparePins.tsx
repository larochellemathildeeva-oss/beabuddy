import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { comparePlaces, type ComparisonResult } from "@/lib/compare.functions";
import { pinColorClass, pinLabel, type Pin } from "@/data/atlas";

const MAX = 5;

export function ComparePins({ pins }: { pins: Pin[] }) {
  const run = useServerFn(comparePlaces);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [priorities, setPriorities] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [sideBySide, setSideBySide] = useState(false);

  const toggle = (id: string) =>
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX ? cur : [...cur, id],
    );

  const compare = async () => {
    const chosen = pins.filter((p) => picked.includes(p.id));
    if (chosen.length < 2) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setSideBySide(false);
    try {
      const out = await run({
        data: {
          places: chosen.map((p) => ({
            name: p.name,
            city: p.city || null,
            country: p.country || null,
            category: p.category ?? null,
            kind: pinLabel[p.type],
            notes: p.notes ?? null,
          })),
          priorities: priorities.trim() || null,
          month: null,
        },
      });
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (pins.length < 2) return null;

  return (
    <section data-guide="compare-pins" className="card-soft p-3.5">
      <div className="flex items-baseline justify-between">
        <p className="label-caps text-foreground">Help me choose</p>
        <button onClick={() => setOpen((v) => !v)} className="text-[11px] text-primary">
          {open ? "Hide" : "Compare places"}
        </button>
      </div>

      {!open ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Pick two to five saved places and Béa will weigh them up for you.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {pins.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                    on ? "border-primary bg-card" : "border-border/60 text-muted-foreground"
                  }`}
                >
                  <span className={`size-2 rounded-full ${pinColorClass[p.type]}`} />
                  {p.name}
                </button>
              );
            })}
          </div>

          <label className="block">
            <span className="label-caps">What matters to you</span>
            <textarea
              value={priorities}
              onChange={(e) => setPriorities(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="Warm weather, easy on the budget, good food, a long weekend…"
              className="mt-1 w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px] outline-none"
            />
          </label>

          <button
            onClick={compare}
            disabled={busy || picked.length < 2}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? "Thinking it over…"
              : picked.length < 2
                ? "Pick at least two places"
                : `Compare ${picked.length} places`}
          </button>

          {error && <p className="text-[12px] text-destructive">{error}</p>}

          {result && (
            <div className="rise space-y-2 rounded-2xl border border-border bg-elevated p-3">
              <h3 className="font-display text-[18px] leading-tight">{result.headline}</h3>
              <p className="text-[13px]">
                <span className="font-medium">Béa would pick {result.pick}.</span> {result.why}
              </p>
              <button
                onClick={() => setSideBySide(true)}
                className="w-full rounded-xl border border-primary px-4 py-2 text-[13px] font-semibold text-primary"
              >
                See them side by side
              </button>
            </div>
          )}
        </div>
      )}

      {result && sideBySide && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur"
        >
          <div className="flex items-start gap-2 border-b border-border p-4">
            <div className="min-w-0 flex-1">
              <p className="label-caps">Side by side</p>
              <h3 className="font-display text-[20px] leading-tight">{result.headline}</h3>
            </div>
            <button
              onClick={() => setSideBySide(false)}
              aria-label="Close comparison"
              className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="flex min-w-max gap-3">
              {result.places.map((p) => {
                const winner = p.name === result.pick;
                return (
                  <div
                    key={p.name}
                    className={`w-[240px] shrink-0 space-y-2 rounded-2xl border p-3 ${
                      winner ? "border-primary bg-card" : "border-border/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold">{p.name}</p>
                      {winner && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          Béa's pick
                        </span>
                      )}
                    </div>
                    {(
                      [
                        ["Best for", p.bestFor],
                        ["Good to know", p.goodToKnow],
                        ["Watch out", p.watchOut],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {label}
                        </p>
                        <p className="text-[12px]">{value}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[12px] text-muted-foreground">{result.tip}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Swipe across to see each place.</p>
          </div>
        </div>
      )}

    </section>
  );
}
