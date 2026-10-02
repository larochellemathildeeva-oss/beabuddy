export type VersionedItineraryRow = {
  id: string;
  updated_at: string;
};

export type ReconcileResult<T> = {
  rows: T[];
  staleTouchedIds: string[];
};

/**
 * Reconcile a full realtime/server snapshot while a local ChangeSet is still
 * optimistic or waiting in Review.
 *
 * - untouched rows take the server's newest value immediately;
 * - touched rows keep the local proposal so realtime never overwrites an
 *   unsaved gesture;
 * - if a touched server row no longer has the ChangeSet's base version, the
 *   proposal is stale and Review must run the consequence check again.
 *
 * `incoming` is a complete snapshot, the shape useTripBoard already reloads.
 */
export function reconcileItinerarySnapshot<T extends VersionedItineraryRow>(
  local: readonly T[],
  incoming: readonly T[],
  touchedIds: ReadonlySet<string>,
  baseVersions: Readonly<Record<string, string>>,
): ReconcileResult<T> {
  const localById = new Map(local.map((row) => [row.id, row] as const));
  const incomingById = new Map(incoming.map((row) => [row.id, row] as const));
  const staleTouchedIds: string[] = [];
  const result: T[] = [];

  for (const remote of incoming) {
    if (!touchedIds.has(remote.id)) {
      result.push(remote);
      continue;
    }
    const optimistic = localById.get(remote.id);
    const base = baseVersions[remote.id];
    if (base && remote.updated_at !== base) staleTouchedIds.push(remote.id);
    if (optimistic) result.push(optimistic);
    else result.push(remote);
  }

  // Locally inserted/optimistic rows are not in the remote snapshot yet.
  for (const id of touchedIds) {
    if (incomingById.has(id)) continue;
    const optimistic = localById.get(id);
    if (optimistic) result.push(optimistic);
  }

  return { rows: result, staleTouchedIds };
}

export type UndoSafety = {
  safeIds: string[];
  changedIds: string[];
  missingIds: string[];
};

/**
 * Undo may only write a row when it still has the version returned by the
 * original successful ChangeSet. That prevents Undo from erasing another
 * traveller's later edit.
 */
export function undoSafety<T extends VersionedItineraryRow>(
  current: readonly T[],
  committedVersions: Readonly<Record<string, string>>,
): UndoSafety {
  const currentById = new Map(current.map((row) => [row.id, row] as const));
  const safeIds: string[] = [];
  const changedIds: string[] = [];
  const missingIds: string[] = [];

  for (const [id, committedVersion] of Object.entries(committedVersions)) {
    const row = currentById.get(id);
    if (!row) {
      missingIds.push(id);
      continue;
    }
    if (row.updated_at === committedVersion) safeIds.push(id);
    else changedIds.push(id);
  }

  return { safeIds, changedIds, missingIds };
}

/** Capture the versions a ChangeSet is based on for the rows it touches. */
export function baseVersionsFor<T extends VersionedItineraryRow>(
  rows: readonly T[],
  touchedIds: ReadonlySet<string>,
): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const row of rows) if (touchedIds.has(row.id)) versions[row.id] = row.updated_at;
  return versions;
}
