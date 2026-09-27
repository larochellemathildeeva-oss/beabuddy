import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { formatTripLocation } from "@/lib/place-label";
import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { photoCreditLine, tripDateLine, tripPlacesLine } from "@/lib/trip-card";
import {
  bannerPill,
  bannerScene,
  daysShort,
  heroPill,
  routeLine,
  type BeaPose,
} from "@/lib/trip-glance";

/**
 * The evening scene behind a trip that has no photograph yet.
 *
 * The photo is still the point — a trip to Kyoto shows the Kyoto you already
 * saw. Somewhere new gets a painted dusk instead: sky, a low sun and three
 * ridges of hills, chosen from the trip's name so it keeps its picture. It is
 * drawn inline, so it costs no request and no provider.
 */
const COAT = "#fbf6ec";
const INK = "#2b2220";
const LINE = { stroke: INK, strokeWidth: 0.8, strokeLinejoin: "round" as const };

/** A stocky leg: a short, thick outlined stroke in her coat colour. */
function Leg({ d }: { d: string }) {
  return (
    <>
      <path d={d} stroke={INK} strokeWidth={4.4} strokeLinecap="round" fill="none" />
      <path d={d} stroke={COAT} strokeWidth={2.8} strokeLinecap="round" fill="none" />
    </>
  );
}

/**
 * Her head, centred on 0,0: wide and flat, big bat ears set wide with round
 * tips and pink inside, dark eyes, pink nose and a jowly mouth.
 */
function Head() {
  return (
    <g>
      <path
        d="M-6.5,-1.5 C-10.5,-4 -10.5,-10.5 -8,-11 C-5.8,-11 -4,-6.5 -3,-3.5 Z M6.5,-1.5 C10.5,-4 10.5,-10.5 8,-11 C5.8,-11 4,-6.5 3,-3.5 Z"
        fill={COAT}
        {...LINE}
      />
      <path
        d="M-6.6,-3.6 C-8.6,-5.6 -8.6,-9 -7.7,-9.3 C-6.8,-9 -5.6,-6.5 -4.8,-4.4 Z M6.6,-3.6 C8.6,-5.6 8.6,-9 7.7,-9.3 C6.8,-9 5.6,-6.5 4.8,-4.4 Z"
        fill="#f0b3a0"
      />
      <path
        d="M-7.5,0 C-7.5,-4.5 -4,-5.5 0,-5.5 C4,-5.5 7.5,-4.5 7.5,0 C7.5,3.8 4,5 0,5 C-4,5 -7.5,3.8 -7.5,0 Z"
        fill={COAT}
        {...LINE}
      />
      <path d="M-1.2,-4.2 L-0.6,-2.6 M1.2,-4.2 L0.6,-2.6" stroke={INK} strokeWidth={0.4} />
      <circle cx="-3" cy="-0.8" r="0.95" fill={INK} />
      <circle cx="3" cy="-0.8" r="0.95" fill={INK} />
      <ellipse cx="0" cy="1" rx="1.5" ry="1" fill="#e8958a" stroke={INK} strokeWidth={0.4} />
      <path
        d="M-3.2,2.4 C-2,3.8 -0.8,3.6 0,2.4 C0.8,3.6 2,3.8 3.2,2.4"
        stroke={INK}
        strokeWidth={0.5}
        fill="none"
      />
    </g>
  );
}

const BANDANA = "#f5d547";

/**
 * Béa as she is on the logo — a small cream-white French bulldog in a yellow
 * lemon bandana — busy with something: rolling on her back, chasing a ball,
 * or chewing a bone. Paws on the ground at y = 0, drawn facing right.
 */
function Bea({ x, flip, pose }: { x: number; flip: boolean; pose: BeaPose }) {
  return (
    <g transform={`translate(${x} 108) scale(${flip ? -1 : 1} 1)`}>
      {pose === "roll" && (
        <>
          <Leg d="M-4,-8 L-5,-11.5" />
          <Leg d="M0,-8.5 L0,-12" />
          <Leg d="M5,-8.5 L6,-12" />
          <Leg d="M8.5,-7.5 L10.5,-10.5" />
          <ellipse cx="2" cy="-4.8" rx="9.5" ry="5.2" fill={COAT} {...LINE} />
          <ellipse cx="2" cy="-6.6" rx="5" ry="2.2" fill="#f3d6cb" />
          <g transform="translate(-12.5 -6) rotate(-35)">
            <Head />
            <path d="M-4.5,4.2 L4.5,4.2 L0,8.5 Z" fill={BANDANA} {...LINE} />
          </g>
        </>
      )}
      {pose === "ball" && (
        <>
          <Leg d="M-6,-6 L-9,-1.5" />
          <Leg d="M-2.5,-6 L-3,-1" />
          <Leg d="M4,-6 L7.5,-1.5" />
          <Leg d="M6,-6.5 L10.5,-4" />
          <path d="M-9.5,-10 L-11.5,-11.5" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          <ellipse cx="0" cy="-8.8" rx="9.5" ry="5.2" fill={COAT} {...LINE} />
          <g transform="translate(12.5 -13.5)">
            <Head />
            <path d="M-4.5,4.2 L4.5,4.2 L0,8.5 Z" fill={BANDANA} {...LINE} />
          </g>
          <circle cx="26" cy="-2.6" r="2.6" fill="#e0573a" {...LINE} />
          <path
            d="M23.8,-3.6 C25,-2 27,-2 28.4,-3.4"
            stroke="#fff4e8"
            strokeWidth={0.6}
            fill="none"
          />
        </>
      )}
      {pose === "bone" && (
        <>
          <ellipse cx="-1.5" cy="-4.5" rx="10.5" ry="4.8" fill={COAT} {...LINE} />
          <Leg d="M4.5,-1.8 L11,-1.8" />
          <g transform="translate(11.5 -8.5)">
            <Head />
            <path d="M-4.5,4.2 L4.5,4.2 L0,8.5 Z" fill={BANDANA} {...LINE} />
          </g>
          <g transform="translate(15.5 -3.6) rotate(-12)">
            <rect x="-4" y="-0.9" width="8" height="1.8" fill="#fffaf0" {...LINE} />
            <circle cx="-4.2" cy="-1" r="1.2" fill="#fffaf0" {...LINE} />
            <circle cx="-4.2" cy="1" r="1.2" fill="#fffaf0" {...LINE} />
            <circle cx="4.2" cy="-1" r="1.2" fill="#fffaf0" {...LINE} />
            <circle cx="4.2" cy="1" r="1.2" fill="#fffaf0" {...LINE} />
          </g>
        </>
      )}
    </g>
  );
}

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
      {s.bea ? <Bea x={s.bea.x} flip={s.bea.flip} pose={s.bea.pose} /> : null}
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
          top of it stays the picture. A painted scene is light and even, so it
          needs far less: just enough under the words. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: !url
            ? "linear-gradient(to top, rgba(18,12,10,0.5), rgba(18,12,10,0.12) 50%, rgba(18,12,10,0) 75%)"
            : kind === "hero"
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
