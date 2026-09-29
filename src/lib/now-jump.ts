/**
 * Where "Now" takes you on a trip day: the stop you are at, else the next
 * one by the clock, else the first stop not yet visited. Null when the whole
 * day is done — there is nowhere left to jump.
 */
import { nextUp, type ShapedItem } from "./day-shape.ts";

export type NowStop = ShapedItem & {
  id: string;
  arrived_at?: string | null;
  left_at?: string | null;
};

export function nowTarget<T extends NowStop>(items: readonly T[], minutesNow: number): T | null {
  const here = items.find((item) => item.arrived_at && !item.left_at);
  if (here) return here;
  const open = (item: T) => !(item.arrived_at && item.left_at);
  const coming = nextUp(items, minutesNow);
  if (coming && open(coming)) return coming;
  return items.find(open) ?? null;
}
