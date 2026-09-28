import { allowCall } from "@/lib/call-limit";

/** Asks to Béa per person per hour: plenty for a trip, not for a loop. */
export const PLAN_EDIT_CALLS_PER_HOUR = 30;

const log = new Map<string, number[]>();

export function allowPlanEdit(userId: string): boolean {
  return allowCall(log, userId, Date.now(), PLAN_EDIT_CALLS_PER_HOUR, 60 * 60 * 1000);
}
