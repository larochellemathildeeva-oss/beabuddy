/* globe-demo.html: BeaGlobe on its own in the three moods (built into demo/globe-demo.js by dev/build.mjs). */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BeaGlobe, type GlobeMood } from "@/components/world/BeaGlobe";
import type { Pin } from "@/data/atlas";
import { SAMPLE_COUNTRY_MARKS, SAMPLE_PINS } from "./sample-data";

declare global {
  interface Window {
    BEA_EARTH_TEXTURES?: { day: string; night: string; relief: string };
  }
}

const params = new URLSearchParams(location.search);

// ?clock=manual — recording only: time advances when the recorder calls window.__step(ms),
// so a slow software-GL machine still produces a smooth, real-speed video.
if (params.get("clock") === "manual") {
  let now = performance.now();
  let queue: FrameRequestCallback[] = [];
  let id = 0;
  performance.now = () => now;
  window.requestAnimationFrame = (cb) => (queue.push(cb), ++id);
  window.cancelAnimationFrame = () => {};
  (window as unknown as { __step: (ms: number) => void }).__step = (ms) => {
    now += ms;
    const q = queue;
    queue = [];
    for (const cb of q) cb(now);
  };
}
const only = params.get("mood") as GlobeMood | null;
const rot = params.get("rot")?.split(",").map(Number);
const auto = (params.get("auto") ?? "resume") as "resume" | "until-touch" | "off";
const clouds = params.get("clouds") !== "0";
const marks = params.get("marks") === "1";
const size = Number(params.get("size") ?? "360");
const textures = window.BEA_EARTH_TEXTURES ?? {
  day: "dev/earth/day.webp",
  night: "dev/earth/night.webp",
  relief: "public/earth/relief.webp",
};
const MOODS: GlobeMood[] = only ? [only] : ["calm", "colorful", "dark"];

function Panel({ mood }: { mood: GlobeMood }) {
  const [selected, setSelected] = useState<Pin | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  return (
    <div data-theme={mood} className={mood === "dark" ? "dark" : undefined}>
      <section
        className="bea-world flex flex-col items-center gap-3 bg-(--background) px-5 pb-6 pt-5 text-(--foreground)"
        style={{ minWidth: size + 40 }}
      >
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-(--muted-foreground) [font-family:var(--font-sans)]">
          {mood}
        </h2>
        <div style={{ width: size }}>
          <BeaGlobe
            mood={mood}
            pins={SAMPLE_PINS}
            countryMarks={marks ? SAMPLE_COUNTRY_MARKS : undefined}
            selectedId={selected?.id ?? null}
            onSelect={(p) => setSelected((cur) => (cur?.id === p.id ? null : p))}
            onCountrySelect={(c) => {
              setSelected(null);
              setCountry(c);
            }}
            autoRotate={auto}
            clouds={clouds}
            textures={textures}
            initialRotation={rot && rot.length === 2 ? [rot[0]!, rot[1]!] : [12, -30]}
          />
        </div>
        <p
          className="h-5 text-[14px] text-(--muted-foreground) [font-family:var(--font-sans)]"
          aria-live="polite"
        >
          {selected
            ? `Selected: ${selected.city}`
            : country
              ? `Country: ${country}`
              : "Drag to spin · tap a place or a country"}
        </p>
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="flex min-h-dvh flex-wrap items-start justify-center">
      {MOODS.map((m) => (
        <Panel key={m} mood={m} />
      ))}
    </main>
  </StrictMode>,
);
