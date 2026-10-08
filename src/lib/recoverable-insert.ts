/** Reconcile caller-generated IDs without overwriting existing rows.
 * Reads and inserts must retain the caller's normal authorization filters.
 */
export async function recoverableInsert<T extends { id: string }>(
  rows: readonly T[],
  read: () => Promise<readonly { id: string }[]>,
  insert: (missing: T[]) => Promise<void>,
): Promise<void> {
  if (!rows.length) return;
  const saved = new Set((await read()).map((row) => row.id));
  const missing = rows.filter((row) => !saved.has(row.id));
  if (!missing.length) return;
  try {
    await insert(missing);
  } catch (error) {
    // A timeout or competing retry can hide a successful commit. If the
    // follow-up read also fails, retain the original attempt for another retry.
    const confirmed = new Set((await read()).map((row) => row.id));
    if (rows.every((row) => confirmed.has(row.id))) return;
    throw error;
  }
}
