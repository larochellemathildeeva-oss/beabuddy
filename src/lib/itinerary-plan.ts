/** Drop guessed prices unless the traveller asked for them. */
export function applyCostPolicy<
  T extends {
    estimated_total: number | null;
    costs: unknown[];
    items: Array<{ estimated_cost: number | null }>;
  },
>(plan: T, includeCosts: boolean): T {
  if (includeCosts) return plan;
  return {
    ...plan,
    estimated_total: null,
    costs: [],
    items: plan.items.map((item) => ({ ...item, estimated_cost: null })),
  };
}

/** Swap only the ticked stops; leave the rest in place. */
export function mergeAlternativeItems<T>(
  current: T[],
  replacements: T[],
  selectedIndexes: number[],
): T[] {
  const next = current.slice();
  selectedIndexes.forEach((index, i) => {
    const replacement = replacements[i];
    if (replacement && index >= 0 && index < next.length) {
      next[index] = replacement;
    }
  });
  return next;
}
