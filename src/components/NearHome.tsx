import { useState } from "react";
import type { Pin } from "@/data/atlas";
import { NearbyPlaces } from "@/components/NearbyPlaces";
import { useNearMe } from "@/hooks/useNearMe";
import { formatMetres } from "@/lib/near";
import { nearHomeView } from "@/lib/near-home";

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

  const view = nearHomeView({
    consent: near.consent,
    located: near.state === "ok",
    here: near.here,
    pins,
    radius: near.radius,
    dismissed: near.dismissed,
  });

  // Nothing to be near. No point offering location to someone whose saved
  // places have no position — there is nothing for Béa to measure against.
  if (view.kind === "hidden") return null;
  if (!near.consentReady) return null;

  /**
   * Béa looked and found nothing within reach.
   *
   * This used to be one faint line, which is how sharing your location came to
   * look broken: a travel vault is mostly places abroad and the radius starts
   * at 5 km, so at home this is the ordinary answer rather than the rare one,
   * and the whole panel collapsing into grey 13.5px text reads as the tap
   * having done nothing. It now says plainly that she looked, how far she
   * looked, and what the nearest saved place actually is — an answer, rather
   * than the absence of one.
   */
  if (view.kind === "none-near" && !expanded) {
    return (
      <section data-guide="home-near" className="rise surface p-3.5">
        <p className="label-caps text-foreground">Around you right now</p>
        <p className="mt-1 text-[14.5px] text-muted-foreground">
          Nothing you've saved is within {formatMetres(near.radius)}.
        </p>
        {view.nearest && (
          <p className="mt-1.5 text-[14.5px]">
            Nearest is <span className="font-semibold">{view.nearest.pin.name}</span>, about{" "}
            {formatMetres(view.nearest.metres)} away.
          </p>
        )}
        <button
          onClick={() => setExpanded(true)}
          className="mt-2.5 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold"
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
          Share where you are and Béa will show which of your saved places are within reach.
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
