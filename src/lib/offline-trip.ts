/**
 * A trip kept on the phone, so Béa opens it with no signal.
 *
 * Only for a trip whose directions were kept offline ("Keep offline" in the
 * trip menu): that is the traveller asking for this trip to work without a
 * connection, and the plan is what they will look for first. The trip, its
 * people and its timeline are written each time they load; with no signal,
 * the trip list and the trip read them back. It belongs to one account — a
 * copy saved by someone else on this phone is never shown — and it goes when
 * the saved directions are deleted, or the account is.
 *
 * Pure (storage is handed in), so reading back is tested.
 */

export const OFFLINE_TRIP_KEY_PREFIX = "bea.offline-trip.";

export const offlineTripKey = (tripId: string) => `${OFFLINE_TRIP_KEY_PREFIX}${tripId}`;

export type OfflineTrip<Trip, Member, Item> = {
  uid: string;
  savedAt: string;
  trip: Trip;
  members: Member[];
  items: Item[];
};

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function saveOfflineTrip<Trip extends { id: string }, Member, Item>(
  store: Store,
  record: OfflineTrip<Trip, Member, Item>,
): void {
  try {
    store.setItem(offlineTripKey(record.trip.id), JSON.stringify(record));
  } catch {
    // Full or private: the trip still works online.
  }
}

function parse<Trip, Member, Item>(
  raw: string | null,
  uid: string,
): OfflineTrip<Trip, Member, Item> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OfflineTrip<Trip, Member, Item>>;
    if (
      value.uid !== uid ||
      !value.trip ||
      !Array.isArray(value.items) ||
      !Array.isArray(value.members)
    )
      return null;
    return value as OfflineTrip<Trip, Member, Item>;
  } catch {
    return null;
  }
}

export function readOfflineTrip<Trip, Member, Item>(
  store: Store,
  tripId: string,
  uid: string,
): OfflineTrip<Trip, Member, Item> | null {
  try {
    return parse<Trip, Member, Item>(store.getItem(offlineTripKey(tripId)), uid);
  } catch {
    return null;
  }
}

/** Every trip this account kept on the phone. */
export function readOfflineTrips<Trip, Member, Item>(
  store: Store,
  uid: string,
): OfflineTrip<Trip, Member, Item>[] {
  const out: OfflineTrip<Trip, Member, Item>[] = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(OFFLINE_TRIP_KEY_PREFIX)) continue;
      const record = parse<Trip, Member, Item>(store.getItem(key), uid);
      if (record) out.push(record);
    }
  } catch {
    // Storage blocked: nothing kept.
  }
  return out;
}

export function forgetOfflineTrip(store: Store, tripId: string): void {
  try {
    store.removeItem(offlineTripKey(tripId));
  } catch {
    // Nothing to forget.
  }
}
