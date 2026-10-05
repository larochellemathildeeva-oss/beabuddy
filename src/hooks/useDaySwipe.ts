import { useRef, type TouchEvent } from "react";
import { ALL_DAYS, type DayChip, type DayChoice } from "@/lib/trip-days";

/** How far a finger has to travel sideways, and how much more than up or down. */
const SWIPE_PX = 56;
const SWIPE_RATIO = 1.6;

/**
 * Swipe sideways to change day: a swipe left goes to the next day, a swipe
 * right to the one before. Ignores a touch that starts on something that
 * scrolls sideways itself (the stop ribbon, a day's tracker) or on a field.
 */
export function useDaySwipe(step: (by: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart(event: TouchEvent) {
      const target = event.target as HTMLElement | null;
      const touch = event.touches[0];
      if (
        !touch ||
        event.touches.length !== 1 ||
        target?.closest("input, select, textarea, [data-no-swipe], .overflow-x-auto")
      ) {
        start.current = null;
        return;
      }
      start.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd(event: TouchEvent) {
      const from = start.current;
      const touch = event.changedTouches[0];
      start.current = null;
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
      step(dx < 0 ? 1 : -1);
    },
  };
}

/** Moves to the next or previous day in the order the picker shows them. */
export function useDayStepper(
  chips: DayChip[],
  value: DayChoice,
  onChange: (next: DayChoice) => void,
) {
  const choices: DayChoice[] = [ALL_DAYS, ...chips.map((chip) => chip.key)];
  const at = Math.max(0, choices.indexOf(value));
  return (by: 1 | -1) => {
    const next = choices[at + by];
    if (next !== undefined) onChange(next);
  };
}
