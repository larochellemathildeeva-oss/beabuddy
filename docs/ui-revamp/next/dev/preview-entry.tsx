/* preview.html: the World Map tab in Calm / Colorful / Dark (built into demo/preview.js by dev/build.mjs). */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BeaGlobe, type GlobeMood } from "@/components/world/BeaGlobe";
import {
  CustomizeWorldButton,
  WorldFilters,
  WorldGlobeStage,
  WorldHeaderPreview,
  WorldNavPreview,
  WorldPlaceCard,
  WorldStatsStrip,
  WorldTabs,
  type WorldFilterId,
  type WorldTabId,
} from "@/components/world/WorldScreen";
import { SAMPLE_COUNTRY_MARKS, SAMPLE_PINS, SAMPLE_STATS, samplePlace } from "./sample-data";
import logo from "./assets/bea-logo.png";

declare global {
  interface Window {
    BEA_EARTH_TEXTURES?: { day: string; night: string; relief: string };
  }
}

const params = new URLSearchParams(location.search);
const only = params.get("mood") as GlobeMood | null;
const accent = params.get("accent") ?? "pink";
const textures = window.BEA_EARTH_TEXTURES;
const auto = (params.get("auto") ?? "resume") as "resume" | "until-touch" | "off";

function Phone({ mood }: { mood: GlobeMood }) {
  const [tab, setTab] = useState<WorldTabId>("map");
  const [filter, setFilter] = useState<WorldFilterId | null>("cities");
  const [sel, setSel] = useState<string | null>("paris");
  const pin = SAMPLE_PINS.find((p) => p.id === sel) ?? null;
  return (
    // The app's own theme mechanism: data-theme (+ .dark) and data-accent on an ancestor.
    <div data-theme={mood} data-accent={accent} className={mood === "dark" ? "dark" : undefined}>
      <div
        data-phone={mood}
        className="bea-world relative isolate flex h-[844px] w-[390px] shrink-0 flex-col overflow-hidden bg-(--background) text-(--foreground)"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-(image:--world-wash)"
        />
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          <WorldHeaderPreview logoSrc={logo} />
          <WorldTabs active={tab} onChange={setTab} className="mt-4" />
          <div role="tabpanel" id={`world-panel-${tab}`} aria-labelledby={`world-tab-${tab}`}>
            {tab === "map" ? (
              <>
                <WorldGlobeStage onAddPlace={() => {}} className="mt-1">
                  <BeaGlobe
                    pins={SAMPLE_PINS}
                    countryMarks={filter === "countries" ? SAMPLE_COUNTRY_MARKS : undefined}
                    shadePinCountries={filter === "countries" || filter === null}
                    selectedId={sel}
                    onSelect={(p) => setSel((cur) => (cur === p.id ? null : p.id))}
                    mood={mood}
                    textures={textures}
                    autoRotate={auto}
                    initialRotation={[28, -36]}
                  />
                </WorldGlobeStage>
                <WorldFilters active={filter} onChange={setFilter} className="mt-2" />
                {pin && (
                  <WorldPlaceCard
                    place={samplePlace(pin)}
                    onOpen={() => {}}
                    className="mt-2.5 w-[calc(100%-2rem)]"
                  />
                )}
                <WorldStatsStrip stats={SAMPLE_STATS} className="mt-2.5" />
                <CustomizeWorldButton onClick={() => {}} className="mt-3 w-[calc(100%-2rem)]" />
              </>
            ) : (
              <p className="px-6 py-16 text-center text-[16px] text-(--muted-foreground)">
                This tab keeps world.tsx’s existing content.
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 pb-2 pt-1">
          <WorldNavPreview />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div
      className={only ? "flex" : "flex flex-wrap items-start justify-center gap-[60px] p-[40px]"}
    >
      {(only ? [only] : (["calm", "colorful", "dark"] as GlobeMood[])).map((m) => (
        <Phone key={m} mood={m} />
      ))}
    </div>
  </StrictMode>,
);
