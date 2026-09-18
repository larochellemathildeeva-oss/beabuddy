import { useState } from "react";
import type { Pin } from "@/data/atlas";
import { NearbyPlaces } from "@/components/NearbyPlaces";
import { useNearMe } from "@/hooks/useNearMe";
import { beaLine } from "@/lib/bea-voice";
import { formatMetres, pinsWithin } from "@/lib/near";

/**
 * What's saved around you, on the screen you actually open.
 *
 * Near was a tab, then briefly a filter inside Recs — which was a mistake:
 * the only place that could ask for your location ended up behind a chip in
 * another tab, so for anyone who had not already granted it, Near was
 * invisible. It lives here now, because Home is where you look when you are
 * out, and "Past You left a breadcrumb" is only worth anything if it reaches
 * you at the moment you could act on it.
 *
 * Collapsed by default: the nearest few, and the working tools a tap away.
 * Home stays a landing screen.
 */
export function NearHome({ pins }: { pins: Pin[] }) {
  const near = useNearMe();
  const [expanded, setExpanded] = useState(false);

  // Nothing to be near. No point offering location to someone with an empty
  // vault — there is nothing for Béa to find.
  if (pins.length === 0) return null;
  if (!near.consentReady) return null;

  const anythingNear = near.here ? pinsWithin(near.here, pins, near.radius).length > 0 : false;

  const quiet = near.consent && near.state === "ok" && !anythingNear;

  if (quiet && !expanded) {
    return (
      <section data-guide="home-near" className="flex items-baseline justify-between gap-2">
        <p className="text-[13.5px] text-muted-foreground">
          Nothing saved within {formatMetres(near.radius)} of you.
        </p>
        <button
          onClick={() => setExpanded(true)}
          className="shrink-0 text-[12.5px] font-semibold underline underline-offset-2"
        >
          Look further
        </button>
      </section>
    );
  }

  return (
    <section data-guide="home-near" className="rise">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="label-caps text-foreground">
          {near.consent ? "Around you right now" : "Places near you"}
        </p>
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="text-[12px] font-semibold text-muted-foreground underline underline-offset-2"
          >
            Show less
          </button>
        )}
      </div>

      {!near.consent && (
        <p className="mb-3 text-[14.5px] text-muted-foreground">
          {beaLine("near.nearby").body ||
            "Share your location and Béa will surface what you've already saved nearby."}
        </p>
      )}

      <NearbyPlaces
        pins={pins}
        near={near}
        collapsed={!expanded}
        onExpand={() => setExpanded(true)}
      />
    </section>
  );
}
