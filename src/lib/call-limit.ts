/**
 * A per-person ceiling on a paid call, counted in a sliding window.
 *
 * Pure: the caller keeps the log (one per server process), so a restart
 * forgives everyone. That is enough to stop one account looping a model
 * call; it is not a billing record.
 */
export function allowCall(
  log: Map<string, number[]>,
  key: string,
  now: number,
  max: number,
  windowMs: number,
): boolean {
  const recent = (log.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= max) {
    log.set(key, recent);
    return false;
  }
  recent.push(now);
  log.set(key, recent);
  return true;
}
