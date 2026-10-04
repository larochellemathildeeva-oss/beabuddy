import type { PlannerTab } from "@/components/ItineraryImport";
import type { PrepTab } from "@/components/TripPrep";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { MemberRow, TripRow } from "@/hooks/useTrips";
import type { TripDetailCtx } from "@/components/trip-detail/ctx";
import { useTripDetailPart1 } from "@/components/trip-detail/part1";
import { useTripDetailPart2 } from "@/components/trip-detail/part2";
import { useTripDetailPart3 } from "@/components/trip-detail/part3";
import { useTripDetailPart4 } from "@/components/trip-detail/part4";
import { TripDetailView } from "@/components/trip-detail/view";

/**
 * A trip, as a page.
 *
 * This was the expanded half of a card in a list. Being a route rather than an
 * accordion is what lets the browser carry the trip's photograph across from
 * the card you tapped, and it also deleted the sessionStorage workaround that
 * existed only to stop the accordion collapsing when you changed tab — a
 * workaround is usually the shape of the model being wrong, and it was.
 */
export function TripDetail({
  trip,
  photos = [],
  members,
  companionsLine,
  me,
  onInvite,
  onRevokeInvite,
  onUpdate,
  onDelete,
  onLeave,
  onRemoveMember,
  openPrep,
  openView,
  openPlan,
}: {
  trip: TripRow;
  /** The trip's own photographs, shared with its cards. */
  photos?: TripPhotoRow[];
  members: MemberRow[];
  companionsLine: string;
  me: { id: string | null; name: string };
  onInvite: () => Promise<string>;
  onRevokeInvite: (code: string) => Promise<void>;
  onUpdate: (patch: Partial<TripRow>) => Promise<void>;
  onDelete: () => Promise<void>;
  onLeave: () => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  /** Open the to-do or packing sheet on arrival (Home's shortcuts). */
  openPrep?: PrepTab | undefined;
  /** A tab asked for in the link. */
  openView?: "bookings" | undefined;
  /** Open Plan with Béa on arrival, on this panel, with any words already typed. */
  openPlan?: { tab: PlannerTab; ask?: string | undefined } | undefined;
}) {
  const td = {} as TripDetailCtx;
  td.trip = trip;
  td.photos = photos;
  td.members = members;
  td.companionsLine = companionsLine;
  td.me = me;
  td.onInvite = onInvite;
  td.onRevokeInvite = onRevokeInvite;
  td.onUpdate = onUpdate;
  td.onDelete = onDelete;
  td.onLeave = onLeave;
  td.onRemoveMember = onRemoveMember;
  td.openPrep = openPrep;
  td.openView = openView;
  td.openPlan = openPlan;
  useTripDetailPart1(td);
  useTripDetailPart2(td);
  useTripDetailPart3(td);
  useTripDetailPart4(td);
  return <TripDetailView td={td} />;
}
