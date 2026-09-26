import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import type { Pin } from "@/data/atlas";
import type { useNearMe } from "@/hooks/useNearMe";
import { nudgePin } from "@/lib/near";
import { walkMinutes } from "@/lib/trip-glance";
import { GLANCE_TILE } from "@/components/HomeWeather";

/**
 * The second "At a glance" tile: a saved place within a short walk when Béa
 * knows where you are, otherwise the saved place waiting longest for you.
 * Hidden when there is neither.
 */
export function HomeSaveTile({
  pins,
  near,
  waiting,
}: {
  pins: Pin[];
  near: ReturnType<typeof useNearMe>;
  waiting: { name: string; city?: string | null; recommended_by?: string | null } | undefined;
}) {
  const located = near.consent && near.state === "ok" ? near.here : null;
  const close = located ? nudgePin(located, pins, near.dismissed) : null;
  const tile = `${GLANCE_TILE} border-primary/10 bg-primary/10`;

  if (close) {
    const minutes = walkMinutes(close.metres);
    const note = [close.pin.category, `${minutes} min walk`].filter(Boolean).join(" · ");
    return (
      <Link to="/opportunities" data-guide="home-waiting" className={tile}>
        <Head label="Nearby save" />
        <Body name={close.pin.name} note={note} />
      </Link>
    );
  }

  if (!waiting) return null;
  const note = [
    waiting.city?.split(",")[0],
    waiting.recommended_by && `from ${waiting.recommended_by}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link to="/recommendations" data-guide="home-waiting" className={tile}>
      <Head label="Waiting for you" />
      <Body name={waiting.name} note={note} />
    </Link>
  );
}

function Head({ label }: { label: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary">
        {label}
      </p>
      <Bookmark className="size-5 shrink-0 text-primary" aria-hidden />
    </div>
  );
}

function Body({ name, note }: { name: string; note: string }) {
  return (
    <div className="min-w-0">
      <p className="line-clamp-2 font-display text-[22px] leading-tight">{name}</p>
      {note ? <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}
