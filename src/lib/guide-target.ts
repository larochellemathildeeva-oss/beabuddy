/**
 * Pure visibility check for tour / Ask Béa targets. Empty shells (e.g. a
 * data-guide wrapper whose children haven't painted yet) must not count —
 * otherwise awaitClick steps soft-lock with Next disabled and nothing to tap.
 * Near-zero opacity (e.g. mid `rise` animation) must also fail — otherwise the
 * spotlight latches on a pre-settle rect and sits offset for the rest of the step.
 */
export function guideTargetLooksVisible(
  rect: { width: number; height: number },
  style: { display: string; visibility: string; opacity?: string },
): boolean {
  if (rect.width < 1 || rect.height < 1) return false;
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (style.opacity != null) {
    const opacity = Number.parseFloat(style.opacity);
    if (Number.isFinite(opacity) && opacity < 0.05) return false;
  }
  return true;
}
