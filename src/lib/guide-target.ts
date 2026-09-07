/**
 * Pure visibility check for tour / Ask Béa targets. Empty shells (e.g. a
 * data-guide wrapper whose children haven't painted yet) must not count —
 * otherwise awaitClick steps soft-lock with Next disabled and nothing to tap.
 */
export function guideTargetLooksVisible(
  rect: { width: number; height: number },
  style: { display: string; visibility: string },
): boolean {
  if (rect.width < 1 || rect.height < 1) return false;
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
}
