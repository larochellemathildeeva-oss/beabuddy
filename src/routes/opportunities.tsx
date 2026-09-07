import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DayTripFromNear } from "@/components/DayTripFromNear";
import { formatDistance, pinColorClass, pinLabel, type Pin } from "@/data/atlas";
import { haversine } from "@/lib/geo";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { scoreOpportunity } from "@/lib/score-opportunity";
import { usePhotoMemories } from "@/hooks/usePhotoMemories";
import { useRecommendations } from "@/hooks/useRecommendations";
import { DEMO_PLACES } from "@/lib/demo-seed";
import { beaLine } from "@/lib/bea-voice";

export const Route = createFileRoute("/opportunities")({
  head: () => ({
    meta: [
      { title: "Opportunities near me — Béa" },
      {
        name: "description",
        content:
          "Béa watches where you are and surfaces the saved recommendations, wishlist places and next-time pins that are close by right now.",
      },
      { property: "og:title", content: "Opportunities near me — Béa" },
      {
        property: "og:description",
        content: "Saved once, remembered forever — surfaced the moment you're nearby.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OpportunitiesPage,
});

const radii = [500, 1000, 5000, 25000];

function distanceM(aLat: number, aLon: number, bLat: number, bLon: number) {
  return haversine({ lat: aLat, lon: aLon }, { lat: bLat, lon: bLon });
}

function reason(pin: Pin) {
  if (pin.recommendedBy) return `Saved by ${pin.recommendedBy}`;
  if (pin.type === "reco") return "In your recommendation vault";
  if (pin.type === "nexttime") return "You said next time";
  if (pin.type === "wishlist") return "Never visited";
  if (pin.priority === "High") return "High priority";
  if (pin.dateVisited) return `Loved it in ${pin.dateVisited.slice(0, 4)}`;
  return "On your list";
}

const CONSENT_KEY = "bea-location-consent";
const shareDurations = [
  { id: "once", label: "Just this once", blurb: "Nothing is remembered" },
  { id: "hour", label: "For 1 hour", blurb: "Then you'll be asked again" },
  { id: "day", label: "For today", blurb: "Until midnight on this device" },
  { id: "always", label: "Until I turn it off", blurb: "You stay in control" },
] as const;
type ShareDuration = (typeof shareDurations)[number]["id"];

function readConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { expiry: number | null };
    return parsed.expiry === null || parsed.expiry > Date.now();
  } catch {
    return false;
  }
}

function writeConsent(duration: ShareDuration) {
  let expiry: number | null = null;
  if (duration === "hour") expiry = Date.now() + 3_600_000;
  if (duration === "day") {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    expiry = end.getTime();
  }
  if (duration === "once") return; // nothing stored
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ expiry }));
  } catch {
    /* storage unavailable: consent lasts for this session only */
  }
}

