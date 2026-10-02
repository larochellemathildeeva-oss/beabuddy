import { baseVersionsFor } from "./itinerary-concurrency.ts";

export type ScheduleWriteRow = {
  id: string;
  updated_at: string;
  day_date: string | null;
  time_label: string | null;
  position: number;
  planned_stay_minutes?: number | null;
  time_locked?: boolean | null;
};

/** Fields the atomic schedule RPC may change in one transaction. */
export type ScheduleUpdate = {
  id: string;
  day_date?: string | null;
  time_label?: string | null;
  position?: number;
  planned_stay_minutes?: number | null;
  time_locked?: boolean | null;
};

export type ScheduleWritePlan<T extends ScheduleWriteRow> = {
  updates: ScheduleUpdate[];
  touchedIds: Set<string>;
  baseVersions: Record<string, string>;
  before: T[];
  optimistic: T[];
};

/**
 * Prepare one version-checked schedule write without mutating the board.
 * Unknown row ids are ignored: callers may be holding a stale drag result,
 * but they must never create or overwrite a row by accident.
 */
export function scheduleWritePlan<T extends ScheduleWriteRow>(
  rows: readonly T[],
  requested: readonly ScheduleUpdate[],
): ScheduleWritePlan<T> | null {
  const known = new Set(rows.map((row) => row.id));
  const updates = requested.filter((update) => known.has(update.id));
  if (updates.length === 0) return null;

  const touchedIds = new Set(updates.map((update) => update.id));
  const baseVersions = baseVersionsFor(rows, touchedIds);
  const before = rows.map((row) => ({ ...row }));
  const byId = new Map(updates.map((update) => [update.id, update] as const));

  const optimistic = rows.map((row) => {
    const update = byId.get(row.id);
    if (!update) return row;
    return {
      ...row,
      ...(Object.prototype.hasOwnProperty.call(update, "day_date")
        ? { day_date: update.day_date ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(update, "time_label")
        ? { time_label: update.time_label ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(update, "position")
        ? { position: update.position ?? row.position }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(update, "planned_stay_minutes")
        ? { planned_stay_minutes: update.planned_stay_minutes ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(update, "time_locked")
        ? { time_locked: update.time_locked ?? null }
        : {}),
    } as T;
  });

  return { updates, touchedIds, baseVersions, before, optimistic };
}

/** The RPC reports optimistic concurrency failures with SQLSTATE 40001. */
export function isItineraryVersionConflict(
  error:
    | {
        code?: string | null;
        message?: string | null;
      }
    | null
    | undefined,
): boolean {
  return (
    error?.code === "40001" || Boolean(error?.message?.includes("itinerary_version_conflict:"))
  );
}

/**
 * The atomic RPC is not in the database (its migration is applied by hand):
 * PostgREST answers PGRST202, Postgres 42883.
 */
export function isMissingScheduleRpc(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|function .*apply_itinerary_schedule.* does not exist/i.test(
      error.message ?? "",
    )
  );
}

/**
 * Fold the rows the RPC returns (with their new `updated_at`) into the board,
 * so a save queued right behind this one is checked against the versions this
 * one wrote, not the ones it replaced. Fields the RPC did not return stay.
 */
export function mergeCommittedRows<T extends ScheduleWriteRow>(
  rows: readonly T[],
  committed: unknown,
): T[] {
  if (!Array.isArray(committed)) return [...rows];
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of committed) {
    if (row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string") {
      byId.set((row as { id: string }).id, row as Record<string, unknown>);
    }
  }
  return rows.map((row) => {
    const saved = byId.get(row.id);
    if (!saved) return row;
    const next = { ...row } as Record<string, unknown>;
    for (const key of [
      "updated_at",
      "day_date",
      "time_label",
      "position",
      "planned_stay_minutes",
      "time_locked",
    ] as const) {
      if (key in saved) next[key] = saved[key];
    }
    return next as T;
  });
}
