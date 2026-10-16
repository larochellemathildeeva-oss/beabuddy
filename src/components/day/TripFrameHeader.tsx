import type { ReactNode } from "react";
import { MapIcon, MoreHorizontal } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { frameDateRange, frameDayCount, frameDaysLabel } from "@/lib/trip-frame";
import type { TripPerspective } from "@/lib/trip-perspective";

/**
 * The trip page's head card, as the three Figma frames draw it: a grey card
 * holding the small label, the name, the dates, the view tabs and whatever
 * belongs to the view (Overview: the itinerary sequence; Map: its Map /
 * Companion switch; Timeline: the day's picture and a "Map" shortcut).
 */
export function TripFrameHeader({
  perspective,
  title,
  kicker,
  places,
  country,
  startDate,
  endDate,
  tentative,
  tabs,
  onMenu,
  onOpenMap,
  badge,
  photo,
  children,
}: {
  perspective: TripPerspective;
  title: string;
  /** The small label: "Japan explorer", the dates on Overview. */
  kicker?: string;
  /** "Rome, Florence & the Amalfi Coast". */
  places: string;
  country?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  tentative?: boolean;
  tabs: ReactNode;
  onMenu: () => void;
  onOpenMap: () => void;
  /** Places to confirm, when the traveller shows them. */
  badge?: ReactNode;
  /** The Timeline's picture strip. */
  photo?: ReactNode;
  children?: ReactNode;
}) {
  const range = frameDateRange(startDate, endDate);
  const days = frameDaysLabel(frameDayCount(startDate, endDate));
  const dated = [range, tentative && range ? "tentative" : ""].filter(Boolean).join(" · ");
  const menu = (
    <span className="flex shrink-0 items-center gap-2">
      {badge}
      <button
        type="button"
        onClick={onMenu}
        data-guide="trip-menu"
        aria-label="Trip menu"
        className="tf-round"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
    </span>
  );
  return (
    <section className="tf-card" aria-label={title}>
      {perspective === "overview" ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="tf-kicker">{dated || "No dates yet"}</p>
            <p className="text-[14px]">{days}</p>
          </div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="tf-title line-clamp-2 min-w-0 break-words">{title}</h1>
            {menu}
          </div>
          {places ? <p className="tf-sub">{places}</p> : null}
        </>
      ) : perspective === "timeline" ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="tf-title line-clamp-2 break-words">{title}</h1>
              <p className="tf-sub !mt-2 text-muted-foreground">
                {[country, dated].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onOpenMap}
              className="shrink-0"
            >
              <MapIcon aria-hidden />
              Map
            </Button>
          </div>
          {photo}
        </>
      ) : (
        <>
          {kicker ? <p className="tf-kicker">{kicker}</p> : null}
          <div className="flex items-start justify-between gap-3">
            <h1 className="tf-title line-clamp-3 min-w-0 break-words">{title}</h1>
            {menu}
          </div>
          <p className="tf-sub !mt-2">{[dated, days].filter(Boolean).join(" · ")}</p>
        </>
      )}
      {tabs}
      {children}
    </section>
  );
}
