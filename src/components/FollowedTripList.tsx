import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPin } from "@/components/icons";
import type { FollowedTrip } from "@/lib/trip-follow";
import { formatDateRangeLabel } from "@/lib/trip-dates";

/**
 * Trips → Following: trips other travellers shared with this one, each
 * opening the shared page (the live card, both clocks, the plan). Read-only,
 * and only what the share link shows. Unfollowing is on that page.
 */
export function FollowedTripList({ trips }: { trips: FollowedTrip[] }) {
  if (trips.length === 0) {
    return (
      <p className="py-6 text-center text-[14.5px] text-muted-foreground">
        Not following any trips. Open a link someone shared and tap “Follow in Béa”.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {trips.map((trip) => {
        const dates =
          trip.startDate && trip.endDate ? formatDateRangeLabel(trip.startDate, trip.endDate) : "";
        return (
          <li key={trip.token}>
            <Link
              to="/shared/$token"
              params={{ token: trip.token }}
              className="plain-card flex items-center gap-3 p-3.5"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-display text-[19px] leading-tight">
                    {trip.title}
                  </span>
                  {trip.live && (
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-bold text-primary-foreground">
                      Live
                    </span>
                  )}
                </span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {[trip.place, dates].filter(Boolean).join(" · ") || "Shared trip"}
                </span>
                {trip.nowAt && (
                  <span className="mt-1 flex items-center gap-1 text-[13px] text-foreground">
                    <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">Now at {trip.nowAt}</span>
                  </span>
                )}
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
