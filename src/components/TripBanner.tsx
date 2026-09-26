import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { formatTripLocation } from "@/lib/place-label";
import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { photoCreditLine, tripDateLine, tripPlacesLine } from "@/lib/trip-card";
import { bannerPill, bannerScene, daysShort, heroPill, routeLine } from "@/lib/trip-glance";

/**
 * The evening scene behind a trip that has no photograph yet.
 *
 * The photo is still the point — a trip to Kyoto shows the Kyoto you already
 * saw. Somewhere new gets a painted dusk instead: sky, a low sun and three
 * ridges of hills, chosen from the trip's name so it keeps its picture. It is
 * drawn inline, so it costs no request and no provider.
 */
function Scene({ seed }: { seed: string }) {
  const s = bannerScene(seed);
  const id = `scene-${seed.replace(/[^\w-]/g, "").slice(0, 24) || "bea"}`;
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 160"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[0]} />
          <stop offset="1" stopColor={s.sky[1]} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor={s.sun} stopOpacity="0.35" />
          <stop offset="1" stopColor={s.sun} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="160" fill={`url(#${id}-sky)`} />
      <circle cx={s.sunX} cy={s.sunY} r={s.sunR * 2.1} fill={`url(#${id}-glow)`} />
      <circle cx={s.sunX} cy={s.sunY} r={s.sunR} fill={s.sun} opacity="0.85" />
      {s.birds ? (
        <path
          d={`M${s.sunX + s.sunR + 18},34 q4,-4 8,0 q4,-4 8,0`}
          fill="none"
          stroke={s.hills[2]}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : null}
      <path d={s.paths[0]} fill={s.hills[0]} />
      <path d={s.paths[1]} fill={s.hills[1]} />
      <path d={s.paths[2]} fill={s.hills[2]} />
    </svg>
  );
}

type Variant = "card" | "hero" | "compact";

/**
 * The top of a trip card: your own photo of the place (or a painted dusk),
 * how soon it is, where and when, and the title.
 *
 * Three sizes share one look. `card` is the trips list and Home's later trips;
 * `hero` is Home's current trip, with room for a footer; `compact` is the thin
 * bar pinned to the top of the trip page.
 */
