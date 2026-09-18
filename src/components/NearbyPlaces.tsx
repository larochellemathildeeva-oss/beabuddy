import { useMemo, useState } from "react";
import type { Pin } from "@/data/atlas";
import { pinColorClass, pinLabel } from "@/data/atlas";
import { DayTripFromNear } from "@/components/DayTripFromNear";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { scoreOpportunity } from "@/lib/score-opportunity";
import { beaLine } from "@/lib/bea-voice";
import { formatMetres, NEAR_RADII, pinsWithin, reachLabel } from "@/lib/near";
import { SHARE_DURATIONS, type useNearMe } from "@/hooks/useNearMe";

/**
 * The vault, sorted by how close you are.
 *
 * This was the Near tab. It is the same saved places the list above shows —
 * never a different set — so it is a view of the vault rather than a screen of
 * its own. What it adds over the plain list is distance, a reason each place
 * matters right now, and the ability to string a few of them into a day trip.
 */
export function NearbyPlaces({
  pins,
  near,
  collapsed = false,
  onExpand,
}: {
  pins: Pin[];
  near: ReturnType<typeof useNearMe>;
  /**
   * Home shows the few places worth acting on and hides the working tools. A
   * radius picker and a day-trip builder above your next trip would make Home
   * a Near screen with other things underneath it.
   */
  collapsed?: boolean;
  onExpand?: (() => void) | undefined;
}) {
  const scorePrefs = useScorePrefs();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [duration, setDuration] = useState<(typeof SHARE_DURATIONS)[number]["id"]>("once");

  const { here, state, error, radius, setRadius, consent, consentReady } = near;
  const HOME_LIMIT = 3;

  // Distance decides membership; how much the place matters right now decides
  // the order within it.
  const nearby = useMemo(() => {
    const within = pinsWithin(here, pins, radius, dismissed);
    if (!here) return within;
    return [...within].sort(
      (a, b) =>
        scoreOpportunity(b.pin, scorePrefs, { here }).score -
        scoreOpportunity(a.pin, scorePrefs, { here }).score,
    );
  }, [here, pins, radius, dismissed, scorePrefs]);

  const shown = collapsed ? nearby.slice(0, HOME_LIMIT) : nearby;
  const hiddenCount = nearby.length - shown.length;

  const selected = useMemo(
    () => nearby.filter((row) => selectedIds.includes(row.pin.id)).map((row) => row.pin),
    [nearby, selectedIds],
  );

  const togglePick = (id: string) =>
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 12 ? cur : [...cur, id],
    );

  /**
   * The location card earns its space only while it has something to ask or
   * report. Once you have said yes and Béa knows where you are, it is a panel
   * printing your own coordinates back at you above the places you came to
   * see — so on Home it gets out of the way, and Refresh, Stop sharing and the
   * radius come back with Show all.
   *
   * It stays for an error, because that is the one case with something to do.
   */
  const settled = consent && state === "ok" && !!here;
  const showLocationCard = !collapsed || !settled;

  return (
    <div className="space-y-4">
      <div
        data-guide="location-card"
        className="card-soft p-4"
        {...(showLocationCard ? {} : { hidden: true })}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps">Your location</p>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              {state === "locating" && "Finding you…"}
              {state === "ok" && here && `${here.lat.toFixed(3)}, ${here.lon.toFixed(3)}`}
              {state === "error" && (error || "Location off")}
              {state === "idle" && "Not shared yet"}
            </p>
            {state === "error" && typeof window !== "undefined" && window.self !== window.top && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[13px] font-semibold underline underline-offset-2"
              >
                Open Béa in its own tab
              </a>
            )}
          </div>
          {consentReady && consent && (
            <button
              onClick={near.locate}
              className="shrink-0 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
            >
              {state === "ok" ? "Refresh" : "Use my location"}
            </button>
          )}
        </div>

        {consentReady && !consent && (
          <div className="mt-3 rounded-xl border border-border bg-elevated p-3">
            <p className="text-[14.5px] font-semibold">Before Béa asks for your location</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Your position is used only on this device, right now, to measure how far you are from
              places you've saved. It is never sent to Béa's servers, never stored as a history of
              where you've been, and never shared with anyone. You can stop sharing at any time —
              see the privacy policy for the full picture.
            </p>
            <p className="label-caps mt-3">Share my location for…</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SHARE_DURATIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDuration(d.id)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    duration === d.id ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <span className="block text-[13px] font-semibold">{d.label}</span>
                  <span className="block text-[12px] text-muted-foreground">{d.blurb}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => near.allow(duration)}
              className="mt-3 w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground"
            >
              I understand — use my location
            </button>
          </div>
        )}

        {consentReady && consent && (
          <button
            onClick={near.stop}
            className="mt-3 text-[12px] font-semibold text-muted-foreground underline underline-offset-2"
          >
            Stop sharing my location
          </button>
        )}

        {/* "Alert frequency" used to sit here offering Always / Once a day /
            Weekly. Béa sends no alerts, so it promised something that does not
            exist; the radius is the one control that changes what you see. */}
        <div data-guide="near-radius" {...(collapsed ? { hidden: true } : {})}>
          <p className="label-caps mt-4">How far to look</p>
          <div className="mt-2 flex gap-2">
            {NEAR_RADII.map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`flex-1 rounded-xl border px-2 py-2 text-[13px] transition-colors ${
                  radius === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border"
                }`}
              >
                {formatMetres(r)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section data-guide="near-list" className="space-y-3">
        {!collapsed && here && nearby.length >= 2 && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14.5px] text-muted-foreground">
              {picking
                ? `${selectedIds.length} selected for a day trip`
                : "Tick a few and Béa will arrange a day trip."}
            </p>
            <button
              type="button"
              onClick={() => {
                setPicking((on) => !on);
                if (picking) setSelectedIds([]);
              }}
              className="shrink-0 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
            >
              {picking ? "Cancel" : "Plan a day trip"}
            </button>
          </div>
        )}

        {selected.length >= 2 && (
          <DayTripFromNear
            selected={selected}
            here={here}
            onClear={() => {
              setSelectedIds([]);
              setPicking(false);
            }}
          />
        )}

        {here && nearby.length > 0 && (
          <p className="text-[14.5px] text-muted-foreground">
            <span className="font-semibold text-primary">{beaLine("near.nearby").title}</span>
            {beaLine("near.nearby").body ? ` — ${beaLine("near.nearby").body}` : ""}
          </p>
        )}

        {shown.map(({ pin: p, metres }) => (
          <article key={p.id} className="rise card-soft p-4">
            {metres < 800 && (
              <p className="mb-2 text-[13px] text-muted-foreground">
                You're {formatMetres(metres)} from something Past You cared about.
              </p>
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {picking && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => togglePick(p.id)}
                      aria-label={`Add ${p.name} to a day trip`}
                      className="size-4"
                    />
                  )}
                  <span className={`size-2 rounded-full ${pinColorClass[p.type]}`} />
                  <span className="label-caps">{pinLabel[p.type]}</span>
                </div>
                <h2 className="mt-1 text-[21px] leading-tight">{p.name}</h2>
                <p className="text-[13px] text-muted-foreground">
                  {scoreOpportunity(p, scorePrefs, here ? { here } : {}).reasons[0] ??
                    reachLabel(metres)}
                  {p.dateAdded ? ` · added ${p.dateAdded.slice(0, 4)}` : ""}
                  {p.category ? ` · ${p.category}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[12px] font-semibold">
                {formatMetres(metres)}
              </span>
            </div>
            {p.notes && <p className="mt-3 font-display text-[15.5px] leading-snug">“{p.notes}”</p>}
            <div className="mt-3 flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-[14.5px] font-semibold text-primary-foreground"
              >
                Go now
              </a>
              <button
                onClick={() => setDismissed((s) => [...s, p.id])}
                className="rounded-xl border border-border px-4 py-2.5 text-[14.5px]"
              >
                Snooze
              </button>
            </div>
          </article>
        ))}

        {collapsed && here && nearby.length > 0 && onExpand && (
          <button
            onClick={onExpand}
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-[14px] font-semibold"
          >
            {hiddenCount > 0
              ? `Show all ${nearby.length} nearby`
              : "Change the distance, or plan a day trip"}
          </button>
        )}

        {!here && state !== "locating" && (
          <p className="py-10 text-center text-[14.5px] text-muted-foreground">
            Share your location and Béa will surface what's saved around you.
          </p>
        )}
        {here && nearby.length === 0 && (
          <div className="py-10 text-center">
            <p className="font-display text-[18px] leading-snug">{beaLine("near.empty").title}</p>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              {beaLine("near.empty").body} Nothing saved within {formatMetres(radius)}.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
