import { useState } from "react";
import type { Pin } from "@/data/atlas";
import { NearbyPlaces } from "@/components/NearbyPlaces";
import type { useNearMe } from "@/hooks/useNearMe";
import { formatMetres } from "@/lib/near";
import { nearHomeView } from "@/lib/near-home";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "@/components/icons";
import { HomeSaveTile } from "@/components/HomeSaveTile";

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
export function NearHome({
  pins,
  near,
  waiting,
}: {
  pins: Pin[];
  near: ReturnType<typeof useNearMe>;
  /** A saved place to show while Béa does not know where you are. */
  waiting?: Parameters<typeof HomeSaveTile>[0]["waiting"];
}) {
  const [expanded, setExpanded] = useState(false);

  const view = nearHomeView({
    consent: near.consent,
    located: near.state === "ok",
    here: near.here,
    pins,
    radius: near.radius,
    dismissed: near.dismissed,
  });

  const located = near.consent && near.state === "ok";
  const card = !located && waiting ? <HomeSaveTile waiting={waiting} /> : null;

  // Nothing to be near. No point offering location to someone whose saved
  // places have no position — there is nothing for Béa to measure against.
  if (view.kind === "hidden" || !near.consentReady) {
    return card ? (
      <section data-guide="home-near" className="rise">
        <NearTitle />
        {card}
      </section>
    ) : null;
  }

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
      <section data-guide="home-near" className="rise">
        <NearTitle />
        {card}
        <div className="surface mt-3 p-3.5">
          <p className="text-[14.5px] text-muted-foreground">
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
        </div>
      </section>
    );
  }

  return (
    <section data-guide="home-near" className="rise">
      <div className="flex items-baseline justify-between gap-2">
        <NearTitle />
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="text-[12px] font-semibold text-muted-foreground underline underline-offset-2"
          >
            Show less
          </button>
        )}
      </div>

      {card ? <div className="mb-3">{card}</div> : null}

      <NearbyPlaces
        pins={pins}
        near={near}
        collapsed={!expanded}
        onExpand={() => setExpanded(true)}
      />
    </section>
  );
}

function NearTitle() {
  return (
    <div className="mb-3 flex flex-1 items-baseline justify-between gap-3">
      <h2 className="text-[20px] font-semibold leading-[1.4]">Nearby recommendations</h2>
      <Link
        to="/recommendations"
        className="-me-2 flex min-h-11 shrink-0 items-center gap-0.5 px-2 text-[14px] font-semibold text-primary"
      >
        See all
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
