import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { pinColorClass } from "@/data/atlas";
import type { Pin } from "@/data/atlas";
import { formatMetres, nudgePin } from "@/lib/near";
import { useNearMe } from "@/hooks/useNearMe";

/**
 * One breadcrumb from Past You, on Home.
 *
 * Near lost its tab when it became a filter on the vault, and a filter chip is
 * a quieter home than a tab. "You're 180 m from something Past You cared
 * about" is the moment that justifies the whole app, so it has to keep
 * happening somewhere people actually look — and Home is arguably a better
 * place for it than a tab nobody opens while they are out walking.
 *
 * Deliberately at most one, and only when it is close enough to act on. Home
 * is not a list; a nudge about somewhere across town is noise.
 */
export function NearNudge({ pins }: { pins: Pin[] }) {
  const near = useNearMe();
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Only for people who have already said yes elsewhere. Home is not the place
  // to ask for location for the first time.
  if (!near.consentReady || !near.consent) return null;

  const hit = nudgePin(near.here, pins, dismissed);
  if (!hit) return null;

  const { pin, metres } = hit;

  return (
    <section data-guide="home-near" className="rise card-soft overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className={`mt-2 size-2 shrink-0 rounded-full ${pinColorClass[pin.type]}`} />
        <div className="min-w-0 flex-1">
          <p className="label-caps">{formatMetres(metres)} away</p>
          <h2 className="mt-1 font-display text-[20px] leading-tight">{pin.name}</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {pin.recommendedBy ? `${pin.recommendedBy} told you about this` : "You saved this"}
            {pin.dateAdded ? ` · ${pin.dateAdded.slice(0, 4)}` : ""}
          </p>
          {pin.notes && <p className="mt-2 font-display text-[15px] leading-snug">“{pin.notes}”</p>}
        </div>
        <button
          onClick={() => setDismissed((d) => [...d, pin.id])}
          aria-label={`Dismiss ${pin.name}`}
          className="shrink-0 text-[12px] font-semibold text-muted-foreground underline underline-offset-2"
        >
          Not now
        </button>
      </div>
      <div className="flex gap-2 border-t border-border/50 px-4 py-2.5">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lon}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-xl bg-primary px-4 py-2 text-center text-[14px] font-semibold text-primary-foreground"
        >
          Go now
        </a>
        <Link
          to="/recommendations"
          search={{ near: "1" }}
          className="rounded-xl border border-border px-4 py-2 text-[14px] font-semibold"
        >
          What else is near
        </Link>
      </div>
    </section>
  );
}
