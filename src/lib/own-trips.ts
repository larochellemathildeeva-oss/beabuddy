/**
 * The trips a traveller may see: ones they own or have joined. The database's
 * row level security already says so; this keeps the list right even when a
 * live database carries a looser rule than the migrations, so a new account
 * never opens on someone else's trips.
 */
export function ownTrips<
  T extends { id: string; owner_id: string },
  M extends { trip_id: string; user_id: string },
>(trips: readonly T[], members: readonly M[], uid: string): { trips: T[]; members: M[] } {
  const joined = new Set(members.filter((m) => m.user_id === uid).map((m) => m.trip_id));
  const kept = trips.filter((t) => t.owner_id === uid || joined.has(t.id));
  const ids = new Set(kept.map((t) => t.id));
  return { trips: kept, members: members.filter((m) => ids.has(m.trip_id)) };
}
