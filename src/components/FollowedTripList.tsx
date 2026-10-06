import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronRight, MapPin } from "@/components/icons";
import { changeFollow } from "@/lib/trip-follow.functions";
import type { FollowedTrip } from "@/lib/trip-follow";
import { formatDateRangeLabel } from "@/lib/trip-dates";

/**
 * Trips → Following: trips other travellers shared with this one, each
 * opening the shared page (the live card, both clocks, the plan). Read-only,
 * and only what the share link shows. "Remove from list" stops following; the
 * link still opens, and following it again is one tap on that page.
 */
export function FollowedTripList({
  trips,
  onRemoved,
}: {
  trips: FollowedTrip[];
  /** Called once a trip is no longer followed, so its owner drops it from the list. */
  onRemoved: (token: string) => void;
}) {
  const change = useServerFn(changeFollow);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const remove = async (trip: FollowedTrip) => {
    setBusy((set) => new Set(set).add(trip.token));
    try {
      const next = await change({ data: { token: trip.token, follow: false } });
      if (next === "not-following" || next === "gone") {
        onRemoved(trip.token);
        toast("Removed from Following", { description: trip.title });
      } else {
        toast.error("That didn't save. Try again.");
      }
    } catch {
      toast.error("That didn't save. Try again.");
    } finally {
      setBusy((set) => {
        const next = new Set(set);
        next.delete(trip.token);
        return next;
      });
    }
  };

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
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[12px] font-bold text-primary-foreground">
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
            <button
              type="button"
              disabled={busy.has(trip.token)}
              onClick={() => void remove(trip)}
              className="mt-1 min-h-11 px-1 text-[13px] font-semibold text-muted-foreground underline underline-offset-2 disabled:opacity-60"
            >
              Remove from list
            </button>
          </li>
        );
      })}
    </ul>
  );
}