export function TripBanner({
  title,
  city,
  country,
  cities,
  startDate,
  endDate,
  tentative,
  photo,
  companions,
  stopCount,
  peopleCount,
  footer,
  viewTransitionName,
  variant,
  compact = false,
}: {
  title: string;
  city?: string | null;
  country?: string | null;
  cities: string[];
  startDate?: string | null;
  endDate?: string | null;
  tentative?: boolean;
  photo: TripPhotoRow | null;
  /** "with Sam & Ana" — shown on the compact bar, where there is no chip. */
  companions?: string;
  /** Planned stops, for the "17 stops · 3D" corner. */
  stopCount?: number;
  /** Everyone on the trip, you included. The chip shows from two. */
  peopleCount?: number;
  /** Hero only: what sits under the title, over the picture. */
  footer?: ReactNode;
  /**
   * Names this banner for a view transition. The card in the list and the
   * page it opens pass the same name, and the browser tweens the picture
   * between them instead of cutting. It must be unique within the document,
   * which is why it is keyed by trip id.
   */
  viewTransitionName?: string | undefined;
  variant?: Variant;
  /** Kept for the trip page: the same as `variant="compact"`. */
  compact?: boolean;
}) {
  const kind: Variant = variant ?? (compact ? "compact" : "card");
  const url = useSignedPhoto(photo?.storage_path ?? null);

  // formatTripLocation, not a plain join: the city field often already ends
  // in the country ("Kyoto, Kyoto Prefecture, Japan"), which read "Japan, Japan".
  // Only the city's own name: "Los Angeles, California, United States" left
  // no room for the dates on a phone.
  // With several cities, name them ("Tokyo & Kyoto", "Tokyo and 2 more");
  // with one, the city and its country.
  const distinct = new Set(
    cities.map((c) => (c.split(",")[0] ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const where =
    distinct.size > 1
      ? tripPlacesLine(cities.map((c) => (c.split(",")[0] ?? "").trim()))
      : formatTripLocation(city?.split(",")[0], country) || tripPlacesLine(cities);
  const dates = startDate || endDate ? tripDateLine(startDate, endDate) : "";
  const pill =
    kind === "hero"
      ? heroPill(startDate, endDate, tentative)
      : bannerPill(startDate, endDate, tentative);
  const corner = [
    stopCount ? `${stopCount} ${stopCount === 1 ? "stop" : "stops"}` : "",
    daysShort(startDate, endDate),
  ]
    .filter(Boolean)
    .join(" · ");
  const people = peopleCount && peopleCount > 1 ? peopleCount : 0;

  const height = kind === "hero" ? "min-h-[210px]" : kind === "compact" ? "h-[68px]" : "h-[132px]";
  const rounded = kind === "hero" ? "rounded-[28px] shadow-lg" : "";

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#2a2026] text-white ${height} ${rounded}`}
      style={viewTransitionName ? { viewTransitionName } : undefined}
    >
      {url ? (
        // eager, not lazy: a transition cannot tween an image the browser has
        // not decoded yet, and it would land as a grey box that fills in after.
        <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <Scene seed={title || city || "Béa"} />
      )}
      {/* Dark at the bottom, so white type holds over any picture while the
          top of it stays the picture. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            kind === "hero"
              ? "linear-gradient(to top, rgba(18,12,10,0.88), rgba(18,12,10,0.45) 45%, rgba(18,12,10,0.05) 75%)"
              : "linear-gradient(to top, rgba(18,12,10,0.82), rgba(18,12,10,0.25) 55%, rgba(18,12,10,0) 85%)",
        }}
      />

      {kind === "compact" ? (
        <div className="absolute inset-0 flex items-center gap-3 px-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[19px] leading-tight">{title}</p>
            <p className="truncate text-[12px] text-white/75">
              {[where, dates, companions].filter(Boolean).join(" · ")}
            </p>
          </div>
          {pill ? <Pill text={pill} /> : null}
        </div>
      ) : (
        <>
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3.5">
            {pill ? <Pill text={pill} light={kind === "hero"} /> : <span />}
            <div className="flex items-center gap-1.5">
              {photo && kind === "card" ? (
                <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10.5px] text-white/85">
                  {photoCreditLine(photo)}
                </span>
              ) : null}
              {people ? (
                <span
                  aria-label={`${people} people on this trip`}
                  className="flex items-center gap-1 rounded-full border border-white/15 bg-white/20 px-2.5 py-1 text-[12.5px] font-semibold backdrop-blur-sm"
                >
                  <Users className="size-3.5" aria-hidden />
                  {people}
                </span>
              ) : null}
            </div>
          </div>

          {kind === "hero" ? (
            <div className="relative flex min-h-[210px] flex-col justify-end p-4 pt-12">
              <p className="break-words font-display text-[32px] leading-[1.02]">{title}</p>
              <p className="mt-1 text-[14px] text-white/85">
                {[dates, routeLine(cities) || city?.split(",")[0] || where]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {footer ? <div className="mt-3 border-t border-white/25 pt-3">{footer}</div> : null}
            </div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 p-3.5">
              {/* Full width: squeezed beside the corner, the dates were the
                  part that truncated away on a phone. */}
              <p className="truncate text-[12.5px] text-white/80">
                {[where, dates].filter(Boolean).join(" · ")}
              </p>
              <div className="flex items-end gap-3">
                <p className="mt-0.5 line-clamp-2 min-w-0 flex-1 break-words font-display text-[21px] leading-[1.05] sm:text-[23px]">
                  {title}
                </p>
                {corner ? (
                  <span className="shrink-0 pb-0.5 font-mono text-[12px] tracking-wider text-white/80">
                    {corner}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Pill({ text, light = false }: { text: string; light?: boolean }) {
  if (light) {
    return (
      <span className="rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#2a2026]">
        {text}
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
      <span aria-hidden className="size-1.5 rounded-full bg-[#c9a877]" />
      {text}
    </span>
  );
}