function OpportunitiesPage() {
  const [radius, setRadius] = useState(5000);
  const [frequency, setFrequency] = useState("Once a day");
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null);
  const [locState, setLocState] = useState<"idle" | "locating" | "ok" | "error">("idle");
  const [locError, setLocError] = useState("");
  const [snoozed, setSnoozed] = useState<string[]>([]);
  const [consent, setConsent] = useState(false); // resolved after mount
  const [consentReady, setConsentReady] = useState(false);
  const [duration, setDuration] = useState<ShareDuration>("once");
  const [picking, setPicking] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualLabel, setManualLabel] = useState<string | null>(null);
  const vault = useRecommendations();
  const photo = usePhotoMemories();
  const scorePrefs = useScorePrefs();

  const setManualHere = (place: (typeof DEMO_PLACES)[number]) => {
    setHere({ lat: place.lat, lon: place.lon });
    setManualLabel(place.label);
    setLocState("ok");
    setLocError("");
    setConsent(true);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setLocState("error");
      setLocError("This device can't share its location — pick a city below instead.");
      return;
    }
    setLocState("locating");
    setManualLabel(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocState("ok");
      },
      (err) => {
        setLocState("error");
        const framed = typeof window !== "undefined" && window.self !== window.top;
        if (err.code === 1 && framed) {
          setLocError(
            "This little preview window isn't allowed to use location. Open Béa in its own tab, or pick a city below.",
          );
        } else if (err.code === 1) {
          setLocError(
            "Your browser is blocking location. Allow it in the address bar, or pick a city below for the demo.",
          );
        } else {
          setLocError(err.message || "Location unavailable — pick a city below.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  useEffect(() => {
    const ok = readConsent();
    setConsent(ok);
    setConsentReady(true);
    if (ok) locate();
  }, []);

  const allowLocation = (d: ShareDuration) => {
    writeConsent(d);
    setConsent(true);
    locate();
  };

  const stopSharing = () => {
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch {
      /* storage unavailable: nothing was stored to remove */
    }
    setConsent(false);
    setHere(null);
    setManualLabel(null);
    setLocState("idle");
  };

  const candidates = useMemo(() => {
    return [...vault.pins, ...photo.pins.filter((p) => p.type !== "visited")];
  }, [vault.pins, photo.pins]);

  const nearby = useMemo(() => {
    if (!here) return [];
    return candidates
      .map((p) => ({ pin: p, d: distanceM(here.lat, here.lon, p.lat, p.lon) }))
      .filter((x) => x.d <= radius && !snoozed.includes(x.pin.id))
      .sort((a, b) => {
        const sa = scoreOpportunity(a.pin, scorePrefs, { here }).score;
        const sb = scoreOpportunity(b.pin, scorePrefs, { here }).score;
        return sb - sa;
      });
  }, [here, candidates, radius, snoozed, scorePrefs]);

  const timeline = useMemo(() => {
    const bucket = (d: number | null) => {
      if (d == null) return "Someday";
      if (d <= 400) return "Right here";
      if (d <= 2000) return "A short walk";
      if (d <= 15000) return "Across town";
      if (d <= 150000) return "Day trip";
      return "Next journey";
    };
    return candidates
      .map((p) => {
        const d = here ? distanceM(here.lat, here.lon, p.lat, p.lon) : null;
        return { pin: p, d, when: bucket(d) };
      })
      .sort((a, b) => {
        if (a.d == null || b.d == null) return 0;
        return a.d - b.d;
      })
      .slice(0, 30);
  }, [candidates, here]);

  const selectedPins = useMemo(
    () => nearby.filter((row) => selectedIds.includes(row.pin.id)).map((row) => row.pin),
    [nearby, selectedIds],
  );

  const togglePick = (id: string) => {
    setSelectedIds((cur) => {
      if (cur.includes(id)) return cur.filter((item) => item !== id);
      if (cur.length >= 12) return cur;
      return [...cur, id];
    });
  };

  return (
    <AppShell eyebrow="Opportunities near me" title="Béa remembers, so you don't.">
      <div className="space-y-5">
        <div data-guide="location-card" className="card-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-caps">Your location</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {locState === "locating" && "Finding you…"}
                {locState === "ok" &&
                  here &&
                  (manualLabel
                    ? `Pretending you're in ${manualLabel}`
                    : `${here.lat.toFixed(3)}, ${here.lon.toFixed(3)}`)}
                {locState === "error" && (locError || "Location off")}
                {locState === "idle" && "Not shared yet"}
              </p>
              {locState === "error" && typeof window !== "undefined" && window.self !== window.top && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[12px] font-semibold underline underline-offset-2"
                >
                  Open Béa in its own tab
                </a>
              )}
            </div>
            {consentReady && consent && (
              <button
                onClick={locate}
                className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
              >
                {locState === "ok" ? "Refresh" : "Use my location"}
              </button>
            )}
          </div>

          {consentReady && !consent && (
            <div className="mt-3 rounded-xl border border-border bg-elevated p-3">
              <p className="text-[13px] font-semibold">Before Béa asks for your location</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Your position is used only on this device, right now, to measure how far you are
                from places you've saved. It is never sent to Béa's servers, never stored as a
                history of where you've been, and never shared with anyone. You can stop sharing
                at any time — see the privacy policy for the full picture.
              </p>
              <p className="label-caps mt-3">Share my location for…</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {shareDurations.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDuration(d.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      duration === d.id ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <span className="block text-[12px] font-semibold">{d.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{d.blurb}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => allowLocation(duration)}
                className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                I understand — use my location
              </button>
            </div>
          )}

          {consentReady && consent && (
            <button
              onClick={stopSharing}
              className="mt-3 text-[11px] font-semibold text-muted-foreground underline underline-offset-2"
            >
              Stop sharing my location
            </button>
          )}

          <div className="mt-4">
            <p className="label-caps">Or demo from a city</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              No GPS needed — useful in a meeting room or on a projector. Sample data is densest
              around Lisbon.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_PLACES.map((place) => (
                <button
                  key={place.label}
                  type="button"
                  data-guide={place.label === "Lisbon" ? "demo-city-lisbon" : undefined}
                  onClick={() => setManualHere(place)}
                  className={`rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                    manualLabel === place.label
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {place.label}
                </button>
              ))}
            </div>
          </div>

          <div data-guide="alert-settings">
          <p className="label-caps mt-4">Alert distance</p>
          <div className="mt-2 flex gap-2">
            {radii.map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`flex-1 rounded-xl border px-2 py-2 text-[12px] transition-colors ${
                  radius === r ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {formatDistance(r)}
              </button>
            ))}
          </div>
          <p className="label-caps mt-4">Alert frequency</p>
          <div className="mt-2 flex gap-2">
            {["Always", "Once a day", "Weekly"].map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`flex-1 rounded-xl border px-3 py-2 text-[12px] transition-colors ${
                  frequency === f ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          </div>
        </div>

        <section data-guide="near-list" className="space-y-3">
          {here && nearby.length >= 2 && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] text-muted-foreground">
                {picking
                  ? `${selectedIds.length} selected for a day trip`
                  : "Tick a few recs and Béa will arrange a day trip."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPicking((on) => !on);
                  if (picking) setSelectedIds([]);
                }}
                className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
              >
                {picking ? "Cancel" : "Plan a day trip"}
              </button>
            </div>
          )}
          {selectedPins.length >= 2 && (
            <DayTripFromNear
              selected={selectedPins}
              here={here}
              onClear={() => {
                setSelectedIds([]);
                setPicking(false);
              }}
            />
          )}
          {here && nearby.length > 0 && (
            <p className="text-[13px] text-muted-foreground">
              <span className="font-semibold text-primary">{beaLine("near.nearby").title}</span>
              {beaLine("near.nearby").body ? ` — ${beaLine("near.nearby").body}` : ""}
            </p>
          )}
          {nearby.map(({ pin: p, d }) => {
            const close = Number.isFinite(d) && d < 800;
            const metres =
              d < 100 ? Math.round(d) : Math.round(d / 10) * 10;
            return (
            <article key={p.id} className="rise card-soft p-4">
              {close && (
                <p className="mb-2 text-[12px] text-muted-foreground">
                  You're {metres} m from something Past You cared about.
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
                        className="size-4 accent-[hsl(var(--primary))]"
                      />
                    )}
                    <span className={`size-2 rounded-full ${pinColorClass[p.type]}`} />
                    <span className="label-caps">{pinLabel[p.type]}</span>
                  </div>
                  <h2 className="mt-1 text-[21px] leading-tight">{p.name}</h2>
                  <p className="text-[12px] text-muted-foreground">
                    {scoreOpportunity(p, scorePrefs, { here }).reasons[0] ?? reason(p)}
                    {p.dateAdded ? ` · added ${p.dateAdded.slice(0, 4)}` : ""}
                    {p.category ? ` · ${p.category}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-elevated px-2.5 py-1 text-[11px] font-semibold">
                  {formatDistance(d)}
                </span>
              </div>
              {p.notes && <p className="mt-3 font-display text-[15px] leading-snug">“{p.notes}”</p>}
              <div className="mt-3 flex gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-primary-foreground"
                >
                  Go now
                </a>
                <button
                  onClick={() => setSnoozed((s) => [...s, p.id])}
                  className="rounded-xl border border-border px-4 py-2.5 text-[13px]"
                >
                  Snooze
                </button>
              </div>
            </article>
            );
          })}

          {!here && locState !== "locating" && (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              Share your location and Béa will surface what's saved around you.
            </p>
          )}
          {here && nearby.length === 0 && (
            <div className="py-10 text-center">
              <p className="font-display text-[18px] leading-snug">{beaLine("near.empty").title}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {beaLine("near.empty").body} Nothing saved within {formatDistance(radius)}.
              </p>
            </div>
          )}
        </section>

        <section className="card-soft p-4">
          <p className="label-caps">Opportunity timeline</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Everything you've saved, in the order you're likely to reach it.
          </p>
          {!here && (
            <p className="mt-3 text-[13px] text-muted-foreground">
              Share your location to sort this by how close you are.
            </p>
          )}
          <ol className="mt-3 space-y-3">
            {timeline.map(({ pin: p, d, when }) => (
              <li key={`t-${p.id}`} className="flex gap-3">
                <span className="mt-1 w-[86px] shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {when}
                </span>
                <div className="min-w-0 flex-1 border-l border-border pl-3">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${pinColorClass[p.type]}`} />
                    <p className="truncate text-[14px] font-semibold">{p.name}</p>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    {p.city ? `${p.city} · ` : ""}
                    {p.recommendedBy ? `from ${p.recommendedBy}` : "saved by you"}
                    {p.dateAdded ? ` · saved ${p.dateAdded}` : ""}
                    {d != null ? ` · ${formatDistance(d)} away` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {timeline.length === 0 && (
            <p className="mt-3 text-[13px] text-muted-foreground">
              Nothing saved yet — add a recommendation and it will appear here.
            </p>
          )}
        </section>
      </div>

    </AppShell>
  );
}
